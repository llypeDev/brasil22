// Normalização dos arquivos públicos de resultados do TSE para o contrato interno do painel.
//
// Funções puras, usadas pelo script de normalização (scripts/tse/normalizar.mjs) e pelo
// coletor ao vivo do servidor. Toda contagem é validada (inteira, finita, não negativa) e a
// abrangência do arquivo precisa corresponder à solicitada. Em caso de dúvida, lança erro:
// quem chama mantém o último snapshot válido.

export const CARGOS = { presidente: 1, governador: 3, senador: 5, depFederal: 6, depEstadual: 7, depDistrital: 8 };

export class ErroDeContrato extends Error {}

const inteiro = (v, campo) => {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 0) throw new ErroDeContrato(`Contagem inválida em ${campo}: ${v}`);
  return n;
};

/** "05/10/2026" + "12:51:47" (horário de Brasília) → ISO com fuso. */
export function instante(data, hora) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data ?? '');
  if (!m || !/^\d{2}:\d{2}:\d{2}$/.test(hora ?? '')) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${hora}-03:00`;
}

/** Minutos desde 00:00 do dia da eleição (horário de Brasília). Pode passar de 1.440. */
export function minutosDaEleicao(iso, dataEleicao = '2026-10-04') {
  if (!iso) return null;
  const base = Date.parse(`${dataEleicao}T00:00:00-03:00`);
  return Math.round((Date.parse(iso) - base) / 60000);
}

const DESTINO_VALIDO = /^v[aá]lido/i;

/** Código curto da situação de uma candidatura. */
export function codigoSituacao(st) {
  const s = String(st ?? '').toLowerCase();
  if (s.startsWith('eleito por qp')) return 'eleito-qp';
  if (s.startsWith('eleito por m')) return 'eleito-media';
  if (s === 'eleito') return 'eleito';
  if (s.startsWith('2')) return 'segundo-turno';
  if (s.startsWith('suplente')) return 'suplente';
  if (s.startsWith('não eleito') || s.startsWith('nao eleito')) return 'nao-eleito';
  if (!s || s.includes('apura')) return 'apurando';
  return s.replace(/\s+/g, '-');
}
export const eleito = (codigo) => codigo === 'eleito' || codigo === 'eleito-qp' || codigo === 'eleito-media';

/**
 * Lê um arquivo "-u.json" e devolve o resultado normalizado de uma abrangência.
 * @param {any} bruto conteúdo do arquivo
 * @param {{ cargo: number, abrangencia: string, eleicao?: string }} esperado
 */
export function lerResultado(bruto, esperado) {
  if (bruto?.f !== 'o') throw new ErroDeContrato('Arquivo fora da fase oficial.');
  if (Number(bruto.t) !== 1) throw new ErroDeContrato('Turno inesperado.');
  if (esperado.eleicao && String(bruto.ele) !== String(esperado.eleicao)) throw new ErroDeContrato('Eleição divergente.');
  const cd = String(bruto.cdabr ?? '').toLowerCase();
  const alvo = String(esperado.abrangencia).toLowerCase();
  if (cd !== alvo && cd !== String(Number(alvo))) throw new ErroDeContrato(`Abrangência divergente: ${cd} ≠ ${alvo}`);
  const carg = (bruto.carg ?? []).find((c) => Number(c.cd) === esperado.cargo);
  if (!carg) throw new ErroDeContrato(`Cargo ${esperado.cargo} ausente.`);

  const secoes = inteiro(bruto.s?.ts, 's.ts');
  const totalizadas = inteiro(bruto.s?.st, 's.st');
  if (totalizadas > secoes) throw new ErroDeContrato('Seções totalizadas excedem o total.');

  const candidatos = [];
  const agremiacoes = [];
  for (const a of carg.agr ?? []) {
    const ag = { n: String(a.n), nome: String(a.nm ?? ''), tipo: String(a.tp ?? ''), composicao: String(a.com ?? ''), vagas: a.vag != null ? inteiro(a.vag, 'agr.vag') : null, partidos: [] };
    for (const p of a.par ?? []) {
      ag.partidos.push({
        n: String(p.n), sigla: String(p.sg), federacao: String(p.nfed ?? ''),
        nominais: inteiro(p.tvtn, 'par.tvtn'), legenda: inteiro(p.tvtl, 'par.tvtl'), validos: inteiro(p.tvan, 'par.tvan'),
      });
      for (const c of p.cand ?? []) {
        const votos = inteiro(c.vap, 'cand.vap');
        candidatos.push({
          n: String(c.n),
          sq: String(c.sqcand ?? ''),
          nomeUrna: String(c.nmu ?? c.nm ?? ''),
          nome: String(c.nm ?? ''),
          partido: String(p.sg),
          agremiacao: ag.n,
          valido: DESTINO_VALIDO.test(String(c.dvt ?? '')),
          destino: String(c.dvt ?? ''),
          situacao: codigoSituacao(c.st),
          situacaoTse: String(c.st ?? ''),
          votos,
          // percentual publicado pelo TSE (sobre válidos computados, inclui sub judice)
          pctTse: c.pvapn != null ? Number(String(c.pvapn).replace(',', '.')) : null,
          vices: (c.vs ?? []).map((v) => ({ tipo: String(v.tp), nome: String(v.nmu ?? v.nm ?? ''), partido: String(v.sgp ?? '') })),
        });
      }
    }
    agremiacoes.push(ag);
  }
  candidatos.sort((a, b) => b.votos - a.votos || a.n.localeCompare(b.n));

  const v = bruto.v ?? {};
  const e = bruto.e ?? {};
  const totais = {
    secoes,
    totalizadas,
    eleitorado: inteiro(e.te, 'e.te'),
    eleitoradoApurado: inteiro(e.est, 'e.est'),
    comparecimento: inteiro(e.c, 'e.c'),
    abstencao: inteiro(e.a, 'e.a'),
    brancos: inteiro(v.vb, 'v.vb'),
    nulos: inteiro(v.tvn, 'v.tvn'),
    validos: inteiro(v.vv, 'v.vv'),
    anuladosSJ: inteiro(v.vansj, 'v.vansj'),
    nominais: inteiro(v.vnom, 'v.vnom'),
    legenda: inteiro(v.vl, 'v.vl'),
  };
  // Coerência: soma das votações válidas nominais ≤ válidos; anuladas batem com vansj quando publicado.
  const somaValidos = candidatos.filter((c) => c.valido).reduce((s, c) => s + c.votos, 0);
  if (somaValidos > totais.validos + 1) throw new ErroDeContrato(`Soma nominal (${somaValidos}) excede válidos (${totais.validos}).`);

  return {
    abrangencia: alvo,
    tipo: String(bruto.tpabr ?? ''),
    eleicao: String(bruto.ele),
    cargo: esperado.cargo,
    vagas: carg.nv != null ? inteiro(carg.nv, 'carg.nv') : 1,
    geradoEm: instante(bruto.dg, bruto.hg),
    totalizadoEm: instante(bruto.dt, bruto.ht),
    geracao: String(bruto.idg ?? ''),
    andamento: bruto.and === 'f' ? 'finalizada' : totalizadas > 0 ? 'apurando' : 'aguardando',
    divulgacao: bruto.dv !== 'n',
    totais,
    candidatos,
    agremiacoes,
  };
}

/** Situação da disputa, derivada exclusivamente das situações oficiais das candidaturas. */
export function situacaoDaDisputa(r) {
  if (!r.divulgacao) return 'aguardando';
  const cods = r.candidatos.map((c) => c.situacao);
  const eleitos = cods.filter(eleito).length;
  if (r.cargo === CARGOS.senador) {
    if (eleitos >= r.vagas) return 'eleitos';
    if (eleitos > 0) return 'parcial';
  } else if (r.cargo === CARGOS.presidente || r.cargo === CARGOS.governador) {
    if (eleitos > 0) return 'eleito';
    if (cods.includes('segundo-turno')) return 'segundo-turno';
  } else if (eleitos > 0 && r.andamento === 'finalizada') {
    return 'concluida';
  }
  if (r.totais.totalizadas === 0) return 'aguardando';
  return r.andamento === 'finalizada' ? 'concluida' : 'apurando';
}

/** Resultado compacto de uma abrangência, no formato publicado no feed. */
export function compactar(r) {
  const votos = {}; const anulados = {}; const situacoes = {};
  for (const c of r.candidatos) {
    (c.valido ? votos : anulados)[c.n] = c.votos;
    if (c.situacao !== 'apurando') situacoes[c.n] = c.situacao;
  }
  return { ...r.totais, votos, anulados, situacao: situacaoDaDisputa(r), situacoes, totalizadoEm: r.totalizadoEm, geradoEm: r.geradoEm };
}

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'o', 'a', 'os', 'as', 'del', 'la', 'di', 'du', 'van', 'von']);
const SIGLAS = new Set(['II', 'III', 'IV', 'JHC', 'PM', 'PC', 'MC', 'DJ', 'GB', 'TV', 'ZE', 'BA', 'MT', 'JR']);
/** Grafia de exibição a partir do nome de urna em caixa alta, sem acrescentar acentos. */
export function nomeDeExibicao(s) {
  const palavras = String(s ?? '').trim().toLocaleLowerCase('pt-BR').split(/\s+/);
  return palavras.map((p, i) => {
    const up = p.toLocaleUpperCase('pt-BR');
    if (SIGLAS.has(up.replace(/\./g, ''))) return up;
    if (i > 0 && MINUSCULAS.has(p)) return p;
    if (/^[^aeiouáéíóúâêôãõày]+\.?$/i.test(p) && p.length <= 4 && !/^(sr|dr|dra|pr|st|sta|sto)\.?$/i.test(p)) return up;
    return p.replace(/(^|[-'’(])(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('pt-BR'));
  }).join(' ');
}
