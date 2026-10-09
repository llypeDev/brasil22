// Áreas APROXIMADAS das zonas eleitorais — não são limites oficiais (o TSE não publica).
//
// Fonte: TSE Dados Abertos, eleitorado por local de votação 2026
// (eleitorado_local_votacao_2026.zip, arquivo _BRASIL.csv). Desse arquivo são lidos APENAS:
// UF, código do município, zona, número do local, latitude, longitude e eleitores da seção.
// Telefone, endereço, bairro e nomes de locais não são lidos nem gravados.
//
// Método: para cada município com mais de uma zona, os locais de votação (pontos) são
// projetados no mesmo espaço do mapa; calcula-se o diagrama de Voronoi dos locais, as células
// são unidas por zona e recortadas pelo contorno do município. Pontos fora do município ou com
// coordenada inválida são descartados. Sem ao menos duas zonas com pontos válidos, o município
// fica sem geometria de zona (o painel mantém o mapa municipal).
//
// Saída: public/geo/zonas/{codigoTSE}.json

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yauzl from 'yauzl';
import { geoMercator } from 'd3-geo';
import { Delaunay } from 'd3-delaunay';
import polygonClipping from 'polygon-clipping';
import { feature } from 'topojson-client';
import { pontoDeRotulo, arredondar } from '../lib/geometria.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ZIP = join(RAIZ, 'dados-brutos', 'tse-locais', 'eleitorado_local_votacao_2026.zip');
const SAIDA = join(RAIZ, 'public', 'geo', 'zonas');

const lerJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

function linhaCsv(l) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ';') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur.replace(/\r$/, ''));
  return out;
}

function entrada(zip, nome) {
  return new Promise((resolve, reject) => {
    yauzl.open(zip, { lazyEntries: true }, (e, z) => {
      if (e) return reject(e);
      z.on('entry', (en) => { if (en.fileName !== nome) return z.readEntry(); z.openReadStream(en, (e2, s) => (e2 ? reject(e2) : resolve(s))); });
      z.on('end', () => reject(new Error(`${nome} ausente`)));
      z.readEntry();
    });
  });
}

const coord = (s) => { if (!s || s === '-1') return null; const n = Number(String(s).replace(',', '.')); return Number.isFinite(n) && n !== 0 ? n : null; };

function dentro([x, y], aneis) {
  let d = false;
  for (const anel of aneis) for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const a = anel[i], b = anel[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) d = !d;
  }
  return d;
}

async function main() {
  const geo = await lerJson(join(RAIZ, 'public', 'geo', 'brasil-v1.json'));
  const manifesto = await lerJson(join(RAIZ, 'dados', 'publicado', 'oficial', 'manifesto.json'));
  const alvo = new Map(Object.entries(manifesto.zonasPorMunicipio ?? {}).map(([tse, zs]) => [tse, new Set(zs.map(String))]));
  const proj = geoMercator().scale(geo.projecao.escala).translate(geo.projecao.translacao);
  const feats = feature(geo.topologia, geo.topologia.objects.municipios).features;
  const idx = new Map(geo.municipios.tse.map((t, i) => [t, i]));

  // locais: tse → (local|zona) → { x, y, zona, eleitores }
  const locais = new Map();
  const fluxo = await entrada(ZIP, 'eleitorado_local_votacao_2026_BRASIL.csv');
  fluxo.setEncoding('latin1');
  const rl = createInterface({ input: fluxo, crlfDelay: Infinity });
  let cab = null; const ix = {}; let linhas = 0, usadas = 0;
  for await (const l of rl) {
    if (!cab) { cab = linhaCsv(l); cab.forEach((c, i) => { ix[c] = i; }); continue; }
    linhas++;
    const c = linhaCsv(l);
    if (c[ix.NR_TURNO] !== '1') continue;
    const tse = c[ix.CD_MUNICIPIO].padStart(5, '0');
    const zonas = alvo.get(tse);
    if (!zonas) continue;
    const zona = String(Number(c[ix.NR_ZONA]));
    if (!zonas.has(zona)) continue;
    const lat = coord(c[ix.NR_LATITUDE]), lon = coord(c[ix.NR_LONGITUDE]);
    if (lat == null || lon == null) continue;
    const [x, y] = proj([lon, lat]);
    const chave = `${c[ix.NR_LOCAL_VOTACAO]}|${zona}`;
    if (!locais.has(tse)) locais.set(tse, new Map());
    const m = locais.get(tse);
    const atual = m.get(chave) ?? { x, y, zona, eleitores: 0 };
    atual.eleitores += Number(c[ix.QT_ELEITOR_SECAO]) || 0;
    m.set(chave, atual);
    usadas++;
  }
  console.log(`${linhas} seções lidas · ${usadas} em municípios com zonas`);

  await mkdir(SAIDA, { recursive: true });
  let feitos = 0; const pulados = [];
  for (const [tse, mapa] of locais) {
    const i = idx.get(tse);
    if (i == null) { pulados.push(`${tse}: sem geometria municipal`); continue; }
    const g = feats[i].geometry;
    const poligonosMun = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    // pontos válidos dentro do município; coincidentes ficam com a zona de mais eleitores
    const porCoord = new Map();
    for (const p of mapa.values()) {
      if (!poligonosMun.some((pg) => dentro([p.x, p.y], pg))) continue;
      const k = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
      const ant = porCoord.get(k);
      if (!ant || ant.eleitores < p.eleitores) porCoord.set(k, p);
    }
    const pts = [...porCoord.values()];
    const zonasComPontos = new Set(pts.map((p) => p.zona));
    if (zonasComPontos.size < 2) { pulados.push(`${tse}: ${zonasComPontos.size} zona(s) com locais válidos`); continue; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const pg of poligonosMun) for (const [x, y] of pg[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const folga = Math.max(x1 - x0, y1 - y0);
    const vor = Delaunay.from(pts, (p) => p.x, (p) => p.y).voronoi([x0 - folga, y0 - folga, x1 + folga, y1 + folga]);
    const celulas = new Map();
    pts.forEach((p, k) => {
      const cel = vor.cellPolygon(k);
      if (!cel) return;
      if (!celulas.has(p.zona)) celulas.set(p.zona, []);
      celulas.get(p.zona).push([cel]);
    });
    const contorno = poligonosMun.map((pg) => pg.map((anel) => anel.map(([x, y]) => [x, y])));
    const zonasSaida = [];
    for (const [zona, cels] of celulas) {
      let uniao;
      try { uniao = polygonClipping.union(...cels); } catch { continue; }
      let recorte;
      try { recorte = polygonClipping.intersection(uniao, contorno); } catch { continue; }
      if (!recorte.length) continue;
      const aneis = recorte.map((pg) => pg.map((anel) => anel.map(([x, y]) => [arredondar(x, 2), arredondar(y, 2)])));
      const r = pontoDeRotulo({ type: 'MultiPolygon', coordinates: aneis });
      zonasSaida.push({ zona, poligonos: aneis, rotulo: r ? [arredondar(r[0], 2), arredondar(r[1], 2)] : null, locais: pts.filter((p) => p.zona === zona).length });
    }
    zonasSaida.sort((a, b) => Number(a.zona) - Number(b.zona));
    await writeFile(join(SAIDA, `${tse}.json`), JSON.stringify({
      versao: 1, municipio: tse, aproximado: true,
      metodo: 'Voronoi dos locais de votação (TSE, eleitorado por local de votação 2026), unido por zona e recortado pelo município. Não é limite oficial.',
      zonas: zonasSaida,
    }));
    feitos++;
  }
  console.log(`${feitos} municípios com áreas aproximadas · ${pulados.length} sem geometria de zona`);
  if (pulados.length) console.log(pulados.slice(0, 15).join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
