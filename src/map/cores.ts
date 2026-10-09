// Escalas de cor das camadas do mapa (tema claro).

import { partido, COR_SEM_DADOS } from '../data/partidos';

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (r: number[]) => `#${r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

export function misturar(a: string, b: string, t: number) {
  const x = hexRgb(a), y = hexRgb(b);
  return rgbHex(x.map((v, i) => v + (y[i] - v) * t)).toUpperCase();
}

/** Faixas da vantagem do líder, em pontos (frações). */
export const LIMITES_VANTAGEM = [0.1, 0.25, 0.45];

const tonsCache = new Map<string, string[]>();
/** Quatro tons por partido: até 10, 25, 45 e mais pontos de vantagem. */
export function tonsVantagem(sigla: string): string[] {
  const p = partido(sigla);
  if (!tonsCache.has(p.cor)) tonsCache.set(p.cor, [misturar(p.cor, '#FFFFFF', 0.58), misturar(p.cor, '#FFFFFF', 0.3), p.cor, p.escuro]);
  return tonsCache.get(p.cor)!;
}

export function corVantagem(sigla: string, margem: number) {
  const t = tonsVantagem(sigla);
  if (margem < LIMITES_VANTAGEM[0]) return t[0];
  if (margem < LIMITES_VANTAGEM[1]) return t[1];
  if (margem < LIMITES_VANTAGEM[2]) return t[2];
  return t[3];
}

/** Tom claro (apurando) e forte (definido) para mapas por UF. */
export const corDisputa = (sigla: string, definida: boolean) => (definida ? partido(sigla).cor : misturar(partido(sigla).cor, '#FFFFFF', 0.5));

/** Avanço da totalização. */
export const LIMITES_APURADO = [0.25, 0.5, 0.75, 0.999];
export const RAMPA_APURADO = ['#E4E4E1', '#C2C3C0', '#9A9C99', '#6E716F', '#3C3F40'];
export function corApurado(f: number) {
  if (f <= 0) return COR_SEM_DADOS;
  for (let k = 0; k < LIMITES_APURADO.length; k++) if (f < LIMITES_APURADO[k]) return RAMPA_APURADO[k];
  return RAMPA_APURADO[RAMPA_APURADO.length - 1];
}

/** Rampa sequencial da cor do partido para o mapa de candidato. */
export function rampaCandidato(sigla: string, classes: number): string[] {
  const p = partido(sigla);
  const out: string[] = [];
  for (let k = 0; k < classes; k++) {
    const t = classes === 1 ? 1 : k / (classes - 1);
    out.push(t < 0.75 ? misturar(p.cor, '#FFFFFF', 0.86 - (0.86 * t) / 0.75) : misturar(p.cor, p.escuro, (t - 0.75) / 0.25));
  }
  return out;
}

export function corPorLimites(v: number, limites: number[], rampa: string[]) {
  if (Number.isNaN(v)) return COR_SEM_DADOS;
  for (let k = 0; k < limites.length; k++) if (v < limites[k]) return rampa[k];
  return rampa[Math.min(rampa.length - 1, limites.length)];
}

/** Altura do pico (px) para uma vantagem em votos: raiz quadrada, 500 mil votos ≈ escala. */
export const alturaPico = (votos: number, escala = 100) => escala * Math.sqrt(Math.max(0, votos) / 500_000);
