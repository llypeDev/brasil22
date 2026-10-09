// Prepara as geometrias usadas no painel a partir de fontes oficiais/abertas.
//
// Brasil: malhas municipais do IBGE (assets-pesquisa/municipios/{uf}.geojson, ver
// assets-pesquisa/FONTES_E_USO.md) projetadas em Mercator, convertidas em TopoJSON com
// fronteiras compartilhadas, simplificadas preservando a topologia e acompanhadas de
// pontos de rótulo e caixas. UFs são a fusão (mergeArcs) dos municípios, para que as
// divisas coincidam exatamente com as bordas municipais.
//
// Mundo: Natural Earth 1:50m (domínio público), projeção Natural Earth, caminhos SVG
// pré-projetados por país e as cidades do exterior do cadastro do TSE com coordenadas e
// fuso do Natural Earth (populated places 1:10m).
//
// Saída: public/geo/brasil-v1.json e public/geo/mundo-v1.json

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea, geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { mergeArcs, feature, quantize } from 'topojson-client';
import { find as fusoDe } from 'geo-tz';
import { arredondar, caixa, pontoDeRotulo, poligonos } from '../lib/geometria.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PESQUISA = join(RAIZ, '..', 'assets-pesquisa');
const BRUTOS = join(RAIZ, 'dados-brutos');
const SAIDA = join(RAIZ, 'public', 'geo');

const LARGURA = 10000; // unidades do espaço projetado do Brasil
const PERCENTIL = Number(process.env.GEO_PERCENTIL ?? 0.6); // fração de vértices interiores mantida (quantile usa ordem decrescente)
const REGIOES = { N: 'Norte', NE: 'Nordeste', CO: 'Centro-Oeste', SE: 'Sudeste', S: 'Sul' };

const lerJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const normalizar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function projetarGeometria(geom, proj, casas = 2) {
  const p = ([x, y]) => { const q = proj([x, y]); return [arredondar(q[0], casas), arredondar(q[1], casas)]; };
  const anel = (a) => a.map(p);
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: geom.coordinates.map(anel) };
  return { type: 'MultiPolygon', coordinates: geom.coordinates.map((pg) => pg.map(anel)) };
}

/**
 * d3-geo usa geometria esférica: um anel com o enrolamento oposto ao esperado vira o
 * complemento do globo. Fontes no padrão RFC 7946 (IBGE, Natural Earth) precisam ser
 * reenroladas — polígono com área esférica maior que meia esfera tem os anéis invertidos.
 */
function reenrolar(geom) {
  if (!geom) return geom;
  const ajustar = (pg) => (geoArea({ type: 'Polygon', coordinates: pg }) > 2 * Math.PI ? pg.map((anel) => [...anel].reverse()) : pg);
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: ajustar(geom.coordinates) };
  if (geom.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geom.coordinates.map(ajustar) };
  return geom;
}

/** Mercator ajustado no plano: escala e translação a partir da caixa dos vértices projetados. */
function mercatorPlanar(feats, largura) {
  const base = geoMercator().scale(1).translate([0, 0]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of feats) for (const pg of poligonos(f.geometry)) for (const [lon, lat] of pg[0]) {
    const [x, y] = base([lon, lat]);
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  const k = largura / (x1 - x0);
  return { proj: geoMercator().scale(k).translate([-x0 * k, -y0 * k]), caixa: [0, 0, largura, (y1 - y0) * k] };
}

function contarPontos(topo) {
  return topo.arcs.reduce((s, a) => s + a.length, 0);
}

async function brasil() {
  const nomesIbge = new Map((await lerJson(join(BRUTOS, 'ibge', 'municipios.json'))).map((m) => [String(m['municipio-id']), m]));
  const estados = await lerJson(join(PESQUISA, 'estados.json'));
  const arquivos = (await readdir(join(PESQUISA, 'municipios'))).filter((f) => f.endsWith('.geojson')).sort();
  const feats = [];
  for (const arq of arquivos) {
    const g = await lerJson(join(PESQUISA, 'municipios', arq));
    for (const f of g.features) feats.push(f);
  }
  // Ordem estável: por UF e código IBGE. Essa ordem define o índice do mapa no cliente,
  // sempre acompanhado da lista explícita de códigos (nunca usado sozinho como chave).
  feats.sort((a, b) => a.properties.ibge.localeCompare(b.properties.ibge));

  // Enquadramento continental: ilhas oceânicas (Fernando de Noronha, Trindade) ficam de fora
  // do ajuste da projeção para não comprimir o continente.
  const continental = {
    type: 'FeatureCollection',
    features: feats.map((f) => ({
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: poligonos(f.geometry).filter((pg) => pg[0].some(([lon]) => lon < -34.5)) },
    })).filter((f) => f.geometry.coordinates.length),
  };
  const { proj, caixa: caixaPlanar } = mercatorPlanar(continental.features, LARGURA);

  const projetados = feats.map((f) => ({
    type: 'Feature',
    id: f.properties.ibge,
    properties: { uf: f.properties.uf },
    geometry: projetarGeometria(f.geometry, proj),
  }));
  const bboxContinental = caixaPlanar.map((v) => arredondar(v, 1));

  let topo = topology({ municipios: { type: 'FeatureCollection', features: projetados } }, 5e4);
  const antes = contarPontos(topo);
  topo = presimplify(topo);
  // Remove apenas os vértices de menor peso (área de triângulo), sem colapsar anéis.
  topo = simplify(topo, quantile(topo, PERCENTIL));
  topo = quantize(topo, 5e4); // inteiros com codificação delta
  const depois = contarPontos(topo);

  // UFs como fusão dos municípios (mesmos arcos → divisas idênticas às bordas municipais).
  const geoms = topo.objects.municipios.geometries;
  const porUf = new Map();
  geoms.forEach((g) => { const uf = g.properties.uf; if (!porUf.has(uf)) porUf.set(uf, []); porUf.get(uf).push(g); });
  const ufsGeom = [];
  for (const [uf, lista] of [...porUf.entries()].sort()) {
    const m = mergeArcs(topo, lista);
    ufsGeom.push({ ...m, id: uf });
  }
  topo.objects.ufs = { type: 'GeometryCollection', geometries: ufsGeom };
  geoms.forEach((g) => { delete g.properties; });

  // Pontos de rótulo e caixas a partir da topologia já simplificada (coerente com o desenho).
  const munFeat = feature(topo, topo.objects.municipios).features;
  const municipios = munFeat.map((f, i) => {
    const original = feats[i].properties;
    const ibge = nomesIbge.get(original.ibge);
    const r = pontoDeRotulo(f.geometry);
    return {
      ibge: original.ibge,
      tse: original.tse,
      uf: original.uf,
      nome: ibge?.['municipio-nome'] ?? original.nome,
      rotulo: r ? [Math.round(r[0]), Math.round(r[1])] : null,
      raio: r ? arredondar(r[2], 1) : 0,
    };
  });
  const ufFeat = feature(topo, topo.objects.ufs).features;
  const ufs = ufFeat.map((f) => {
    const e = estados.find((x) => x.sigla === f.id);
    const r = pontoDeRotulo(f.geometry, 2);
    return {
      uf: f.id,
      ibge: String(e.id),
      nome: e.nome,
      regiao: REGIOES[e.regiao.sigla],
      rotulo: [arredondar(r[0], 1), arredondar(r[1], 1)],
      raio: arredondar(r[2], 1),
      caixa: caixa(f.geometry).map((v) => arredondar(v, 1)),
    };
  });

  const s = proj.scale(), t = proj.translate();
  const saida = {
    versao: 1,
    fonte: 'IBGE — malhas municipais (API v3, qualidade mínima; MT pela malha municipal 2025). Projeção Mercator, simplificada para visualização.',
    projecao: { tipo: 'mercator', escala: s, translacao: t },
    caixaContinental: bboxContinental,
    ufs,
    municipios: {
      ibge: municipios.map((m) => m.ibge),
      tse: municipios.map((m) => m.tse),
      uf: municipios.map((m) => m.uf),
      nome: municipios.map((m) => m.nome),
      rotulo: municipios.map((m) => m.rotulo),
      raio: municipios.map((m) => m.raio),
    },
    topologia: topo,
  };
  await writeFile(join(SAIDA, 'brasil-v1.json'), JSON.stringify(saida));
  console.log(`Brasil: ${municipios.length} municípios, ${ufs.length} UFs, pontos ${antes} → ${depois}`);
  return { proj };
}

// Grafias do cadastro do TSE que não coincidem com NAME_PT do Natural Earth.
// Cada entrada: nome normalizado do TSE → [nome Natural Earth (inglês), ISO_A2].
const SINONIMOS = {
  'abidja': ['Abidjan', 'CI'], 'adis abeba': ['Addis Ababa', 'ET'], 'amsterda': ['Amsterdam', 'NL'],
  'assuncao': ['Asuncion', 'PY'], 'atenas': ['Athens', 'GR'], 'barcelona': ['Barcelona', 'ES'],
  'berlim': ['Berlin', 'DE'], 'berna': ['Bern', 'CH'], 'bogota': ['Bogota', 'CO'],
  'boston': ['Boston', 'US'], 'bruxelas': ['Brussels', 'BE'], 'budapeste': ['Budapest', 'HU'],
  'buenos aires': ['Buenos Aires', 'AR'], 'cairo': ['Cairo', 'EG'], 'camberra': ['Canberra', 'AU'],
  'caracas': ['Caracas', 'VE'], 'cidade do cabo': ['Cape Town', 'ZA'], 'cidade do mexico': ['Mexico City', 'MX'],
  'cidade do panama': ['Panama City', 'PA'], 'cidade da guatemala': ['Guatemala', 'GT'], 'copenhague': ['Copenhagen', 'DK'],
  'dublin': ['Dublin', 'IE'], 'estocolmo': ['Stockholm', 'SE'], 'genebra': ['Geneva', 'CH'],
  'georgetown': ['Georgetown', 'GY'], 'hamamatsu': ['Hamamatsu', 'JP'], 'havana': ['Havana', 'CU'],
  'helsinque': ['Helsinki', 'FI'], 'hong kong': ['Hong Kong', 'HK'], 'istambul': ['Istanbul', 'TR'],
  'jacarta': ['Jakarta', 'ID'], 'joanesburgo': ['Johannesburg', 'ZA'], 'kiev': ['Kiev', 'UA'],
  'kuala lumpur': ['Kuala Lumpur', 'MY'], 'la paz': ['La Paz', 'BO'], 'lima': ['Lima', 'PE'],
  'lisboa': ['Lisbon', 'PT'], 'londres': ['London', 'GB'], 'los angeles': ['Los Angeles', 'US'],
  'luanda': ['Luanda', 'AO'], 'madri': ['Madrid', 'ES'], 'managua': ['Managua', 'NI'],
  'maputo': ['Maputo', 'MZ'], 'miami': ['Miami', 'US'], 'milao': ['Milan', 'IT'],
  'montevideu': ['Montevideo', 'UY'], 'moscou': ['Moscow', 'RU'], 'munique': ['Munich', 'DE'],
  'nagoia': ['Nagoya', 'JP'], 'nova delhi': ['New Delhi', 'IN'], 'nova york': ['New York', 'US'],
  'oslo': ['Oslo', 'NO'], 'otawa': ['Ottawa', 'CA'], 'ottawa': ['Ottawa', 'CA'], 'paris': ['Paris', 'FR'],
  'pequim': ['Beijing', 'CN'], 'porto': ['Porto', 'PT'], 'praga': ['Prague', 'CZ'], 'pretoria': ['Pretoria', 'ZA'],
  'quito': ['Quito', 'EC'], 'roma': ['Rome', 'IT'], 'santiago': ['Santiago', 'CL'], 'sao francisco': ['San Francisco', 'US'],
  'seul': ['Seoul', 'KR'], 'singapura': ['Singapore', 'SG'], 'sidney': ['Sydney', 'AU'], 'toquio': ['Tokyo', 'JP'],
  'toronto': ['Toronto', 'CA'], 'varsovia': ['Warsaw', 'PL'], 'viena': ['Vienna', 'AT'], 'washington': ['Washington, D.C.', 'US'],
  'zurique': ['Zurich', 'CH'], 'atlanta': ['Atlanta', 'US'], 'chicago': ['Chicago', 'US'], 'houston': ['Houston', 'US'],
  'hartford': ['Hartford', 'US'], 'orlando': ['Orlando', 'US'], 'montreal': ['Montreal', 'CA'], 'vancouver': ['Vancouver', 'CA'],
  'frankfurt': ['Frankfurt', 'DE'], 'hamburgo': ['Hamburg', 'DE'], 'roterda': ['Rotterdam', 'NL'], 'haia': ['The Hague', 'NL'],
  'faro': ['Faro', 'PT'], 'tel aviv': ['Tel Aviv-Yafo', 'IL'], 'beirute': ['Beirut', 'LB'], 'damasco': ['Damascus', 'SY'],
  'teera': ['Tehran', 'IR'], 'riade': ['Riyadh', 'SA'], 'doha': ['Doha', 'QA'], 'dubai': ['Dubai', 'AE'], 'abu dhabi': ['Abu Dhabi', 'AE'],
  'kuwait': ['Kuwait', 'KW'], 'ama': ['Amman', 'JO'], 'argel': ['Algiers', 'DZ'], 'rabat': ['Rabat', 'MA'], 'tunis': ['Tunis', 'TN'],
  'trípoli': ['Tripoli', 'LY'], 'tripoli': ['Tripoli', 'LY'], 'cartum': ['Khartoum', 'SD'], 'nairobi': ['Nairobi', 'KE'],
  'acra': ['Accra', 'GH'], 'accra': ['Accra', 'GH'], 'abuja': ['Abuja', 'NG'], 'lagos': ['Lagos', 'NG'], 'dacar': ['Dakar', 'SN'],
  'praia': ['Praia', 'CV'], 'bissau': ['Bissau', 'GW'], 'sao tome': ['Sao Tome', 'ST'], 'harare': ['Harare', 'ZW'],
  'gaborone': ['Gaborone', 'BW'], 'windhoek': ['Windhoek', 'NA'], 'lusaca': ['Lusaka', 'ZM'], 'kinshasa': ['Kinshasa', 'CD'],
  'brazzaville': ['Brazzaville', 'CG'], 'iaunde': ['Yaounde', 'CM'], 'malabo': ['Malabo', 'GQ'], 'libreville': ['Libreville', 'GA'],
  'cotonou': ['Cotonou', 'BJ'], 'lome': ['Lome', 'TG'], 'uagadugu': ['Ouagadougou', 'BF'], 'bamaco': ['Bamako', 'ML'],
  'conacri': ['Conakry', 'GN'], 'freetown': ['Freetown', 'SL'], 'monrovia': ['Monrovia', 'LR'], 'nouakchott': ['Nouakchott', 'MR'],
  'adis-abeba': ['Addis Ababa', 'ET'], 'dar es salaam': ['Dar es Salaam', 'TZ'], 'kampala': ['Kampala', 'UG'],
  'antananarivo': ['Antananarivo', 'MG'], 'port louis': ['Port Louis', 'MU'], 'maseru': ['Maseru', 'LS'], 'mbabane': ['Mbabane', 'SZ'],
  'nova orleans': ['New Orleans', 'US'], 'filadelfia': ['Philadelphia', 'US'], 'cidade de guatemala': ['Guatemala', 'GT'],
  'san jose': ['San Jose', 'CR'], 'sao jose': ['San Jose', 'CR'], 'sao salvador': ['San Salvador', 'SV'], 'san salvador': ['San Salvador', 'SV'],
  'tegucigalpa': ['Tegucigalpa', 'HN'], 'santo domingo': ['Santo Domingo', 'DO'], 'porto principe': ['Port-au-Prince', 'HT'],
  'kingston': ['Kingston', 'JM'], 'port of spain': ['Port of Spain', 'TT'], 'bridgetown': ['Bridgetown', 'BB'],
  'paramaribo': ['Paramaribo', 'SR'], 'caiena': ['Cayenne', 'GF'], 'assuncao do paraguai': ['Asuncion', 'PY'],
  'ciudad del este': ['Ciudad del Este', 'PY'], 'encarnacion': ['Encarnacion', 'PY'], 'pedro juan caballero': ['Pedro Juan Caballero', 'PY'],
  'cordoba': ['Cordoba', 'AR'], 'mendoza': ['Mendoza', 'AR'], 'rosario': ['Rosario', 'AR'], 'puerto iguazu': ['Puerto Iguazu', 'AR'],
  'santa cruz de la sierra': ['Santa Cruz', 'BO'], 'cochabamba': ['Cochabamba', 'BO'], 'cobija': ['Cobija', 'BO'],
  'guayaquil': ['Guayaquil', 'EC'], 'medellin': ['Medellin', 'CO'], 'leticia': ['Leticia', 'CO'], 'iquitos': ['Iquitos', 'PE'],
  'rivera': ['Rivera', 'UY'], 'punta del este': ['Punta del Este', 'UY'], 'valparaiso': ['Valparaiso', 'CL'],
  'manchester': ['Manchester', 'GB'], 'edimburgo': ['Edinburgh', 'GB'], 'lyon': ['Lyon', 'FR'], 'marselha': ['Marseille', 'FR'],
  'nice': ['Nice', 'FR'], 'bordeaux': ['Bordeaux', 'FR'], 'colonia': ['Cologne', 'DE'], 'stuttgart': ['Stuttgart', 'DE'],
  'veneza': ['Venice', 'IT'], 'florenca': ['Florence', 'IT'], 'napoles': ['Naples', 'IT'], 'turim': ['Turin', 'IT'],
  'bolonha': ['Bologna', 'IT'], 'genova': ['Genoa', 'IT'], 'sevilha': ['Seville', 'ES'], 'valencia': ['Valencia', 'ES'],
  'malaga': ['Malaga', 'ES'], 'palma de maiorca': ['Palma', 'ES'], 'bilbau': ['Bilbao', 'ES'], 'vigo': ['Vigo', 'ES'],
  'luxemburgo': ['Luxembourg', 'LU'], 'mônaco': ['Monaco', 'MC'], 'bucareste': ['Bucharest', 'RO'], 'sofia': ['Sofia', 'BG'],
  'belgrado': ['Belgrade', 'RS'], 'zagreb': ['Zagreb', 'HR'], 'liubliana': ['Ljubljana', 'SI'], 'bratislava': ['Bratislava', 'SK'],
  'tallinn': ['Tallinn', 'EE'], 'riga': ['Riga', 'LV'], 'vilnius': ['Vilnius', 'LT'], 'reykjavik': ['Reykjavik', 'IS'],
  'nicosia': ['Nicosia', 'CY'], 'valeta': ['Valletta', 'MT'], 'ancara': ['Ankara', 'TR'], 'baku': ['Baku', 'AZ'],
  'tbilisi': ['Tbilisi', 'GE'], 'ierevan': ['Yerevan', 'AM'], 'astana': ['Astana', 'KZ'], 'islamabade': ['Islamabad', 'PK'],
  'colombo': ['Colombo', 'LK'], 'daca': ['Dhaka', 'BD'], 'catmandu': ['Kathmandu', 'NP'], 'bangcoc': ['Bangkok', 'TH'],
  'hanoi': ['Hanoi', 'VN'], 'manila': ['Manila', 'PH'], 'xangai': ['Shanghai', 'CN'], 'cantao': ['Guangzhou', 'CN'],
  'taipe': ['Taipei', 'TW'], 'osaka': ['Osaka', 'JP'], 'mumbai': ['Mumbai', 'IN'], 'wellington': ['Wellington', 'NZ'],
  'auckland': ['Auckland', 'NZ'], 'melbourne': ['Melbourne', 'AU'], 'perth': ['Perth', 'AU'], 'brisbane': ['Brisbane', 'AU'],
  'dili': ['Dili', 'TL'], 'baga': ['Baghdad', 'IQ'], 'bagda': ['Baghdad', 'IQ'], 'mascate': ['Muscat', 'OM'],
  'manama': ['Manama', 'BH'], 'barein': ['Manama', 'BH'], 'dacca': ['Dhaka', 'BD'], 'katmandu': ['Kathmandu', 'NP'],
  'kingston jamaica': ['Kingston', 'JM'], 'kuaite': ['Kuwait', 'KW'], 'lilongue': ['Lilongwe', 'MW'], 'mexico': ['Mexico City', 'MX'],
  'panama': ['Panama City', 'PA'], 'saint johns': ["Saint John's", 'AG'], 'sao domingos': ['Santo Domingo', 'DO'], 'talin': ['Tallinn', 'EE'], 'jerusalem': ['Jerusalem', 'IL'], 'ramala': ['Ramallah', 'PS'], 'adis': ['Addis Ababa', 'ET'],
};

// Localidades de fronteira ausentes do Natural Earth 1:10m: coordenadas da sede municipal (consulta manual, registrar em docs/ASSETS.md).
const MANUAIS = {
  'chuy': { nome: 'Chuy', pais: 'UY', paisNome: 'Uruguay', lat: -33.6971, lon: -53.4594, fuso: 'America/Montevideo' },
  'paso los libres': { nome: 'Paso de los Libres', pais: 'AR', paisNome: 'Argentina', lat: -29.7125, lon: -57.0877, fuso: 'America/Argentina/Cordoba' },
  'puerto iguazu': { nome: 'Puerto Iguazú', pais: 'AR', paisNome: 'Argentina', lat: -25.5991, lon: -54.5736, fuso: 'America/Argentina/Cordoba' },
  'santa elena de uairen': { nome: 'Santa Elena de Uairén', pais: 'VE', paisNome: 'Venezuela', lat: 4.6036, lon: -61.1131, fuso: 'America/Caracas' },
  'rio branco': { nome: 'Río Branco', pais: 'UY', paisNome: 'Uruguay', lat: -32.5972, lon: -53.3847, fuso: 'America/Montevideo' },
  'salto del guaira': { nome: 'Salto del Guairá', pais: 'PY', paisNome: 'Paraguay', lat: -24.0625, lon: -54.3069, fuso: 'America/Asuncion' },
  'concepcion': { nome: 'Concepción', pais: 'PY', paisNome: 'Paraguay', lat: -23.4064, lon: -57.4344, fuso: 'America/Asuncion' },
  'st georges de loyapock': { nome: "Saint-Georges de l'Oyapock", pais: 'GF', paisNome: 'French Guiana', lat: 3.8907, lon: -51.8059, fuso: 'America/Cayenne' },
};

// Desambiguação por país quando o mesmo nome existe em mais de um lugar.
const PAIS_PREFERIDO = { 'santiago': 'CL', 'san jose': 'CR', 'georgetown': 'GY', 'valencia': 'ES', 'cordoba': 'AR', 'porto': 'PT', 'kingston': 'JM', 'tripoli': 'LY', 'praia': 'CV', 'victoria': 'SC' };

/**
 * O Natural Earth separa territórios que compartilham o código ISO (a Austrália tem também as
 * ilhas Ashmore e Cartier e os territórios do Oceano Índico). O painel agrega votos por código:
 * um país por ISO, com o nome e o enquadramento do maior polígono e os caminhos somados.
 */
function fundirPorIso(lista) {
  const grupos = new Map();
  for (const p of lista) { if (!grupos.has(p.iso)) grupos.set(p.iso, []); grupos.get(p.iso).push(p); }
  const area = (c) => (c[2] - c[0]) * (c[3] - c[1]);
  return [...grupos.values()].map((g) => {
    if (g.length === 1) return g[0];
    const principal = g.reduce((a, b) => (area(b.caixa) > area(a.caixa) ? b : a));
    return { ...principal, caminho: g.map((p) => p.caminho).join('') };
  });
}

async function mundo() {
  const paisesNE = await lerJson(join(BRUTOS, 'natural-earth', 'ne_50m_admin_0_countries.geojson'));
  const lugares = (await lerJson(join(BRUTOS, 'natural-earth', 'ne_10m_populated_places.geojson'))).features.map((f) => f.properties);
  const ufsLonLat = await lerJson(join(PESQUISA, 'br-uf.geojson'));
  const catalogo = await lerJson(join(BRUTOS, 'tse', 'oficial', 'ele2026', '6257', 'config', 'mun-e006257-cm.json'));
  const cidadesTse = catalogo.abr.find((a) => a.cd.toLowerCase() === 'zz').mu;

  const semAntartida = { type: 'FeatureCollection', features: paisesNE.features.filter((f) => f.properties.ISO_A2 !== 'AQ' && f.properties.ADM0_A3 !== 'ATA').map((f) => ({ ...f, geometry: reenrolar(f.geometry) })) };
  const proj = geoNaturalEarth1().rotate([-10, 0]).fitWidth(LARGURA, semAntartida);
  const caminho = geoPath(proj).digits(1);

  const iso2 = (p) => (p.ISO_A2 && p.ISO_A2 !== '-99' ? p.ISO_A2 : p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ADM0_A3);
  const paises = fundirPorIso(semAntartida.features.map((f) => {
    const p = f.properties;
    const b = caminho.bounds(f);
    return { iso: iso2(p), nome: p.NAME_PT || p.NAME, caminho: caminho(f), caixa: b.flat().map((v) => arredondar(v, 1)) };
  }));
  const brasilUfs = ufsLonLat.features.map((f) => ({ uf: f.properties.uf, caminho: caminho({ ...f, geometry: reenrolar(f.geometry) }) }));

  // Índice de lugares por nome normalizado (pt e en).
  const porNome = new Map();
  const add = (k, l) => { if (!k) return; const n = normalizar(k); if (!porNome.has(n)) porNome.set(n, []); porNome.get(n).push(l); };
  for (const l of lugares) { add(l.NAME_PT, l); add(l.NAME, l); add(l.NAMEASCII, l); add(l.NAME_EN, l); }

  const naoEncontradas = [];
  const cidades = [];
  for (const c of cidadesTse) {
    const n = normalizar(c.nm);
    let candidatos = [];
    if (MANUAIS[n]) candidatos = [];
    let paisForcado = PAIS_PREFERIDO[n];
    if (SINONIMOS[n]) {
      const [en, pais] = SINONIMOS[n];
      paisForcado = pais;
      candidatos = (porNome.get(normalizar(en)) ?? []).filter((l) => l.ISO_A2 === pais || l.ADM0_A3 === pais);
    }
    if (!candidatos.length && !MANUAIS[n]) candidatos = porNome.get(n) ?? [];
    candidatos = candidatos.filter((l) => l.ISO_A2 !== 'BR'); // cidades do cadastro estão fora do Brasil
    if (paisForcado) { const f = candidatos.filter((l) => l.ISO_A2 === paisForcado); if (f.length) candidatos = f; }
    candidatos.sort((a, b) => (b.POP_MAX ?? 0) - (a.POP_MAX ?? 0));
    let l = candidatos[0];
    if (!l && MANUAIS[n]) { const m = MANUAIS[n]; l = { ISO_A2: m.pais, ADM0NAME: m.paisNome, LONGITUDE: m.lon, LATITUDE: m.lat, TIMEZONE: m.fuso, NAME: m.nome, manual: true }; }
    if (!l) { naoEncontradas.push(c.nm); continue; }
    const [x, y] = proj([l.LONGITUDE, l.LATITUDE]);
    cidades.push({
      tse: c.cd,
      nome: c.nm,
      pais: l.ISO_A2 === '-99' ? l.ADM0_A3 : l.ISO_A2,
      paisNome: l.ADM0NAME,
      lon: arredondar(l.LONGITUDE, 4),
      lat: arredondar(l.LATITUDE, 4),
      x: arredondar(x, 1),
      y: arredondar(y, 1),
      fuso: l.manual ? l.TIMEZONE : fusoDe(l.LATITUDE, l.LONGITUDE)[0],
      nomeNE: l.NAME,
      ...(l.manual ? { manual: true } : {}),
    });
  }
  const saida = {
    versao: 1,
    fonte: 'Natural Earth 1:50m (países) e 1:10m (cidades), domínio público. Cadastro de cidades: TSE (mun-e006257-cm.json).',
    projecao: { tipo: 'naturalEarth1', rotacao: [-10, 0], escala: proj.scale(), translacao: proj.translate() },
    paises,
    brasilUfs,
    cidades,
    naoEncontradas,
  };
  await writeFile(join(SAIDA, 'mundo-v1.json'), JSON.stringify(saida));
  console.log(`Mundo: ${paises.length} países, ${cidades.length}/${cidadesTse.length} cidades localizadas.`);
  if (naoEncontradas.length) console.log('Cidades sem correspondência:', naoEncontradas.join(', '));
}

await mkdir(SAIDA, { recursive: true });
const so = process.argv[2];
if (!so || so === 'brasil') await brasil();
if (!so || so === 'mundo') await mundo();
