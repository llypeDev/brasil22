// Feed sob demanda da opção 2. Só consulta arquivos públicos de divulgação do TSE.
// O mesmo adaptador serve a função da Vercel, o servidor local e a publicação em disco.
import { compactar, eleicaoDoCargo, ErroDeContrato, lerResultado, minutosDaEleicao, nomeDeExibicao } from './lib/tse.mjs';
import { enviarJson, erro } from './lib/http.mjs';

export const CONFIG_ELEICOES = 'oficial/comum/config/ele-c.json';
export const UFS = 'AC AL AP AM BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
export const UFS_GOVERNADOR = ['RJ', 'AM', 'ES', 'RN', 'DF', 'TO', 'AC'];
export const CACHE_SEGUNDO_TURNO = 'public, max-age=0, s-maxage=15, stale-while-revalidate=15';
const DATA = '2026-10-25';
const pad = (n, w) => String(n).padStart(w, '0');
const caminhoCadastro = (eleicao) => `oficial/ele2026/${eleicao}/config/mun-e${pad(eleicao, 6)}-cm.json`;
export const caminhoResultado = (eleicao, cargo, uf, municipio = '', zona = '') =>
  `oficial/ele2026/${eleicao}/dados/${uf}/${uf}${municipio}${zona ? `-z${zona}` : ''}-c${pad(cargo, 4)}-e${pad(eleicao, 6)}-u.json`;

export class ErroTse extends Error {
  constructor(mensagem, status = 503, esperarSegundos = 15) { super(mensagem); this.status = status; this.esperarSegundos = esperarSegundos; }
}

/** Cache limitado por instância e uma requisição em voo por arquivo; a CDN também tem 15 s. */
export function criarLeitorTse({ consultar = fetch, agora = Date.now } = {}) {
  const cache = new Map(), emVoo = new Map();
  return async function ler(rel) {
    const anterior = cache.get(rel);
    if (anterior && agora() - anterior.em < 15_000) return anterior.valor;
    if (emVoo.has(rel)) return emVoo.get(rel);
    const promessa = (async () => {
      let resposta;
      try {
        resposta = await consultar(`https://resultados.tse.jus.br/${rel}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
      } catch { throw new ErroTse('Não foi possível consultar o TSE.'); }
      if (resposta.status !== 404 && !resposta.ok) throw new ErroTse(`TSE temporariamente indisponível (${resposta.status}).`, 503, Math.min(60, Math.max(15, Number(resposta.headers.get('retry-after')) || 15)));
      let valor = null;
      if (resposta.status !== 404) {
        try { valor = await resposta.json(); } catch { throw new ErroTse('Resposta inválida do TSE.'); }
      }
      cache.delete(rel);
      cache.set(rel, { em: agora(), valor });
      while (cache.size > 512) cache.delete(cache.keys().next().value);
      return valor;
    })().finally(() => emVoo.delete(rel));
    emVoo.set(rel, promessa);
    return promessa;
  };
}

function candidato(c) {
  return { n: c.n, sq: c.sq, nome: c.nomeUrna === 'FLAVIO BOLSONARO' ? 'Flávio Bolsonaro' : nomeDeExibicao(c.nomeUrna), nomeUrna: c.nomeUrna, nomeCompleto: c.nome,
    partido: c.partido, situacao: c.situacao, situacaoTse: c.situacaoTse, destino: c.valido ? 'valido' : 'anulado',
    vice: c.vices.find((v) => v.tipo === 'v')?.nome ? nomeDeExibicao(c.vices.find((v) => v.tipo === 'v').nome) : null };
}

async function emLote(itens, executar) {
  const saida = new Array(itens.length);
  let indice = 0;
  await Promise.all(Array.from({ length: Math.min(6, itens.length) }, async () => {
    for (;;) { const i = indice++; if (i >= itens.length) return; saida[i] = await executar(itens[i]); }
  }));
  return saida;
}

export function criarFeedSegundoTurno({ ler = criarLeitorTse() } = {}) {
  async function eleicoes() {
    const config = await ler(CONFIG_ELEICOES);
    if (!config || config.f !== 'o' || !Array.isArray(config.pl)) throw new ErroDeContrato('Configuração oficial de eleições inválida.');
    return { presidente: eleicaoDoCargo(config, 1, 2)?.cd, estaduais: eleicaoDoCargo(config, 3, 2)?.cd };
  }

  async function resultado(eleicao, cargo, uf, municipio = '', zona = '') {
    const bruto = await ler(caminhoResultado(eleicao, cargo, uf, municipio, zona));
    if (!bruto) return null;
    const r = lerResultado(bruto, { cargo, eleicao, turno: 2, abrangencia: zona || municipio || uf });
    if (!r.geradoEm || !Number.isFinite(Date.parse(r.geradoEm))) throw new ErroDeContrato('Geração do resultado ausente.');
    // Não divulga contagens de um arquivo que o próprio TSE ainda bloqueou.
    return r.divulgacao ? r : null;
  }

  async function painel() {
    const ele = await eleicoes();
    const manifesto = { versao: 1, modo: 'oficial', origem: 'TSE — arquivos públicos de divulgação', eleicao: { ano: 2026, turno: 2, data: DATA, segundoTurno: DATA, eleicoes: Object.fromEntries(Object.entries(ele).filter(([, v]) => v)) }, seq: 0, t: 0, recarregarSegundos: 15, municipiosComZonas: [] };
    const catalogo = { versao: 1, presidente: [], governador: {}, senador: {}, partidos: {} };
    const resposta = { versao: 1, manifesto, catalogo, agora: null, aguardando: true };
    if (!ele.presidente) return resposta;
    const pedidos = [[1, ele.presidente, 'br'], ...UFS.map((uf) => [1, ele.presidente, uf.toLowerCase()]), [1, ele.presidente, 'zz'], ...(ele.estaduais ? UFS_GOVERNADOR.map((uf) => [3, ele.estaduais, uf.toLowerCase()]) : [])];
    const registros = await emLote(pedidos, async ([cargo, codigo, uf]) => ({ cargo, uf, r: await resultado(codigo, cargo, uf) }));
    const br = registros[0].r;
    if (!br) return resposta;
    const vazio = () => ({ secoes: 0, totalizadas: 0, eleitorado: 0, eleitoradoApurado: 0, comparecimento: 0, abstencao: 0, brancos: 0, nulos: 0, validos: 0, anuladosSJ: 0, votos: {}, anulados: {}, situacoes: {}, situacao: 'aguardando' });
    const agora = { versao: 1, turno: 2, seq: 0, t: 0, presidente: { br: compactar(br), uf: {}, zz: vazio(), regioes: {} }, governador: { uf: {} }, senador: { uf: {} } };
    catalogo.presidente = br.candidatos.map(candidato);
    let geracao = 0;
    for (const { cargo, uf, r } of registros) {
      if (!r) continue;
      geracao = Math.max(geracao, Date.parse(r.geradoEm));
      if (cargo === 1 && uf !== 'br') {
        if (uf === 'zz') agora.presidente.zz = compactar(r);
        else agora.presidente.uf[uf.toUpperCase()] = compactar(r);
      }
      if (cargo === 3) { agora.governador.uf[uf.toUpperCase()] = compactar(r); catalogo.governador[uf.toUpperCase()] = r.candidatos.map(candidato); }
      for (const ag of r.agremiacoes) for (const p of ag.partidos) catalogo.partidos[p.sigla] = { sigla: p.sigla, numero: p.n, federacao: p.federacao || null, nome: p.sigla };
    }
    agora.seq = manifesto.seq = geracao;
    agora.t = manifesto.t = minutosDaEleicao(br.totalizadoEm ?? br.geradoEm, DATA);
    agora.geradoNaFonte = manifesto.geradoNaFonte = new Date(geracao).toISOString();
    return { ...resposta, agora, aguardando: false };
  }

  /** Cadastro confirma UF, município e zona antes de montar qualquer caminho do TSE. */
  async function detalhe(rel) {
    const cat = /^cadastro\/(presidente|governador)\/(zz|[a-z]{2})\.json$/.exec(rel);
    if (cat) {
      const [, nome, uf] = cat;
      if (!(nome === 'presidente' ? [...UFS, 'ZZ'] : UFS_GOVERNADOR).includes(uf.toUpperCase())) return null;
      const ele = await eleicoes(), codigo = nome === 'presidente' ? ele.presidente : ele.estaduais;
      if (!codigo) return null;
      const cadastro = await ler(caminhoCadastro(codigo));
      const abr = cadastro?.abr?.find((a) => a.cd.toLowerCase() === uf);
      return abr ? { versao: 1, turno: 2, uf: uf.toUpperCase(), municipios: (abr.mu ?? []).map((m) => ({ tse: m.cd, zonas: (m.z ?? []).map(Number) })) } : null;
    }
    const m = /^resultados\/(presidente|governador)\/(br|zz|[a-z]{2})(?:\/(\d{5})(?:\/z(\d{1,4}))?)?\.json$/.exec(rel);
    if (!m) return null;
    const [, nome, uf, municipio, zona] = m;
    const cargo = nome === 'presidente' ? 1 : 3;
    if (cargo === 3 && !UFS_GOVERNADOR.includes(uf.toUpperCase())) return null;
    if (!['br', 'zz', ...UFS.map((u) => u.toLowerCase())].includes(uf) || (uf === 'br' && municipio)) return null;
    const ele = await eleicoes(), codigo = cargo === 1 ? ele.presidente : ele.estaduais;
    if (!codigo) return null;
    if (municipio || zona) {
      const cadastro = await ler(caminhoCadastro(codigo));
      const mun = cadastro?.abr?.find((a) => a.cd.toLowerCase() === uf)?.mu?.find((m) => m.cd === municipio);
      if (!mun || (zona && !(mun.z ?? []).some((z) => Number(z) === Number(zona)))) return null;
    }
    const r = await resultado(codigo, cargo, uf, municipio, zona);
    return r ? { versao: 1, turno: 2, resultado: compactar(r), candidatos: r.candidatos.map(candidato) } : null;
  }
  return { painel, detalhe };
}

export function criarRotaSegundoTurno(opcoes) {
  const feed = criarFeedSegundoTurno(opcoes);
  return async function tratar(req, res, rel) {
    if (!['GET', 'HEAD'].includes(req.method)) return erro(req, res, 405, 'Somente leitura.');
    try {
      const obj = rel === 'painel.json' ? await feed.painel() : await feed.detalhe(rel);
      if (!obj) return enviarJson(req, res, { erro: 'Ainda não há resultado publicado para esta abrangência.', semRegistro: true }, { status: 404, cache: CACHE_SEGUNDO_TURNO, etag: false });
      return enviarJson(req, res, obj, { cache: CACHE_SEGUNDO_TURNO });
    } catch (e) {
      res.setHeader('Retry-After', String(e.esperarSegundos ?? 15));
      return erro(req, res, 503, e instanceof ErroDeContrato ? `Lote do TSE rejeitado: ${e.message}` : e.message, { esperarSegundos: e.esperarSegundos ?? 15 });
    }
  };
}
