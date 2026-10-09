// Formatação pt-BR. Percentuais são frações (0–1) até a apresentação.

const inteiro = new Intl.NumberFormat('pt-BR');
const cache = new Map<number, Intl.NumberFormat>();
const decimal = (casas: number) => {
  if (!cache.has(casas)) cache.set(casas, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));
  return cache.get(casas)!;
};

export const num = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : inteiro.format(Math.round(n)));

/** Fração → "45,16" (sem o símbolo). */
export const pct = (f: number | null | undefined, casas = 1) => (f == null || !Number.isFinite(f) ? '—' : decimal(casas).format(f * 100));
export const pctS = (f: number | null | undefined, casas = 1) => (f == null || !Number.isFinite(f) ? '—' : `${pct(f, casas)}%`);

/** Diferença em pontos com sinal tipográfico: "+3,7", "−3,0". */
export const pontos = (d: number | null | undefined, casas = 1) => {
  if (d == null || !Number.isFinite(d)) return '—';
  const v = d * 100;
  const s = decimal(casas).format(Math.abs(v));
  if (s === decimal(casas).format(0)) return s;
  return `${v > 0 ? '+' : '−'}${s}`;
};

/** "2,2 milhões", "93 mil", "820" */
export function compacto(n: number | null | undefined, { unidade = '' }: { unidade?: string } = {}) {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const u = unidade ? ` ${unidade}` : '';
  if (a >= 1e6) {
    const v = n / 1e6;
    return `${decimal(a >= 1e7 ? (Math.abs(v) >= 100 ? 0 : 1) : 1).format(v).replace(/,0$/, '')} ${Math.abs(v) < 2 ? 'milhão' : 'milhões'}${unidade ? ` de${u}` : ''}`;
  }
  if (a >= 1e3) return `${inteiro.format(Math.round(n / 1e3))} mil${u}`;
  return `${inteiro.format(n)}${u}`;
}

/** Minutos desde 00:00 do dia da eleição → "20h55" (dia seguinte continua no relógio). */
export function horaDe(t: number | null | undefined) {
  if (t == null || !Number.isFinite(t)) return '—';
  const m = ((Math.round(t) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}h${String(m % 60).padStart(2, '0')}`;
}
export const horaCurta = (t: number) => `${Math.floor((((Math.round(t) % 1440) + 1440) % 1440) / 60)}h`;

const FUSO = 'America/Sao_Paulo';
export function horaIso(iso: string | null | undefined, comData = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const h = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).replace(':', 'h');
  if (!comData) return h;
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' }).format(d);
  return `${dia} às ${h}`;
}

export const relogio = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d);

export function plural(n: number, um: string, varios: string) {
  return `${num(n)} ${n === 1 ? um : varios}`;
}

/** Remove acentos, caixa e espaços extras para busca. */
export function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const PREP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'la']);
/** "ABADIA DOS DOURADOS" → "Abadia dos Dourados" (para nomes de lugares em caixa alta). */
export function tituloLugar(s: string) {
  return s.toLocaleLowerCase('pt-BR').split(/\s+/).map((p, i) => (i > 0 && PREP.has(p) ? p : p.replace(/(^|[-'’(])(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('pt-BR')))).join(' ');
}

/** Iniciais para retrato ausente. */
export function iniciais(nome: string) {
  const p = nome.replace(/^(dr|dra|delegado|delegada|professor|professora|pastor|pastora|coronel|capitão|sargento|cabo|general|juíz|juiz|escritor|veterinário)\.?\s+/i, '').split(/\s+/).filter((x) => x.length > 1 && !PREP.has(x.toLowerCase()));
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
