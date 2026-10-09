// Cálculos sobre o modelo interno. Contagens inteiras; frações só na apresentação.
//
// Regras:
//  • parcela de uma candidatura = votos / votos válidos da abrangência (anulados fora);
//  • seções apuradas = totalizadas / total de seções;
//  • comparecimento parcial = comparecimento / eleitorado das seções já totalizadas;
//  • abstenção no mesmo universo; brancos e nulos sobre o comparecimento;
//  • região = soma de votos / soma de válidos (nunca média de percentuais);
//  • vantagem em pontos = diferença das parcelas.
//  Situação (eleito, 2º turno) vem do provedor; nunca é deduzida de percentuais arredondados.

import type { Candidato, Colunar, Resultado, SituacaoCandidatura } from './contratos';
import { partido } from './partidos';

export interface Linha {
  c: Candidato;
  votos: number;
  parcela: number | null;
  anulado: boolean;
  situacao: SituacaoCandidatura;
}

const VAZIO: Candidato = { n: '', sq: '', nome: '—', nomeUrna: '', nomeCompleto: '', partido: '', situacao: 'apurando', situacaoTse: '', destino: 'valido' };

export function candidatoPorNumero(lista: Candidato[] | undefined, n: string): Candidato {
  return lista?.find((c) => c.n === n) ?? { ...VAZIO, n, nome: n };
}

/** Candidaturas ordenadas por votos; anuladas ao final, sem parcela. */
export function linhas(r: Resultado | undefined | null, cands: Candidato[] | undefined): Linha[] {
  if (!r || !cands) return [];
  const validos = r.validos;
  const out: Linha[] = [];
  for (const c of cands) {
    const anulado = c.destino === 'anulado' || (r.anulados && c.n in r.anulados && !(c.n in r.votos));
    const votos = anulado ? r.anulados?.[c.n] ?? 0 : r.votos[c.n] ?? 0;
    out.push({ c, votos, parcela: anulado || !validos ? null : votos / validos, anulado, situacao: r.situacoes?.[c.n] ?? (r.situacao === 'aguardando' || r.situacao === 'apurando' ? 'apurando' : c.situacao) });
  }
  return out.sort((a, b) => Number(a.anulado) - Number(b.anulado) || b.votos - a.votos || a.c.n.localeCompare(b.c.n));
}

export const fracaoSecoes = (r?: Resultado | null) => (r && r.secoes ? r.totalizadas / r.secoes : 0);
export const comparecimentoPct = (r?: Resultado | null) => (r && r.eleitoradoApurado ? r.comparecimento / r.eleitoradoApurado : null);
export const abstencaoPct = (r?: Resultado | null) => (r && r.eleitoradoApurado ? r.abstencao / r.eleitoradoApurado : null);
export const brancosNulosPct = (r?: Resultado | null) => (r && r.comparecimento ? (r.brancos + r.nulos) / r.comparecimento : null);

export interface Vantagem { lider: Linha; segundo: Linha | null; pontos: number | null; votos: number }
export function vantagem(ls: Linha[]): Vantagem | null {
  const v = ls.filter((l) => !l.anulado);
  if (!v.length || v[0].votos === 0) return null;
  const s = v[1] ?? null;
  return { lider: v[0], segundo: s, pontos: s && v[0].parcela != null && s.parcela != null ? v[0].parcela - s.parcela : null, votos: v[0].votos - (s?.votos ?? 0) };
}

/** Disputa entre a posição k e k+1 (Senado: k=1 compara 2ª e 3ª posições). */
export function margemEntre(ls: Linha[], k: number) {
  const v = ls.filter((l) => !l.anulado);
  const a = v[k], b = v[k + 1];
  if (!a || !b || a.parcela == null || b.parcela == null) return null;
  return { a, b, pontos: a.parcela - b.parcela, votos: a.votos - b.votos };
}

/** Comparação com 2022 para a candidatura de mesmo número (mapeamento explícito no arquivo de 2022). */
export function delta2022(parcela2026: number | null, numero: string, ref?: { validos: number; votos: Record<string, number> } | null) {
  if (parcela2026 == null || !ref || !ref.validos || ref.votos[numero] == null) return null;
  return parcela2026 - ref.votos[numero] / ref.validos;
}

// ---------- coleções colunares (municípios, zonas, cidades) ----------

export interface Indicadores {
  n: number;
  /** índice da candidatura líder em `candidatos`, −1 sem dados */
  lider: Int16Array;
  segundo: Int16Array;
  parcelaLider: Float32Array;
  /** vantagem do líder em pontos (fração) */
  margem: Float32Array;
  margemVotos: Float64Array;
  /** fração de seções totalizadas */
  fracao: Float32Array;
  temDados: Uint8Array;
}

export function indicadores(col: Colunar, validoPorCand: boolean[]): Indicadores {
  const n = col.tse.length;
  const r: Indicadores = {
    n,
    lider: new Int16Array(n).fill(-1), segundo: new Int16Array(n).fill(-1), parcelaLider: new Float32Array(n),
    margem: new Float32Array(n), margemVotos: new Float64Array(n), fracao: new Float32Array(n), temDados: new Uint8Array(n),
  };
  const nc = col.candidatos.length;
  for (let i = 0; i < n; i++) {
    const sec = col.secoes[i];
    if (sec == null) continue;
    r.fracao[i] = sec ? (col.totalizadas[i] ?? 0) / sec : 0;
    const val = col.validos[i] ?? 0;
    if (!val) continue;
    let a = -1, av = -1, b = -1, bv = -1;
    for (let c = 0; c < nc; c++) {
      if (!validoPorCand[c]) continue;
      const v = col.votos[c][i] ?? 0;
      if (v > av || (v === av && a >= 0 && col.candidatos[c] < col.candidatos[a])) { b = a; bv = av; a = c; av = v; }
      else if (v > bv) { b = c; bv = v; }
    }
    if (av <= 0) continue;
    r.temDados[i] = 1;
    r.lider[i] = a; r.segundo[i] = b;
    r.parcelaLider[i] = av / val;
    r.margem[i] = (av - Math.max(0, bv)) / val;
    r.margemVotos[i] = av - Math.max(0, bv);
  }
  return r;
}

/** Parcela de uma candidatura em cada item da coleção (NaN sem dados). */
export function parcelaColunar(col: Colunar, idx: number): Float32Array {
  const out = new Float32Array(col.tse.length).fill(NaN);
  if (idx < 0) return out;
  for (let i = 0; i < col.tse.length; i++) {
    const val = col.validos[i];
    if (val) out[i] = (col.votos[idx][i] ?? 0) / val;
  }
  return out;
}

/** Resultado de um item da coleção no formato agregado (para cards e tooltips). */
export function resultadoDoItem(col: Colunar, i: number, catalogo: Candidato[]): Resultado | null {
  if (i < 0 || col.secoes[i] == null) return null;
  const votos: Record<string, number> = {}; const anulados: Record<string, number> = {};
  col.candidatos.forEach((n, c) => {
    const anul = catalogo.find((x) => x.n === n)?.destino === 'anulado';
    (anul ? anulados : votos)[n] = col.votos[c][i] ?? 0;
  });
  const secoes = col.secoes[i] ?? 0, tot = col.totalizadas[i] ?? 0, ele = col.eleitorado[i] ?? 0;
  const eleA = secoes ? Math.round(ele * (tot / secoes)) : 0;
  const comp = col.comparecimento[i] ?? 0;
  return {
    secoes, totalizadas: tot, eleitorado: ele, eleitoradoApurado: eleA, comparecimento: comp, abstencao: Math.max(0, eleA - comp),
    brancos: col.brancos[i] ?? 0, nulos: col.nulos[i] ?? 0, validos: col.validos[i] ?? 0, anuladosSJ: col.anuladosSJ[i] ?? 0,
    votos, anulados, situacao: tot >= secoes && secoes > 0 ? 'concluida' : tot > 0 ? 'apurando' : 'aguardando', situacoes: {},
  };
}

/** Soma de itens (ex.: cidades de um país). */
export function somarItens(col: Colunar, indices: number[], catalogo: Candidato[]): Resultado | null {
  const partes = indices.map((i) => resultadoDoItem(col, i, catalogo)).filter((x): x is Resultado => !!x);
  if (!partes.length) return null;
  const r = partes.reduce((a, b) => {
    for (const k of ['secoes', 'totalizadas', 'eleitorado', 'eleitoradoApurado', 'comparecimento', 'abstencao', 'brancos', 'nulos', 'validos', 'anuladosSJ'] as const) a[k] += b[k];
    for (const [n, v] of Object.entries(b.votos)) a.votos[n] = (a.votos[n] ?? 0) + v;
    for (const [n, v] of Object.entries(b.anulados)) a.anulados[n] = (a.anulados[n] ?? 0) + v;
    return a;
  }, { secoes: 0, totalizadas: 0, eleitorado: 0, eleitoradoApurado: 0, comparecimento: 0, abstencao: 0, brancos: 0, nulos: 0, validos: 0, anuladosSJ: 0, votos: {}, anulados: {}, situacao: 'apurando', situacoes: {} } as Resultado);
  r.situacao = r.totalizadas >= r.secoes && r.secoes ? 'concluida' : r.totalizadas ? 'apurando' : 'aguardando';
  return r;
}

/** Limites da escala do mapa de candidato: quantis ponderados por válidos, arredondados. */
export function limitesCandidato(parcelas: Float32Array, pesos: (number | null)[], classes = 5): number[] {
  const pares: [number, number][] = [];
  for (let i = 0; i < parcelas.length; i++) if (!Number.isNaN(parcelas[i]) && (pesos[i] ?? 0) > 0) pares.push([parcelas[i], pesos[i] ?? 0]);
  if (!pares.length) return [0.2, 0.4, 0.6, 0.8].slice(0, classes - 1);
  pares.sort((a, b) => a[0] - b[0]);
  const total = pares.reduce((s, p) => s + p[1], 0);
  const out: number[] = [];
  let acc = 0, k = 1;
  for (const [v, w] of pares) {
    acc += w;
    while (k < classes && acc >= (total * k) / classes) { out.push(Math.round(v * 100) / 100); k++; }
  }
  return [...new Set(out)];
}

export const corDoPartido = (sigla: string) => partido(sigla).cor;

export function rotuloSituacao(s: SituacaoCandidatura | undefined): string | null {
  switch (s) {
    case 'eleito': return 'eleito(a)';
    case 'eleito-qp': return 'eleito(a) por QP';
    case 'eleito-media': return 'eleito(a) por média';
    case 'segundo-turno': return '2º turno';
    case 'suplente': return 'suplente';
    case 'nao-eleito': return 'não eleito(a)';
    default: return null;
  }
}
export const eleito = (s?: SituacaoCandidatura) => s === 'eleito' || s === 'eleito-qp' || s === 'eleito-media';
