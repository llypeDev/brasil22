// Provider de SIMULAÇÃO — reconstrói uma apuração plausível e determinística a partir do
// resultado final oficial publicado em dados/publicado/oficial.
//
// NÃO são resultados oficiais em nenhum instante intermediário. Toda resposta carrega
// modo:"simulacao". O instante final coincide com o arquivo oficial do TSE.
//
// Modelo:
//  • Cada município i totaliza entre S_i e E_i (minutos desde 00:00 de 04/10). A ordem de
//    término combina um hash estável do código TSE, um viés por região e o porte (seções).
//    Os horários são mapeados pela inversa da curva nacional de seções da série de
//    referência, de modo que a fração de seções ao longo da noite acompanhe a observada.
//    Os vieses são calibrados (descida por coordenadas) para aproximar a evolução das
//    parcelas dos dois primeiros na mesma série.
//  • Dentro do município, votos, brancos, nulos, comparecimento e eleitorado apurado
//    crescem na proporção das seções totalizadas: valor(t) = round(final × q_i(t)).
//    UF e Brasil são somas dos municípios (exterior: cidades), logo sempre coerentes.
//  • Municípios com mais de uma zona: cada zona tem sua janela; o município é a soma.
//  • Deputados: só o agregado por UF existe; cresce com a fração de seções da UF, e a
//    situação (eleito/suplente) aparece apenas quando a UF chega a 100%.
//  • Definições (eleito, 2º turno, vagas do Senado) usam limites conservadores: votos ainda
//    não apurados = eleitorado das seções restantes × comparecimento × taxa de válidos
//    observados. Só se declara o que coincide com a situação oficial final.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const T_INICIO = 1012;   // 16h52: aguardando
const T_ABERTURA = 1020; // 17h00: primeiras seções
const T_FIM = 1620;      // 03h00 do dia seguinte: última seção da série de referência
const T_CICLO = 1650;    // após o fim, mantém o resultado final antes de recomeçar
const REGIAO = { AC: 'N', AP: 'N', AM: 'N', PA: 'N', RO: 'N', RR: 'N', TO: 'N', AL: 'NE', BA: 'NE', CE: 'NE', MA: 'NE', PB: 'NE', PE: 'NE', PI: 'NE', RN: 'NE', SE: 'NE', DF: 'CO', GO: 'CO', MT: 'CO', MS: 'CO', ES: 'SE', MG: 'SE', RJ: 'SE', SP: 'SE', PR: 'S', RS: 'S', SC: 'S' };
const NOME_REGIAO = { N: 'Norte', NE: 'Nordeste', CO: 'Centro-Oeste', SE: 'Sudeste', S: 'Sul' };
const CAMPOS = ['secoes', 'totalizadas', 'eleitorado', 'comparecimento', 'brancos', 'nulos', 'validos', 'anuladosSJ'];

function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const suave = (x) => x * x * (3 - 2 * x);
const fracaoSecoes = (sec, p) => (sec > 0 && p > 0 ? Math.floor(sec * suave(clamp01(p)) + 1e-9) / sec : 0);

/** Valores finais de uma coleção colunar em arrays tipados. */
function pacote(col, validoPorCand) {
  const f = (k) => Float64Array.from(col[k], (v) => v ?? 0);
  return {
    n: col.tse.length,
    nulo: Uint8Array.from(col.secoes, (v) => (v == null ? 1 : 0)),
    sec: f('secoes'), ele: f('eleitorado'), comp: f('comparecimento'), bra: f('brancos'), nul: f('nulos'), asj: f('anuladosSJ'),
    vot: col.votos.map((v) => Float64Array.from(v, (x) => x ?? 0)),
    cand: col.candidatos,
    valido: validoPorCand,
  };
}
function zeros(nc) {
  return { secoes: 0, totalizadas: 0, eleitorado: 0, eleitoradoApurado: 0, comparecimento: 0, brancos: 0, nulos: 0, anuladosSJ: 0, v: new Float64Array(nc) };
}
/** Soma, num acumulador, a contribuição do item i com fração q (arredondada como nos arquivos). */
function contribuir(acc, pk, i, q, sinal = 1) {
  if (pk.nulo[i]) return;
  if (q <= 0) return;
  acc.totalizadas += sinal * Math.round(pk.sec[i] * q);
  acc.eleitoradoApurado += sinal * Math.round(pk.ele[i] * q);
  acc.comparecimento += sinal * Math.round(pk.comp[i] * q);
  acc.brancos += sinal * Math.round(pk.bra[i] * q);
  acc.nulos += sinal * Math.round(pk.nul[i] * q);
  acc.anuladosSJ += sinal * Math.round(pk.asj[i] * q);
  for (let c = 0; c < pk.vot.length; c++) acc.v[c] += sinal * Math.round(pk.vot[c][i] * q);
}
function base(acc, pk, i) {
  if (pk.nulo[i]) return;
  acc.secoes += pk.sec[i];
  acc.eleitorado += pk.ele[i];
}
/** Converte o acumulador no formato de resultado do feed. */
function resultado(acc, pk, extra = {}) {
  const votos = {}; const anulados = {};
  let validos = 0;
  pk.cand.forEach((n, c) => {
    if (pk.valido[c]) { votos[n] = acc.v[c]; validos += acc.v[c]; } else anulados[n] = acc.v[c];
  });
  return {
    secoes: acc.secoes, totalizadas: acc.totalizadas, eleitorado: acc.eleitorado, eleitoradoApurado: acc.eleitoradoApurado,
    comparecimento: acc.comparecimento, abstencao: Math.max(0, acc.eleitoradoApurado - acc.comparecimento),
    brancos: acc.brancos, nulos: acc.nulos, validos, anuladosSJ: acc.anuladosSJ, votos, anulados, ...extra,
  };
}

// `ancora` é o instante real (ms) em que o relógio simulado está no início do ciclo. O padrão é
// a carga do processo; em funções sem servidor (Vercel), SIM_ANCORA=0 faz todas as instâncias
// mostrarem o mesmo instante, porque o relógio passa a depender só do horário real.
export async function criarSimulacao({ diretorio, geoMundo, velocidade = Number(process.env.SIM_VELOCIDADE ?? 10), tFixo = process.env.SIM_T_FIXO, ancora = process.env.SIM_ANCORA ? Number(process.env.SIM_ANCORA) : Date.now() }) {
  const inicioCarga = Date.now();
  const lerJson = async (rel) => JSON.parse(await readFile(join(diretorio, rel), 'utf8'));
  if (!existsSync(join(diretorio, 'manifesto.json'))) throw new Error('Dados oficiais ausentes: rode npm run dados:tse:normalizar.');
  const manifesto = await lerJson('manifesto.json');
  const catalogo = await lerJson('catalogo.json');
  const final = await lerJson('agora.json');
  const mp = await lerJson('municipios-presidente.json');
  const exterior = await lerJson('exterior.json');
  const historicoRef = await lerJson('historico.json');
  const presidente2022 = await lerJson('presidente-2022.json');
  const senadoMantidas = await lerJson('senado-mantidas.json');
  const ufsLista = Object.keys(final.presidente.uf).filter((u) => u !== 'ZZ').sort();
  const porUf = {};
  for (const f of await readdir(join(diretorio, 'uf'))) porUf[f.slice(0, 2).toUpperCase()] = await lerJson(`uf/${f}`);
  const deputados = {};
  for (const f of await readdir(join(diretorio, 'deputados'))) if (/^[a-z]{2}\.json$/.test(f) && f !== 'br.json') deputados[f.slice(0, 2).toUpperCase()] = await lerJson(`deputados/${f}`);
  const zonasFinais = {};
  for (const f of await readdir(join(diretorio, 'zonas'))) zonasFinais[f.replace('.json', '')] = await lerJson(`zonas/${f}`);

  const N = mp.tse.length;
  const iDoTse = new Map(mp.tse.map((t, i) => [t, i]));
  const ufDe = new Array(N);
  const grupoUf = new Int32Array(N).fill(-1);
  for (const [UF, d] of Object.entries(porUf)) for (const tse of d.governador.tse) { const i = iDoTse.get(tse); if (i != null) { ufDe[i] = UF; grupoUf[i] = ufsLista.indexOf(UF); } }

  // ---------- curva de referência: fração de seções × tempo ----------
  const pontos = historicoRef.pontos.length ? historicoRef.pontos : [{ t: T_ABERTURA, totalizadas: 0, secoes: 1, votos: {} }, { t: T_FIM, totalizadas: 1, secoes: 1, votos: {} }];
  const curva = [{ t: T_ABERTURA, f: 0 }, ...pontos.map((p) => ({ t: p.t, f: p.totalizadas / p.secoes }))].filter((p, i, a) => i === 0 || p.f >= a[i - 1].f);
  const tempoDaFracao = (f) => {
    if (f <= 0) return T_ABERTURA;
    for (let k = 1; k < curva.length; k++) if (curva[k].f >= f) {
      const a = curva[k - 1], b = curva[k];
      return a.t + (b.t - a.t) * ((f - a.f) / Math.max(1e-9, b.f - a.f));
    }
    return curva.at(-1).t;
  };

  const secoes = Float64Array.from(mp.secoes, (v) => v ?? 0);
  let maxSec = 0; for (const s of secoes) if (s > maxSec) maxSec = s;
  const hashes = Float64Array.from(mp.tse, (t) => hash01(`m${t}`));
  const porteRel = Float64Array.from(secoes, (s) => Math.log10(1 + s) / Math.log10(1 + maxSec));
  const regiaoIdx = Int8Array.from(ufDe, (u) => ['N', 'NE', 'CO', 'SE', 'S'].indexOf(REGIAO[u]));
  const totalSec = secoes.reduce((a, b) => a + b, 0);
  const indices = Int32Array.from({ length: N }, (_, i) => i);

  function janelas(vies) {
    const chave = new Float64Array(N);
    for (let i = 0; i < N; i++) chave[i] = hashes[i] + (vies.regiao[regiaoIdx[i]] ?? 0) + porteRel[i] * vies.porte;
    const ordem = Array.from(indices).sort((a, b) => chave[a] - chave[b]);
    const S = new Float64Array(N), E = new Float64Array(N);
    let acc = 0;
    for (const i of ordem) {
      acc += secoes[i];
      const dur = 8 + 70 * Math.sqrt(secoes[i] / maxSec);
      const meio = tempoDaFracao((acc - secoes[i] / 2) / totalSec);
      S[i] = Math.max(T_ABERTURA + 1, meio - dur / 2);
      E[i] = Math.min(T_FIM, Math.max(S[i] + 1, meio + dur / 2));
    }
    return { S, E };
  }

  // ---------- calibração ----------
  const lideres = catalogo.presidente.slice(0, 2).map((c) => c.n);
  const idxLider = lideres.map((n) => mp.candidatos.indexOf(n));
  const vA = Float64Array.from(mp.votos[idxLider[0]], (x) => x ?? 0);
  const vB = Float64Array.from(mp.votos[idxLider[1]], (x) => x ?? 0);
  const vV = Float64Array.from(mp.validos, (x) => x ?? 0);
  const alvos = pontos
    .filter((p) => p.totalizadas / p.secoes >= 0.02 && p.totalizadas < p.secoes)
    .filter((_, k, a) => k % Math.max(1, Math.floor(a.length / 18)) === 0)
    .map((p) => { const tot = Object.values(p.votos).reduce((x, y) => x + y, 0); return { t: p.t, a: p.votos[lideres[0]] / tot, b: p.votos[lideres[1]] / tot }; });
  const custo = (vies) => {
    const { S, E } = janelas(vies);
    let erro = 0;
    for (const alvo of alvos) {
      let a = 0, b = 0, v = 0;
      for (let i = 0; i < N; i++) {
        const q = clamp01((alvo.t - S[i]) / (E[i] - S[i]));
        if (q > 0) { a += vA[i] * q; b += vB[i] * q; v += vV[i] * q; }
      }
      if (v) erro += (a / v - alvo.a) ** 2 + (b / v - alvo.b) ** 2;
    }
    return erro;
  };
  let vies = { regiao: [0, 0, 0, 0, 0], porte: 0 };
  let erroAtual = custo(vies);
  const erroInicial = erroAtual;
  const grade = [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2, 1.5];
  for (let rodada = 0; rodada < 3 && alvos.length; rodada++) {
    let melhorou = false;
    for (const param of ['r1', 'r0', 'r3', 'r2', 'porte']) {
      for (const val of grade) {
        const cand = { regiao: [...vies.regiao], porte: vies.porte };
        if (param === 'porte') cand.porte = val; else cand.regiao[Number(param[1])] = val;
        const e = custo(cand);
        if (e < erroAtual - 1e-9) { erroAtual = e; vies = cand; melhorou = true; }
      }
    }
    if (!melhorou) break;
  }
  const { S, E } = janelas(vies);
  const calibracao = {
    vies: { Norte: vies.regiao[0], Nordeste: vies.regiao[1], 'Centro-Oeste': vies.regiao[2], Sudeste: vies.regiao[3], Sul: vies.regiao[4], porte: vies.porte },
    erroQuadratico: Number(erroAtual.toFixed(5)), erroSemVies: Number(erroInicial.toFixed(5)), pontosComparados: alvos.length,
  };

  // Zonas: janelas próprias dentro da janela do município
  const zonaJanela = {};
  for (const [tse, z] of Object.entries(zonasFinais)) {
    const i = iDoTse.get(tse);
    if (i == null) continue;
    zonaJanela[tse] = z.tse.map((zona) => {
      const ini = S[i] + (E[i] - S[i]) * hash01(`z${tse}${zona}`) * 0.5;
      const fim = Math.min(T_FIM, ini + (E[i] - S[i]) * (0.4 + 0.5 * hash01(`f${tse}${zona}`)));
      return [ini, Math.max(ini + 1, fim)];
    });
  }
  const comZonas = Object.keys(zonaJanela).map((tse) => [iDoTse.get(tse), tse]);

  // Exterior: urnas fecham às 17h locais; divulgação só após 17h de Brasília
  const fusoCidade = new Map((geoMundo?.cidades ?? []).map((c) => [c.tse, c.fuso]));
  const fechamentoBrasilia = (tz) => {
    if (!tz) return T_ABERTURA;
    const ref = Date.parse('2026-10-04T17:00:00Z');
    const g = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ref)).map((p) => [p.type, p.value]));
    const deslocamento = (Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute) - ref) / 60000;
    return 17 * 60 - deslocamento - 180; // 17h locais em minutos de Brasília (UTC−3)
  };
  const cidades = exterior.cidades;
  const NC = cidades.tse.length;
  const cS = new Float64Array(NC), cE = new Float64Array(NC);
  cidades.tse.forEach((tse, k) => {
    const abre = Math.max(T_ABERTURA, fechamentoBrasilia(fusoCidade.get(tse))) + 5 + 20 * hash01(`c${tse}`);
    cS[k] = abre;
    cE[k] = Math.min(T_FIM, abre + 40 + 260 * hash01(`d${tse}`));
  });

  // ---------- frações por instante ----------
  const fracoesNacionais = (t) => {
    const f = new Float64Array(N);
    for (let i = 0; i < N; i++) f[i] = fracaoSecoes(secoes[i], (t - S[i]) / (E[i] - S[i]));
    for (const [i, tse] of comZonas) {
      const z = zonasFinais[tse]; const jan = zonaJanela[tse];
      let tot = 0, sec = 0;
      for (let k = 0; k < jan.length; k++) { const s = z.secoes[k] ?? 0; sec += s; tot += Math.floor(s * suave(clamp01((t - jan[k][0]) / (jan[k][1] - jan[k][0]))) + 1e-9); }
      f[i] = sec ? tot / sec : 0;
    }
    return f;
  };
  const fracoesCidades = (t) => {
    const f = new Float64Array(NC);
    for (let k = 0; k < NC; k++) f[k] = fracaoSecoes(cidades.secoes[k] ?? 0, (t - cS[k]) / (cE[k] - cS[k]));
    return f;
  };

  // ---------- pacotes ----------
  const validoDe = (lista, n) => (lista ?? []).find((c) => c.n === n)?.destino !== 'anulado';
  const pkPres = pacote(mp, mp.candidatos.map((n) => validoDe(catalogo.presidente, n)));
  const pkExt = pacote(cidades, cidades.candidatos.map((n) => validoDe(catalogo.presidente, n)));
  const pkUf = {};
  for (const UF of ufsLista) {
    const d = porUf[UF];
    pkUf[UF] = {
      nat: Int32Array.from(d.governador.tse, (tse) => iDoTse.get(tse) ?? -1),
      governador: pacote(d.governador, d.governador.candidatos.map((n) => validoDe(catalogo.governador[UF], n))),
      senador: pacote(d.senador, d.senador.candidatos.map((n) => validoDe(catalogo.senador[UF], n))),
    };
  }

  // ---------- regra de definição (ver cabeçalho) ----------
  function definir(r, situacaoFinal, situacoesFinais, vagas = 1) {
    if (!r.totalizadas) return { situacao: 'aguardando', situacoes: {} };
    if (r.totalizadas >= r.secoes) return { situacao: situacaoFinal, situacoes: situacoesFinais };
    const ordem = Object.entries(r.votos).sort((a, b) => b[1] - a[1]);
    const restEleit = Math.max(0, r.eleitorado - r.eleitoradoApurado);
    const comp = r.eleitoradoApurado ? r.comparecimento / r.eleitoradoApurado : 0.85;
    const taxaVal = r.comparecimento ? r.validos / r.comparecimento : 0.95;
    const resto = restEleit * Math.min(1, comp * 1.05) * Math.min(1, taxaVal * 1.02);
    const v = (k) => ordem[k]?.[1] ?? 0;
    const finaisEleitos = Object.entries(situacoesFinais).filter(([, s]) => s === 'eleito').map(([n]) => n);
    const finais2t = Object.entries(situacoesFinais).filter(([, s]) => s === 'segundo-turno').map(([n]) => n);
    if (vagas === 2) {
      const par = ordem.slice(0, 2).map(([n]) => n);
      if (finaisEleitos.length === 2 && par.every((n) => finaisEleitos.includes(n)) && v(2) + resto < v(1)) return { situacao: 'eleitos', situacoes: situacoesFinais };
      if (finaisEleitos.includes(ordem[0]?.[0]) && v(2) + resto < v(0)) return { situacao: 'parcial', situacoes: { [ordem[0][0]]: 'eleito' } };
      return { situacao: 'apurando', situacoes: {} };
    }
    if (situacaoFinal === 'eleito' && finaisEleitos[0] === ordem[0]?.[0] && v(0) > 0.5 * (r.validos + resto)) return { situacao: 'eleito', situacoes: situacoesFinais };
    if (situacaoFinal === 'segundo-turno' && finais2t.length === 2 && ordem.slice(0, 2).every(([n]) => finais2t.includes(n)) && v(2) + resto < v(1) && v(0) + resto < 0.5 * (r.validos + resto)) {
      return { situacao: 'segundo-turno', situacoes: situacoesFinais };
    }
    return { situacao: 'apurando', situacoes: {} };
  }

  // ---------- agregação completa de um instante (acesso aleatório) ----------
  function agregarTudo(t) {
    const fn = fracoesNacionais(t);
    const pres = ufsLista.map(() => zeros(pkPres.cand.length));
    for (let i = 0; i < N; i++) { const g = grupoUf[i]; if (g < 0) continue; base(pres[g], pkPres, i); contribuir(pres[g], pkPres, i, fn[i]); }
    const est = {};
    for (const UF of ufsLista) {
      const pu = pkUf[UF];
      est[UF] = {};
      for (const ch of ['governador', 'senador']) {
        const pk = pu[ch]; const acc = zeros(pk.cand.length);
        for (let k = 0; k < pk.n; k++) { base(acc, pk, k); contribuir(acc, pk, k, pu.nat[k] >= 0 ? fn[pu.nat[k]] : 0); }
        est[UF][ch] = acc;
      }
    }
    const fc = fracoesCidades(t);
    const ext = zeros(pkExt.cand.length);
    for (let k = 0; k < NC; k++) { base(ext, pkExt, k); contribuir(ext, pkExt, k, fc[k]); }
    return { pres, est, ext };
  }

  function montarAgora({ pres, est, ext }, definido = () => null) {
    const out = { presidente: { uf: {}, regioes: {} }, governador: { uf: {} }, senador: { uf: {} } };
    const brAcc = zeros(pkPres.cand.length);
    const somarAcc = (a, b) => { for (const k of ['secoes', 'totalizadas', 'eleitorado', 'eleitoradoApurado', 'comparecimento', 'brancos', 'nulos', 'anuladosSJ']) a[k] += b[k]; for (let c = 0; c < a.v.length; c++) a.v[c] += b.v[c]; };
    const regAcc = {};
    ufsLista.forEach((UF, g) => {
      const r = resultado(pres[g], pkPres);
      const f = final.presidente.uf[UF];
      Object.assign(r, definir(r, f.situacao, f.situacoes));
      out.presidente.uf[UF] = r;
      somarAcc(brAcc, pres[g]);
      const reg = NOME_REGIAO[REGIAO[UF]];
      somarAcc(regAcc[reg] ??= zeros(pkPres.cand.length), pres[g]);
      for (const ch of ['governador', 'senador']) {
        const ru = resultado(est[UF][ch], pkUf[UF][ch]);
        const fu = final[ch].uf[UF];
        Object.assign(ru, definir(ru, fu.situacao, fu.situacoes, fu.vagas ?? 1), { vagas: fu.vagas ?? 1 });
        const d = definido(ch, UF); if (d != null) ru.definido = d;
        out[ch].uf[UF] = ru;
      }
    });
    for (const [reg, acc] of Object.entries(regAcc)) out.presidente.regioes[reg] = resultado(acc, pkPres);
    const zz = resultado(ext, pkExt);
    zz.situacao = zz.totalizadas >= zz.secoes ? final.presidente.zz.situacao : zz.totalizadas ? 'apurando' : 'aguardando';
    zz.situacoes = {};
    out.presidente.zz = zz;
    out.presidente.uf.ZZ = zz;
    somarAcc(brAcc, ext);
    const br = resultado(brAcc, pkPres);
    Object.assign(br, definir(br, final.presidente.br.situacao, final.presidente.br.situacoes));
    const d = definido('presidente', 'BR'); if (d != null) br.definido = d;
    out.presidente.br = br;
    return out;
  }

  // ---------- linha do tempo (incremental, calculada uma vez) ----------
  const eventos = [];
  const definidoEm = {};
  const serieBr = new Map(); // t → { totalizadas, secoes, votos, situacao }
  const totUf = new Map();   // t → Float64Array(totalizadas por UF)
  {
    const pres = ufsLista.map(() => zeros(pkPres.cand.length));
    for (let i = 0; i < N; i++) if (grupoUf[i] >= 0) base(pres[grupoUf[i]], pkPres, i);
    const est = {};
    for (const UF of ufsLista) {
      est[UF] = {};
      for (const ch of ['governador', 'senador']) { const pk = pkUf[UF][ch]; const acc = zeros(pk.cand.length); for (let k = 0; k < pk.n; k++) base(acc, pk, k); est[UF][ch] = acc; }
    }
    const localDe = new Int32Array(N).fill(-1);
    for (const UF of ufsLista) pkUf[UF].nat.forEach((i, k) => { if (i >= 0) localDe[i] = k; });
    let fAnt = new Float64Array(N);
    let anterior = null;
    const lider = (r) => { let m = null, mv = -1; for (const [n, v] of Object.entries(r.votos)) if (v > mv) { mv = v; m = n; } return m; };
    for (let t = T_ABERTURA; t <= T_FIM; t++) {
      const fn = fracoesNacionais(t);
      for (let i = 0; i < N; i++) {
        if (fn[i] === fAnt[i]) continue;
        const g = grupoUf[i]; if (g < 0) continue;
        contribuir(pres[g], pkPres, i, fAnt[i], -1);
        contribuir(pres[g], pkPres, i, fn[i], 1);
        const UF = ufsLista[g]; const k = localDe[i];
        if (k >= 0) for (const ch of ['governador', 'senador']) { contribuir(est[UF][ch], pkUf[UF][ch], k, fAnt[i], -1); contribuir(est[UF][ch], pkUf[UF][ch], k, fn[i], 1); }
      }
      fAnt = fn;
      const fc = fracoesCidades(t);
      const ext = zeros(pkExt.cand.length);
      for (let k = 0; k < NC; k++) { base(ext, pkExt, k); contribuir(ext, pkExt, k, fc[k]); }
      const a = montarAgora({ pres, est, ext });
      const br = a.presidente.br;
      serieBr.set(t, { totalizadas: br.totalizadas, secoes: br.secoes, votos: { ...br.votos }, situacao: br.situacao });
      totUf.set(t, Float64Array.from(ufsLista, (UF) => a.presidente.uf[UF].totalizadas));
      if (anterior) {
        const ab = anterior.presidente.br;
        if (br.totalizadas > ab.totalizadas) {
          eventos.push({ id: `pres-br-${t}`, tipo: 'secoes', t, cargo: 'presidente', uf: 'BR', secoes: br.totalizadas - ab.totalizadas, totalizadas: br.totalizadas, totalSecoes: br.secoes, validos: br.validos, votos: Object.fromEntries(lideres.map((n) => [n, br.votos[n]])) });
        }
        if (ab.totalizadas > br.secoes * 0.02 && lider(ab) !== lider(br)) eventos.push({ id: `pres-br-virada-${t}`, tipo: 'virada', t, cargo: 'presidente', uf: 'BR', candidatos: [lider(br), lider(ab)] });
        const disputas = [['presidente', 'BR', br, ab], ...ufsLista.flatMap((UF) => [['governador', UF, a.governador.uf[UF], anterior.governador.uf[UF]], ['senador', UF, a.senador.uf[UF], anterior.senador.uf[UF]]])];
        for (const [cargo, chave, r, ra] of disputas) {
          if (r.situacao !== ra.situacao && !['apurando', 'aguardando'].includes(r.situacao)) {
            const cands = Object.entries(r.situacoes).filter(([, s]) => s === 'eleito' || s === 'segundo-turno').map(([n]) => n);
            eventos.push({ id: `${cargo}-${chave}-${r.situacao}`, tipo: 'definicao', t, cargo, uf: chave, situacao: r.situacao, candidatos: cands });
            if (r.situacao !== 'parcial') definidoEm[`${cargo}-${chave}`] = t;
          }
          if (cargo === 'governador' && ra.totalizadas > ra.secoes * 0.05 && r.situacao === 'apurando') {
            const l1 = lider(r), l0 = lider(ra);
            if (l1 && l0 && l1 !== l0) eventos.push({ id: `governador-${chave}-virada-${t}`, tipo: 'virada', t, cargo, uf: chave, candidatos: [l1, l0] });
          }
        }
        if (br.totalizadas >= br.secoes && ab.totalizadas < ab.secoes) eventos.push({ id: 'pres-br-fim', tipo: 'fim', t, cargo: 'presidente', uf: 'BR' });
      }
      anterior = a;
    }
    eventos.sort((x, y) => y.t - x.t || x.id.localeCompare(y.id));
  }

  // ---------- relógio ----------
  const inicioReal = ancora;
  let fixo = tFixo != null && tFixo !== '' ? Number(tFixo) : null;
  let vel = velocidade;
  const relogio = () => {
    if (fixo != null) return Math.round(fixo);
    const dec = ((Date.now() - inicioReal) / 60000) * vel;
    return Math.floor(T_INICIO + (dec % (T_CICLO - T_INICIO)));
  };

  // ---------- respostas ----------
  const cache = new Map();
  const memo = (chave, f) => {
    if (cache.has(chave)) { const v = cache.get(chave); cache.delete(chave); cache.set(chave, v); return v; }
    const v = f();
    cache.set(chave, v);
    if (cache.size > 160) cache.delete(cache.keys().next().value);
    return v;
  };
  const efetivo = (t) => Math.max(T_ABERTURA - 1, Math.min(T_FIM, t));
  const agoraEm = (t) => memo(`ag${t}`, () => montarAgora(agregarTudo(t), (cargo, uf) => { const d = definidoEm[`${cargo}-${uf}`]; return d != null && d <= t ? d : null; }));

  function colunasEm(col, fr, mapa, validoPorCand) {
    const n = col.tse.length;
    const out = { candidatos: col.candidatos, tse: col.tse };
    for (const k of CAMPOS) out[k] = new Array(n);
    out.votos = col.candidatos.map(() => new Array(n));
    for (let i = 0; i < n; i++) {
      if (col.secoes[i] == null) { for (const k of CAMPOS) out[k][i] = null; for (const v of out.votos) v[i] = null; continue; }
      const q = mapa ? (mapa[i] >= 0 ? fr[mapa[i]] : 0) : fr[i];
      out.secoes[i] = col.secoes[i];
      out.eleitorado[i] = col.eleitorado[i];
      out.totalizadas[i] = Math.round(col.secoes[i] * q);
      for (const k of ['comparecimento', 'brancos', 'nulos', 'anuladosSJ']) out[k][i] = Math.round((col[k][i] ?? 0) * q);
      let val = 0;
      for (let c = 0; c < col.votos.length; c++) { const x = Math.round((col.votos[c][i] ?? 0) * q); out.votos[c][i] = x; if (validoPorCand[c]) val += x; }
      out.validos[i] = val;
    }
    return out;
  }
  const presidenteMunicipal = (t) => memo(`pm${t}`, () => colunasEm(mp, fracoesNacionais(t), null, pkPres.valido));
  const ufMunicipal = (UF, t) => memo(`uf${UF}${t}`, () => {
    const fn = fracoesNacionais(t);
    const pu = pkUf[UF];
    return { versao: 1, uf: UF, governador: colunasEm(porUf[UF].governador, fn, pu.nat, pu.governador.valido), senador: colunasEm(porUf[UF].senador, fn, pu.nat, pu.senador.valido) };
  });
  const exteriorEm = (t) => memo(`ex${t}`, () => colunasEm(cidades, fracoesCidades(t), null, pkExt.valido));

  function paisesEm(t) {
    const ex = exteriorEm(t);
    const paisDe = new Map((geoMundo?.cidades ?? []).map((c) => [c.tse, c.pais]));
    const out = {};
    ex.tse.forEach((tse, k) => {
      const p = paisDe.get(tse); if (!p || ex.secoes[k] == null) return;
      const r = out[p] ??= { secoes: 0, totalizadas: 0, eleitorado: 0, comparecimento: 0, brancos: 0, nulos: 0, validos: 0, anuladosSJ: 0, votos: {} };
      for (const k2 of CAMPOS) r[k2] += ex[k2][k] ?? 0;
      ex.candidatos.forEach((n, c) => { r.votos[n] = (r.votos[n] ?? 0) + (ex.votos[c][k] ?? 0); });
    });
    return out;
  }

  function fracaoUf(UF, t) {
    const te = Math.min(T_FIM, t);
    if (te < T_ABERTURA) return 0;
    const g = ufsLista.indexOf(UF);
    const tot = totUf.get(te)?.[g] ?? 0;
    return tot / (final.presidente.uf[UF].secoes || 1);
  }

  function deputadosEm(UF, t) {
    const d = deputados[UF];
    const q = fracaoUf(UF, t);
    const pronto = q >= 1;
    const out = structuredClone(d);
    for (const casa of ['federal', 'estadual', 'distrital']) {
      const c = out[casa];
      if (!c) continue;
      c.candidatos = c.candidatos.map((x) => [x[0], x[1], x[2], Math.round(x[3] * q), pronto ? x[4] : (q > 0 ? 'apurando' : 'aguardando'), x[5], x[6]]).sort((p, r) => r[3] - p[3]);
      for (const k of Object.keys(c.totais)) if (!['secoes', 'eleitorado'].includes(k)) c.totais[k] = Math.round(c.totais[k] * q);
      c.totais.totalizadas = Math.round(final.presidente.uf[UF].secoes * q);
      c.eleitos = pronto ? d[casa].eleitos : 0;
      c.situacao = pronto ? d[casa].situacao : q > 0 ? 'apurando' : 'aguardando';
      for (const p of Object.values(c.partidos)) { p.nominais = Math.round(p.nominais * q); p.legenda = Math.round(p.legenda * q); p.validos = Math.round(p.validos * q); if (!pronto) p.cadeiras = 0; }
      if (!pronto) c.agremiacoes = c.agremiacoes.map((g) => ({ ...g, vagas: null }));
    }
    return out;
  }

  function deputadosBr(t) {
    const resumo = { federal: { vagas: 0, eleitos: 0, partidos: {}, ranking: [] }, estadual: { vagas: 0, eleitos: 0, partidos: {}, ranking: [] }, porUf: {} };
    for (const UF of Object.keys(deputados)) {
      const d = deputadosEm(UF, t);
      for (const [casa, chave] of [['federal', 'federal'], ['estadual', 'estadual'], ['distrital', 'estadual']]) {
        const c = d[casa]; if (!c) continue;
        const cadeiras = {}; const votos = {};
        for (const [p, info] of Object.entries(c.partidos)) { if (info.cadeiras) cadeiras[p] = info.cadeiras; votos[p] = info.validos; }
        (resumo.porUf[UF] ??= {})[chave] = { vagas: c.vagas, eleitos: c.eleitos, situacao: c.situacao, cadeiras, votos, totalizadas: c.totais.totalizadas, secoes: c.totais.secoes };
        resumo[chave].vagas += c.vagas; resumo[chave].eleitos += c.eleitos;
        for (const [p, info] of Object.entries(c.partidos)) if (info.cadeiras) resumo[chave].partidos[p] = (resumo[chave].partidos[p] ?? 0) + info.cadeiras;
        for (const x of c.candidatos) resumo[chave].ranking.push([x[0], x[1], x[2], UF, casa === 'federal' ? 'f' : casa === 'distrital' ? 'd' : 'e', x[3], x[4], x[5]]);
      }
    }
    for (const k of ['federal', 'estadual']) { resumo[k].ranking.sort((a, b) => b[5] - a[5]); resumo[k].totalCandidatos = resumo[k].ranking.length; resumo[k].ranking = resumo[k].ranking.slice(0, 120); }
    return { versao: 1, campos: ['numero', 'nome', 'partido', 'uf', 'casa', 'votos', 'situacao', 'sq'], ...resumo };
  }

  function zonasEm(tse, t) {
    const z = zonasFinais[tse];
    if (!z) return null;
    const jan = zonaJanela[tse];
    const fr = Float64Array.from(z.tse, (_, k) => fracaoSecoes(z.secoes[k] ?? 0, (t - jan[k][0]) / (jan[k][1] - jan[k][0])));
    return { versao: 1, municipio: z.municipio, uf: z.uf, cargo: 'presidente', ...colunasEm(z, fr, null, pkPres.valido) };
  }

  const minutosComDados = (t) => {
    const out = []; let ult = -1;
    for (let k = T_ABERTURA; k <= Math.min(t, T_FIM); k++) { const s = serieBr.get(k); if (s && s.totalizadas !== ult) { out.push(k); ult = s.totalizadas; } }
    return out;
  };

  function vazio() {
    const z = (r, extra = {}) => ({ secoes: r.secoes, totalizadas: 0, eleitorado: r.eleitorado, eleitoradoApurado: 0, comparecimento: 0, abstencao: 0, brancos: 0, nulos: 0, validos: 0, anuladosSJ: 0, votos: {}, anulados: {}, situacao: 'aguardando', situacoes: {}, ...extra });
    const out = { presidente: { br: z(final.presidente.br), uf: {}, regioes: {}, zz: z(final.presidente.zz) }, governador: { uf: {} }, senador: { uf: {} } };
    for (const UF of ufsLista) {
      out.presidente.uf[UF] = z(final.presidente.uf[UF]);
      out.governador.uf[UF] = z(final.governador.uf[UF], { vagas: 1 });
      out.senador.uf[UF] = z(final.senador.uf[UF], { vagas: final.senador.uf[UF].vagas ?? 2 });
    }
    out.presidente.uf.ZZ = out.presidente.zz;
    return out;
  }

  const meta = (t) => ({ modo: 'simulacao', t, aviso: 'Simulação da apuração construída a partir do resultado final oficial. Valores parciais não são oficiais.' });

  /** Responde a um arquivo do feed no instante t. Devolve objeto ou null (inexistente). */
  function arquivo(rel, t) {
    const tt = Math.max(T_INICIO, Math.min(T_CICLO, Math.round(t)));
    const te = efetivo(tt);
    const antes = tt < T_ABERTURA;
    switch (rel) {
      case 'manifesto.json': return { ...manifesto, ...meta(tt), origem: 'Simulação determinística a partir do resultado oficial do TSE', seq: tt, calibracao, relogio: { inicio: T_INICIO, abertura: T_ABERTURA, fim: T_FIM, ciclo: T_CICLO, velocidade: vel, fixo }, avisos: [] };
      case 'catalogo.json': return catalogo;
      case 'agora.json': return { versao: 1, ...meta(tt), seq: tt, turno: 1, ...(antes ? vazio() : agoraEm(te)) };
      case 'municipios-presidente.json': return { versao: 1, cargo: 'presidente', ...meta(tt), ...presidenteMunicipal(antes ? 0 : te) };
      case 'exterior.json': return { versao: 1, cargo: 'presidente', ...meta(tt), cidades: exteriorEm(antes ? 0 : te), paises: paisesEm(antes ? 0 : te) };
      case 'historico.json': return { versao: 1, origem: 'simulacao', descricao: 'Série gerada pela simulação; não oficial.', pontos: minutosComDados(tt).map((k) => ({ t: k, ...serieBr.get(k) })) };
      case 'eventos.json': return { versao: 1, ...meta(tt), eventos: eventos.filter((e) => e.t <= tt) };
      case 'arquivo-indice.json': { const m = minutosComDados(tt); return { versao: 1, origem: 'simulacao', snapshots: m, agregados: m }; }
      case 'presidente-2022.json': return presidente2022;
      case 'senado-mantidas.json': return senadoMantidas;
      case 'deputados/br.json': return { ...deputadosBr(tt), ...meta(tt) };
      default: {
        let m = /^uf\/([a-z]{2})\.json$/.exec(rel);
        if (m && pkUf[m[1].toUpperCase()]) return { ...ufMunicipal(m[1].toUpperCase(), antes ? 0 : te), ...meta(tt) };
        m = /^deputados\/([a-z]{2})\.json$/.exec(rel);
        if (m && deputados[m[1].toUpperCase()]) return { ...deputadosEm(m[1].toUpperCase(), tt), ...meta(tt) };
        m = /^zonas\/(\d{5})\.json$/.exec(rel);
        if (m) { const z = zonasEm(m[1], antes ? 0 : te); return z && { ...z, ...meta(tt) }; }
        return null;
      }
    }
  }

  const tempoCarga = Date.now() - inicioCarga;
  return {
    calibracao,
    tempoCarga,
    relogio,
    limites: { inicio: T_INICIO, abertura: T_ABERTURA, fim: T_FIM, ciclo: T_CICLO },
    controlar({ t, velocidade: v } = {}) {
      if (t === null) fixo = null; else if (t != null) fixo = Number(t);
      if (v != null) vel = Number(v);
      return { fixo, velocidade: vel, agora: relogio() };
    },
    arquivo,
  };
}
