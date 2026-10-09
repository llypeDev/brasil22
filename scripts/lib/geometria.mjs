// Utilitários geométricos usados na preparação dos mapas (coordenadas planas).

/** Distância ao quadrado de um ponto a um segmento. */
function distSegQuadrado(px, py, ax, ay, bx, by) {
  let x = ax, y = ay;
  let dx = bx - x, dy = by - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = bx; y = by; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = px - x; dy = py - y;
  return dx * dx + dy * dy;
}

/** Distância com sinal do ponto ao contorno do polígono (positiva dentro). */
function distanciaAoPoligono(x, y, aneis) {
  let dentro = false;
  let menor = Infinity;
  for (const anel of aneis) {
    for (let i = 0, n = anel.length, j = n - 1; i < n; j = i++) {
      const a = anel[i], b = anel[j];
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) dentro = !dentro;
      menor = Math.min(menor, distSegQuadrado(x, y, a[0], a[1], b[0], b[1]));
    }
  }
  return (dentro ? 1 : -1) * Math.sqrt(menor);
}

/**
 * Polo de inacessibilidade: ponto interno mais distante da borda.
 * Busca por subdivisão de células com fila de prioridade (algoritmo de Garcia-Castellanos & Lombardo).
 */
export function poloDeInacessibilidade(aneis, precisao = 1) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of aneis[0]) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const largura = maxX - minX, altura = maxY - minY;
  const tamanho = Math.min(largura, altura);
  if (tamanho === 0) return [minX, minY];
  const celula = (x, y, h) => {
    const d = distanciaAoPoligono(x, y, aneis);
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };
  const fila = [];
  const inserir = (c) => {
    // inserção ordenada (fila pequena o bastante para não exigir heap)
    let lo = 0, hi = fila.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (fila[m].max < c.max) lo = m + 1; else hi = m; }
    fila.splice(lo, 0, c);
  };
  const h0 = tamanho / 2;
  for (let x = minX; x < maxX; x += tamanho) for (let y = minY; y < maxY; y += tamanho) inserir(celula(x + h0, y + h0, h0));
  // centroide como palpite inicial
  let melhor = celula(...centroide(aneis[0]), 0);
  const caixa = celula(minX + largura / 2, minY + altura / 2, 0);
  if (caixa.d > melhor.d) melhor = caixa;
  let iter = 0;
  while (fila.length && iter++ < 20000) {
    const c = fila.pop();
    if (c.d > melhor.d) melhor = c;
    if (c.max - melhor.d <= precisao) continue;
    const h = c.h / 2;
    inserir(celula(c.x - h, c.y - h, h));
    inserir(celula(c.x + h, c.y - h, h));
    inserir(celula(c.x - h, c.y + h, h));
    inserir(celula(c.x + h, c.y + h, h));
  }
  return [melhor.x, melhor.y, melhor.d];
}

export function centroide(anel) {
  let area = 0, x = 0, y = 0;
  for (let i = 0, n = anel.length, j = n - 1; i < n; j = i++) {
    const a = anel[i], b = anel[j];
    const f = a[0] * b[1] - b[0] * a[1];
    x += (a[0] + b[0]) * f; y += (a[1] + b[1]) * f; area += f * 3;
  }
  if (area === 0) return [anel[0][0], anel[0][1]];
  return [x / area, y / area];
}

export function areaAnel(anel) {
  let s = 0;
  for (let i = 0, n = anel.length, j = n - 1; i < n; j = i++) s += (anel[j][0] - anel[i][0]) * (anel[j][1] + anel[i][1]);
  return Math.abs(s / 2);
}

/** Lista de polígonos (cada um uma lista de anéis) de uma geometria GeoJSON. */
export function poligonos(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

export function caixa(geom) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poligonos(geom)) for (const [x, y] of p[0]) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Ponto de rótulo no maior polígono da geometria. */
export function pontoDeRotulo(geom, precisao) {
  const ps = poligonos(geom);
  if (!ps.length) return null;
  let maior = ps[0], am = areaAnel(ps[0][0]);
  for (const p of ps) { const a = areaAnel(p[0]); if (a > am) { am = a; maior = p; } }
  const b = caixa({ type: 'Polygon', coordinates: maior });
  const tam = Math.max(b[2] - b[0], b[3] - b[1]);
  return poloDeInacessibilidade(maior, precisao ?? Math.max(tam / 200, 0.01));
}

export const arredondar = (v, casas = 1) => Math.round(v * 10 ** casas) / 10 ** casas;
