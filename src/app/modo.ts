// Modo de dados escolhido na URL (?fonte=simulacao, ?cenario=…) e o turno que abre por padrão.

import type { Modo } from '../data/contratos';
import type { Turno } from './hash';

export function lerModoDaUrl(): Modo {
  const q = new URLSearchParams(location.search);
  const c = q.get('cenario');
  if (c && ['aguardando', 'vazio', 'falha', 'instavel', 'lento'].includes(c)) return `cenario-${c}` as Modo;
  return q.get('fonte') === 'simulacao' ? 'simulacao' : 'oficial';
}

/** Endereço sem fragmento: com os dados oficiais abre o 2º turno; simulação e cenários são do 1º. */
export const turnoPadrao = (modo: Modo = lerModoDaUrl()): Turno => (modo === 'oficial' ? 2 : 1);
