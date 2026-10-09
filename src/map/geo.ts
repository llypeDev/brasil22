// Geometrias do mapa, já projetadas no preparo (scripts/geo/construir-geografia.mjs).
// Coordenadas em "unidades de mapa" (largura ~10.000). O cliente só decodifica arcos e
// monta Path2D; nenhuma projeção é feita no navegador.

export interface UfGeo {
  uf: string;
  ibge: string;
  nome: string;
  regiao: string;
  rotulo: [number, number];
  raio: number;
  caixa: [number, number, number, number];
  caminho: Path2D;
}

export interface GeoBrasil {
  tipo: 'brasil';
  n: number;
  ibge: string[];
  tse: string[];
  uf: string[];
  nome: string[];
  rotulo: Float32Array;
  raio: Float32Array;
  caixa: Float32Array;
  caminho: Path2D[];
  ufs: UfGeo[];
  ufIndice: Map<string, number>;
  municipiosDaUf: Map<string, Int32Array>;
  porIbge: Map<string, number>;
  porTse: Map<string, number>;
  bordasMun: Path2D;
  bordasUf: Path2D;
  contorno: Path2D;
  bordasMunDaUf: Map<string, Path2D>;
  caixaContinental: [number, number, number, number];
  caixaTotal: [number, number, number, number];
  encontrar: (x: number, y: number) => number;
  encontrarUf: (x: number, y: number) => number;
}

export interface PaisGeo { iso: string; nome: string; caminho: Path2D; caixa: [number, number, number, number] }
export interface CidadeGeo { tse: string; nome: string; pais: string; paisNome: string; lon: number; lat: number; x: number; y: number; fuso: string }
export interface GeoMundo {
  tipo: 'mundo';
  paises: PaisGeo[];
  porIso: Map<string, PaisGeo>;
  brasilUfs: { uf: string; caminho: Path2D }[];
  cidades: CidadeGeo[];
  cidadePorTse: Map<string, CidadeGeo>;
  caixaTotal: [number, number, number, number];
  encontrarPais: (x: number, y: number) => number;
}

interface Topologia {
  type: 'Topology';
  transform: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: {
    municipios: { geometries: { type: 'Polygon' | 'MultiPolygon'; arcs: number[][] | number[][][]; id: string }[] };
    ufs: { geometries: { type: 'Polygon' | 'MultiPolygon'; arcs: number[][] | number[][][]; id: string }[] };
  };
}

interface ArquivoBrasil {
  versao: 1;
  caixaContinental: [number, number, number, number];
  ufs: { uf: string; ibge: string; nome: string; regiao: string; rotulo: [number, number]; raio: number; caixa: [number, number, number, number] }[];
  municipios: { ibge: string[]; tse: string[]; uf: string[]; nome: string[]; rotulo: ([number, number] | null)[]; raio: number[] };
  topologia: Topologia;
}

let contextoTeste: CanvasRenderingContext2D | null = null;
function ctxTeste() {
  if (!contextoTeste) contextoTeste = document.createElement('canvas').getContext('2d');
  return contextoTeste!;
}

function decodificarArcos(topo: Topologia): Float32Array[] {
  const [sx, sy] = topo.transform.scale;
  const [tx, ty] = topo.transform.translate;
  return topo.arcs.map((arco) => {
    const out = new Float32Array(arco.length * 2);
    let x = 0, y = 0;
    for (let i = 0; i < arco.length; i++) {
      x += arco[i][0]; y += arco[i][1];
      out[i * 2] = x * sx + tx; out[i * 2 + 1] = y * sy + ty;
    }
    return out;
  });
}

function aneisDe(g: { type: string; arcs: number[][] | number[][][] }): number[][][] {
  return g.type === 'Polygon' ? [g.arcs as number[][]] : (g.arcs as number[][][]);
}

/** Acrescenta um anel ao caminho e expande a caixa. */
function tracarAnel(p: Path2D, anel: number[], arcos: Float32Array[], cx: number[]) {
  let primeiro = true;
  for (const a of anel) {
    const arco = arcos[a < 0 ? ~a : a];
    const n = arco.length / 2;
    for (let k = 0; k < n; k++) {
      const j = a < 0 ? n - 1 - k : k;
      if (k === 0 && !primeiro) continue;
      const x = arco[j * 2], y = arco[j * 2 + 1];
      if (primeiro) { p.moveTo(x, y); primeiro = false; } else p.lineTo(x, y);
      if (x < cx[0]) cx[0] = x; if (y < cx[1]) cx[1] = y; if (x > cx[2]) cx[2] = x; if (y > cx[3]) cx[3] = y;
    }
  }
  p.closePath();
}

function tracarArco(p: Path2D, arco: Float32Array) {
  p.moveTo(arco[0], arco[1]);
  for (let k = 1; k < arco.length / 2; k++) p.lineTo(arco[k * 2], arco[k * 2 + 1]);
}

/** Índice espacial em grade sobre caixas. */
function criarGrade(caixas: Float32Array, n: number, total: [number, number, number, number], celulas = 96) {
  const [x0, y0, x1, y1] = total;
  const tam = Math.max(x1 - x0, y1 - y0) / celulas;
  const cols = Math.ceil((x1 - x0) / tam) + 1, lins = Math.ceil((y1 - y0) / tam) + 1;
  const baldes: number[][] = Array.from({ length: cols * lins }, () => []);
  for (let i = 0; i < n; i++) {
    const a = Math.floor((caixas[i * 4] - x0) / tam), b = Math.floor((caixas[i * 4 + 1] - y0) / tam);
    const c = Math.floor((caixas[i * 4 + 2] - x0) / tam), d = Math.floor((caixas[i * 4 + 3] - y0) / tam);
    for (let gx = Math.max(0, a); gx <= Math.min(cols - 1, c); gx++) for (let gy = Math.max(0, b); gy <= Math.min(lins - 1, d); gy++) baldes[gy * cols + gx].push(i);
  }
  return (x: number, y: number): number[] => {
    const gx = Math.floor((x - x0) / tam), gy = Math.floor((y - y0) / tam);
    if (gx < 0 || gy < 0 || gx >= cols || gy >= lins) return [];
    return baldes[gy * cols + gx];
  };
}

export async function carregarBrasil(url = '/geo/brasil-v1.json'): Promise<GeoBrasil> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Geografia indisponível (${r.status})`);
  const dados = (await r.json()) as ArquivoBrasil;
  const topo = dados.topologia;
  const arcos = decodificarArcos(topo);
  const m = dados.municipios;
  const n = m.ibge.length;
  const geoms = topo.objects.municipios.geometries;
  if (geoms.length !== n) throw new Error('Geometrias e cadastro de municípios divergem.');

  const caminho: Path2D[] = new Array(n);
  const caixa = new Float32Array(n * 4);
  const uso = new Int32Array(arcos.length * 2).fill(-1);
  const total: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const g = geoms[i];
    if (g.id !== m.ibge[i]) throw new Error(`Ordem da geometria divergente em ${i}: ${g.id} ≠ ${m.ibge[i]}`);
    const p = new Path2D();
    const cx = [Infinity, Infinity, -Infinity, -Infinity];
    for (const poligono of aneisDe(g)) for (const anel of poligono) {
      tracarAnel(p, anel, arcos, cx);
      for (const a of anel) { const k = a < 0 ? ~a : a; if (uso[k * 2] === -1) uso[k * 2] = i; else if (uso[k * 2] !== i) uso[k * 2 + 1] = i; }
    }
    caminho[i] = p;
    caixa.set(cx, i * 4);
    total[0] = Math.min(total[0], cx[0]); total[1] = Math.min(total[1], cx[1]); total[2] = Math.max(total[2], cx[2]); total[3] = Math.max(total[3], cx[3]);
  }

  // Classificação dos arcos: borda municipal (mesma UF), divisa estadual, contorno externo.
  const bordasMun = new Path2D(), bordasUf = new Path2D(), contorno = new Path2D();
  const bordasMunDaUf = new Map<string, Path2D>();
  for (let k = 0; k < arcos.length; k++) {
    const a = uso[k * 2], b = uso[k * 2 + 1];
    if (a === -1) continue;
    if (b === -1) { tracarArco(contorno, arcos[k]); continue; }
    if (m.uf[a] === m.uf[b]) {
      tracarArco(bordasMun, arcos[k]);
      if (!bordasMunDaUf.has(m.uf[a])) bordasMunDaUf.set(m.uf[a], new Path2D());
      tracarArco(bordasMunDaUf.get(m.uf[a])!, arcos[k]);
    } else tracarArco(bordasUf, arcos[k]);
  }

  const ufs: UfGeo[] = dados.ufs.map((u) => {
    const g = topo.objects.ufs.geometries.find((x) => x.id === u.uf)!;
    const p = new Path2D();
    const cx = [Infinity, Infinity, -Infinity, -Infinity];
    for (const poligono of aneisDe(g)) for (const anel of poligono) tracarAnel(p, anel, arcos, cx);
    return { ...u, caixa: cx as [number, number, number, number], caminho: p };
  });
  const ufIndice = new Map(ufs.map((u, k) => [u.uf, k]));
  const municipiosDaUf = new Map<string, Int32Array>();
  const tmp = new Map<string, number[]>();
  for (let i = 0; i < n; i++) { if (!tmp.has(m.uf[i])) tmp.set(m.uf[i], []); tmp.get(m.uf[i])!.push(i); }
  for (const [uf, l] of tmp) municipiosDaUf.set(uf, Int32Array.from(l));

  const rotulo = new Float32Array(n * 2);
  m.rotulo.forEach((r2, i) => { rotulo[i * 2] = r2?.[0] ?? (caixa[i * 4] + caixa[i * 4 + 2]) / 2; rotulo[i * 2 + 1] = r2?.[1] ?? (caixa[i * 4 + 1] + caixa[i * 4 + 3]) / 2; });

  const grade = criarGrade(caixa, n, total);
  const caixasUf = new Float32Array(ufs.length * 4);
  ufs.forEach((u, k) => caixasUf.set(u.caixa, k * 4));
  const gradeUf = criarGrade(caixasUf, ufs.length, total, 24);

  const encontrar = (x: number, y: number) => {
    const ctx = ctxTeste();
    for (const i of grade(x, y)) {
      if (x < caixa[i * 4] || x > caixa[i * 4 + 2] || y < caixa[i * 4 + 1] || y > caixa[i * 4 + 3]) continue;
      if (ctx.isPointInPath(caminho[i], x, y)) return i;
    }
    return -1;
  };
  const encontrarUf = (x: number, y: number) => {
    const ctx = ctxTeste();
    for (const k of gradeUf(x, y)) {
      const c = ufs[k].caixa;
      if (x < c[0] || x > c[2] || y < c[1] || y > c[3]) continue;
      if (ctx.isPointInPath(ufs[k].caminho, x, y)) return k;
    }
    return -1;
  };

  return {
    tipo: 'brasil', n, ibge: m.ibge, tse: m.tse, uf: m.uf, nome: m.nome, rotulo, raio: Float32Array.from(m.raio), caixa, caminho,
    ufs, ufIndice, municipiosDaUf,
    porIbge: new Map(m.ibge.map((c, i) => [c, i])), porTse: new Map(m.tse.map((c, i) => [c, i])),
    bordasMun, bordasUf, contorno, bordasMunDaUf,
    caixaContinental: dados.caixaContinental, caixaTotal: total,
    encontrar, encontrarUf,
  };
}

interface ArquivoMundo {
  versao: 1;
  paises: { iso: string; nome: string; caminho: string; caixa: [number, number, number, number] }[];
  brasilUfs: { uf: string; caminho: string }[];
  cidades: CidadeGeo[];
}

export async function carregarMundo(url = '/geo/mundo-v1.json'): Promise<GeoMundo> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Mapa-múndi indisponível (${r.status})`);
  const d = (await r.json()) as ArquivoMundo;
  const paises: PaisGeo[] = d.paises.filter((p) => p.caminho).map((p) => ({ iso: p.iso, nome: p.nome, caixa: p.caixa, caminho: new Path2D(p.caminho) }));
  const total: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of paises) { total[0] = Math.min(total[0], p.caixa[0]); total[1] = Math.min(total[1], p.caixa[1]); total[2] = Math.max(total[2], p.caixa[2]); total[3] = Math.max(total[3], p.caixa[3]); }
  const caixas = new Float32Array(paises.length * 4);
  paises.forEach((p, k) => caixas.set(p.caixa, k * 4));
  const grade = criarGrade(caixas, paises.length, total, 48);
  return {
    tipo: 'mundo', paises,
    porIso: new Map(paises.map((p) => [p.iso, p])),
    brasilUfs: d.brasilUfs.map((u) => ({ uf: u.uf, caminho: new Path2D(u.caminho) })),
    cidades: d.cidades,
    cidadePorTse: new Map(d.cidades.map((c) => [c.tse, c])),
    caixaTotal: total,
    encontrarPais: (x, y) => {
      const ctx = ctxTeste();
      // países pequenos primeiro (enclaves)
      const cands = grade(x, y).slice().sort((a, b) => (caixas[a * 4 + 2] - caixas[a * 4]) - (caixas[b * 4 + 2] - caixas[b * 4]));
      for (const k of cands) {
        const c = paises[k].caixa;
        if (x < c[0] || x > c[2] || y < c[1] || y > c[3]) continue;
        if (ctx.isPointInPath(paises[k].caminho, x, y)) return k;
      }
      return -1;
    },
  };
}

export interface ZonaGeo { zona: string; caminho: Path2D; rotulo: [number, number] | null; caixa: [number, number, number, number]; locais: number }
export interface ZonasGeo { municipio: string; aproximado: true; metodo: string; zonas: ZonaGeo[]; encontrar: (x: number, y: number) => string | null }

const zonasCache = new Map<string, Promise<ZonasGeo | null>>();
/** Áreas aproximadas das zonas de um município (null quando não há geometria). */
export function carregarZonasGeo(tse: string): Promise<ZonasGeo | null> {
  if (!zonasCache.has(tse)) {
    zonasCache.set(tse, fetch(`/geo/zonas/${tse}.json`).then(async (r): Promise<ZonasGeo | null> => {
      if (!r.ok) return null;
      const d = (await r.json()) as { municipio: string; metodo: string; zonas: { zona: string; poligonos: number[][][][]; rotulo: [number, number] | null; locais: number }[] };
      const zonas: ZonaGeo[] = d.zonas.map((z) => {
        const p = new Path2D();
        const cx = [Infinity, Infinity, -Infinity, -Infinity];
        for (const pg of z.poligonos) for (const anel of pg) {
          anel.forEach(([x, y], k) => { if (k === 0) p.moveTo(x, y); else p.lineTo(x, y); cx[0] = Math.min(cx[0], x); cx[1] = Math.min(cx[1], y); cx[2] = Math.max(cx[2], x); cx[3] = Math.max(cx[3], y); });
          p.closePath();
        }
        return { zona: z.zona, caminho: p, rotulo: z.rotulo, caixa: cx as [number, number, number, number], locais: z.locais };
      });
      return {
        municipio: d.municipio, aproximado: true as const, metodo: d.metodo, zonas,
        encontrar: (x: number, y: number) => {
          const ctx = ctxTeste();
          for (const z of zonas) {
            const c = z.caixa;
            if (x < c[0] || x > c[2] || y < c[1] || y > c[3]) continue;
            if (ctx.isPointInPath(z.caminho, x, y, 'evenodd')) return z.zona;
          }
          return null;
        },
      };
    }).catch(() => null));
  }
  return zonasCache.get(tse)!;
}
