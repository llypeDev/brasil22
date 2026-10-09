// Ponte entre o mapa principal e os controles fora dele (zoom, legenda, atalhos).

import { create } from 'zustand';
import type { Legenda } from './especificacao';
import type { MotorMapa } from './motor';

interface EstadoMapa {
  motor: MotorMapa | null;
  podeAproximar: boolean;
  podeAfastar: boolean;
  legenda: Legenda | null;
  carregando: boolean;
  aviso: string | null;
  set: (p: Partial<EstadoMapa>) => void;
}

export const useMapa = create<EstadoMapa>((set) => ({
  motor: null, podeAproximar: true, podeAfastar: false, legenda: null, carregando: true, aviso: null,
  set: (p) => set(p),
}));

// Em desenvolvimento, expõe o estado do mapa para inspeção e testes de ponta a ponta.
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __mapa: typeof useMapa }).__mapa = useMapa;

export const mapaApi = {
  aproximar: () => useMapa.getState().motor?.aproximar(),
  afastar: () => useMapa.getState().motor?.afastar(),
  /** volta ao enquadramento do contexto atual */
  reiniciar: () => window.dispatchEvent(new CustomEvent('mapa:reenquadrar')),
};
