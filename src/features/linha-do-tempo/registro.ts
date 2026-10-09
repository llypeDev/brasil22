/** Registro (snapshot ou agregado) mais recente ≤ t, por busca binária numa lista ordenada. */
export function registroAte(t: number, lista: number[]): number | null {
  let lo = 0, hi = lista.length - 1, r: number | null = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (lista[m] <= t) { r = lista[m]; lo = m + 1; } else hi = m - 1; }
  return r;
}
