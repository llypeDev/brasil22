// Câmera 2D: tela = mapa × k + (x, y), em pixels CSS do contêiner.

export interface Camera { k: number; x: number; y: number }
export interface Quadro { x: number; y: number; w: number; h: number }
export type Caixa = [number, number, number, number];

/** Câmera que encaixa a caixa no quadro com margem relativa. */
export function enquadrar(caixa: Caixa, q: Quadro, margem = 0.06, kMax = Infinity): Camera {
  const [x0, y0, x1, y1] = caixa;
  const w = Math.max(1e-6, x1 - x0), h = Math.max(1e-6, y1 - y0);
  const k = Math.min(kMax, Math.min((q.w * (1 - 2 * margem)) / w, (q.h * (1 - 2 * margem)) / h));
  return { k, x: q.x + q.w / 2 - ((x0 + x1) / 2) * k, y: q.y + q.h / 2 - ((y0 + y1) / 2) * k };
}

/** Interpolação suave: escala em log, centro de forma que o movimento acompanhe o zoom. */
export function interpolar(a: Camera, b: Camera, t: number, q: Quadro): Camera {
  const cx = q.x + q.w / 2, cy = q.y + q.h / 2;
  const ca = { x: (cx - a.x) / a.k, y: (cy - a.y) / a.k };
  const cb = { x: (cx - b.x) / b.k, y: (cy - b.y) / b.k };
  const k = Math.exp(Math.log(a.k) + (Math.log(b.k) - Math.log(a.k)) * t);
  // o centro avança proporcionalmente ao quanto a escala já mudou (evita "deslizar" longe)
  const s = Math.abs(Math.log(b.k / a.k)) < 1e-6 ? t : (1 / k - 1 / a.k) / (1 / b.k - 1 / a.k);
  const c = { x: ca.x + (cb.x - ca.x) * s, y: ca.y + (cb.y - ca.y) * s };
  return { k, x: cx - c.x * k, y: cy - c.y * k };
}

export const suavizar = (t: number) => 1 - Math.pow(1 - t, 3);

/** Zoom em torno de um ponto de tela. */
export function zoomEm(c: Camera, fator: number, px: number, py: number, kMin: number, kMax: number): Camera {
  const k = Math.max(kMin, Math.min(kMax, c.k * fator));
  const f = k / c.k;
  return { k, x: px - (px - c.x) * f, y: py - (py - c.y) * f };
}

export const paraMapa = (c: Camera, sx: number, sy: number) => [(sx - c.x) / c.k, (sy - c.y) / c.k] as const;
export const paraTela = (c: Camera, mx: number, my: number) => [mx * c.k + c.x, my * c.k + c.y] as const;

/** Restringe o deslocamento para manter parte do conteúdo no quadro. */
export function limitar(c: Camera, conteudo: Caixa, q: Quadro, folga = 0.35): Camera {
  const [x0, y0, x1, y1] = conteudo;
  const w = (x1 - x0) * c.k, h = (y1 - y0) * c.k;
  const minX = q.x + q.w * folga - (x0 * c.k + w), maxX = q.x + q.w * (1 - folga) - x0 * c.k;
  const minY = q.y + q.h * folga - (y0 * c.k + h), maxY = q.y + q.h * (1 - folga) - y0 * c.k;
  return { k: c.k, x: Math.min(maxX, Math.max(minX, c.x)), y: Math.min(maxY, Math.max(minY, c.y)) };
}
