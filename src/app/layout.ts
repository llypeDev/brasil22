// Composição por viewport (plano, seções 5 e 6).
//
//   desktop: escala = clamp(min(largura/1600, alturaÚtil/900), 0,85, 3)
//   TV:      escala = clamp(min(largura/1280, alturaÚtil/720), 0,5, 4)
//   celular: largura < 1000 e (alturaÚtil ≥ largura ou alturaÚtil < 640)
//            vertical < 600 px → página em fluxo; vertical ≥ 600 → tablet; horizontal baixa → paisagem
// A área útil desconta as faixas do topo, medidas com ResizeObserver.

import { useEffect, useState } from 'react';
import type { Quadro } from '../map/camera';

export type Variante = 'desktop' | 'tablet' | 'celular' | 'paisagem' | 'tv';

export interface Layout {
  variante: Variante;
  escala: number;
  w: number;
  h: number;
  cw: number;
  ch: number;
  altura: 'baixa' | 'media' | 'alta';
  /** retângulo (px reais, relativo ao painel) onde o mapa é enquadrado */
  quadroMapa: Quadro;
  /** geometria da composição (px de composição) */
  g: { mapaX0: number; mapaX1: number; mapaY0: number; mapaY1: number; colTopo: number };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function calcularLayout(w: number, hUtil: number, tv: boolean, colunaDireita: boolean): Layout {
  const telefone = w < 1000 && (hUtil >= w || hUtil < 640);
  if (tv) {
    const escala = clamp(Math.min(w / 1280, hUtil / 720), 0.5, 4);
    const cw = w / escala, ch = hUtil / escala;
    const g = { mapaX0: 20 + 360 + 24, mapaX1: cw - 24, mapaY0: 96, mapaY1: ch - 20 - 52 - 16, colTopo: 84 };
    return { variante: 'tv', escala, w, h: hUtil, cw, ch, altura: 'alta', g, quadroMapa: real(g, escala) };
  }
  if (telefone) {
    const variante: Variante = hUtil < 640 && w > hUtil ? 'paisagem' : w < 600 ? 'celular' : 'tablet';
    const g = { mapaX0: 0, mapaX1: w, mapaY0: 0, mapaY1: hUtil, colTopo: 0 };
    return { variante, escala: 1, w, h: hUtil, cw: w, ch: hUtil, altura: 'alta', g, quadroMapa: { x: 0, y: 0, w, h: hUtil } };
  }
  const escala = clamp(Math.min(w / 1600, hUtil / 900), 0.85, 3);
  const cw = w / escala, ch = hUtil / escala;
  const altura = ch < 700 ? 'baixa' : ch < 800 ? 'media' : 'alta';
  const mapaX1 = colunaDireita ? cw - 20 - 308 - 20 : cw - 20;
  const g = { mapaX0: 20 + 336 + 20, mapaX1, mapaY0: 72 + 36, mapaY1: ch - 20 - 46 - 14, colTopo: 72 };
  return { variante: 'desktop', escala, w, h: hUtil, cw, ch, altura, g, quadroMapa: real(g, escala) };
}

function real(g: Layout['g'], e: number): Quadro {
  return { x: g.mapaX0 * e, y: g.mapaY0 * e, w: Math.max(40, (g.mapaX1 - g.mapaX0) * e), h: Math.max(40, (g.mapaY1 - g.mapaY0) * e) };
}

export function useViewport() {
  const ler = () => ({ w: window.innerWidth, h: window.visualViewport?.height ?? window.innerHeight });
  const [vp, setVp] = useState(ler);
  useEffect(() => {
    let raf = 0;
    const atualizar = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setVp(ler())); };
    window.addEventListener('resize', atualizar);
    window.addEventListener('orientationchange', atualizar);
    window.visualViewport?.addEventListener('resize', atualizar);
    return () => {
      window.removeEventListener('resize', atualizar);
      window.removeEventListener('orientationchange', atualizar);
      window.visualViewport?.removeEventListener('resize', atualizar);
    };
  }, []);
  return vp;
}

/** Altura de um elemento acompanhada por ResizeObserver. */
export function useAltura(el: HTMLElement | null) {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!el) { setH(0); return; }
    const o = new ResizeObserver(() => setH(el.getBoundingClientRect().height));
    o.observe(el);
    setH(el.getBoundingClientRect().height);
    return () => o.disconnect();
  }, [el]);
  return h;
}
