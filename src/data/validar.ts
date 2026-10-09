// Validação de ingestão no cliente. Uma resposta inválida é descartada e o painel mantém o
// último snapshot válido, com aviso — nunca "conserta" números.

import type { Agora, Colunar, Resultado } from './contratos';

export class ErroValidacao extends Error {}

const contagem = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

export function validarResultado(r: unknown, onde: string): Resultado {
  const x = r as Resultado;
  if (!x || typeof x !== 'object') throw new ErroValidacao(`${onde}: resultado ausente`);
  for (const k of ['secoes', 'totalizadas', 'eleitorado', 'comparecimento', 'brancos', 'nulos', 'validos'] as const) {
    if (!contagem(x[k])) throw new ErroValidacao(`${onde}: ${k} inválido (${String(x[k])})`);
  }
  if (x.totalizadas > x.secoes) throw new ErroValidacao(`${onde}: seções totalizadas excedem o total`);
  for (const [n, v] of Object.entries(x.votos ?? {})) if (!contagem(v)) throw new ErroValidacao(`${onde}: votos de ${n} inválidos`);
  const soma = Object.values(x.votos ?? {}).reduce((a, b) => a + b, 0);
  if (soma > x.validos + 1) throw new ErroValidacao(`${onde}: soma nominal excede válidos`);
  x.eleitoradoApurado ??= x.secoes ? Math.round(x.eleitorado * (x.totalizadas / x.secoes)) : 0;
  x.abstencao ??= Math.max(0, x.eleitoradoApurado - x.comparecimento);
  x.anulados ??= {};
  x.situacoes ??= {};
  x.anuladosSJ ??= 0;
  return x;
}

export function validarAgora(bruto: unknown): Agora {
  const a = bruto as Agora;
  if (!a || a.versao !== 1) throw new ErroValidacao('agora: versão de contrato desconhecida');
  if (!Number.isFinite(a.seq) || !Number.isFinite(a.t)) throw new ErroValidacao('agora: sequência ou instante ausentes');
  if (a.turno !== 1 && a.turno !== 2) throw new ErroValidacao('agora: turno desconhecido');
  validarResultado(a.presidente?.br, 'presidente BR');
  for (const [uf, r] of Object.entries(a.presidente?.uf ?? {})) validarResultado(r, `presidente ${uf}`);
  for (const [uf, r] of Object.entries(a.governador?.uf ?? {})) validarResultado(r, `governador ${uf}`);
  for (const [uf, r] of Object.entries(a.senador?.uf ?? {})) validarResultado(r, `senado ${uf}`);
  a.presidente.zz ??= a.presidente.uf.ZZ;
  a.presidente.regioes ??= {};
  return a;
}

export function validarColunar<T extends Colunar>(bruto: unknown, onde = 'coleção'): T {
  const c = bruto as T;
  if (!c || !Array.isArray(c.tse) || !Array.isArray(c.candidatos) || !Array.isArray(c.votos)) throw new ErroValidacao(`${onde}: formato colunar inválido`);
  const n = c.tse.length;
  for (const k of ['secoes', 'totalizadas', 'eleitorado', 'comparecimento', 'brancos', 'nulos', 'validos'] as const) {
    if (!Array.isArray(c[k]) || c[k].length !== n) throw new ErroValidacao(`${onde}: coluna ${k} com dimensão ${c[k]?.length} ≠ ${n}`);
  }
  if (c.votos.length !== c.candidatos.length) throw new ErroValidacao(`${onde}: ${c.votos.length} colunas de votos para ${c.candidatos.length} candidaturas`);
  for (const v of c.votos) if (v.length !== n) throw new ErroValidacao(`${onde}: coluna de votos com dimensão errada`);
  for (let i = 0; i < n; i++) {
    const s = c.secoes[i], t = c.totalizadas[i];
    if (s != null && t != null && t > s) throw new ErroValidacao(`${onde}: ${c.tse[i]} com seções totalizadas acima do total`);
  }
  return c;
}

/** A sequência ao vivo não pode regredir, exceto na reinicialização explícita da simulação. */
export function sequenciaAceita(anterior: number | null, nova: number, modo: string) {
  if (anterior == null) return true;
  if (nova >= anterior) return true;
  return modo === 'simulacao'; // o relógio simulado reinicia o ciclo
}
