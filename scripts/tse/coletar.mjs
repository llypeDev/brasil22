// Coletor dos arquivos públicos de resultados do TSE (resultados.tse.jus.br).
//
// Baixa, com concorrência limitada e cache em disco, os arquivos "-u.json" de cada
// abrangência (Brasil, UF, município, exterior) para os cargos do 1º turno de 2026.
// Os arquivos brutos ficam em dados-brutos/tse/, espelhando o caminho oficial, e são
// a entrada de scripts/tse/normalizar.mjs. Nada aqui é publicado diretamente.
//
// Uso: node scripts/tse/coletar.mjs [--cargos=1,3,5,6,7,8] [--zonas] [--forcar] [--concorrencia=8]

import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESTINO = join(RAIZ, 'dados-brutos', 'tse');
const BASE = 'https://resultados.tse.jus.br';
const CONFIG = `${BASE}/oficial/comum/config/ele-c.json`;
const AGENTE = 'apuracao-2026/0.1 (coleta de dados abertos; uso local)';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const CARGOS = String(args.cargos ?? '1,3,5,6,7,8').split(',').map(Number);
const CONCORRENCIA = Number(args.concorrencia ?? 8);
const FORCAR = !!args.forcar;
const ZONAS = !!args.zonas;

const pad = (n, w) => String(n).padStart(w, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function existe(p) {
  try { return (await stat(p)).size > 0; } catch { return false; }
}

async function baixar(url, { obrigatorio = true } = {}) {
  const caminho = join(DESTINO, url.replace(`${BASE}/`, ''));
  if (!FORCAR && (await existe(caminho))) return { caminho, cache: true };
  let ultimoErro;
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': AGENTE, Accept: 'application/json,image/jpeg' }, signal: AbortSignal.timeout(20000) });
      if (r.status === 404) {
        if (obrigatorio) throw new Error(`404 ${url}`);
        return { caminho, ausente: true };
      }
      if (r.status === 429 || r.status >= 500) {
        const espera = Number(r.headers.get('retry-after') ?? 0) * 1000 || 1500 * tentativa;
        ultimoErro = new Error(`${r.status} ${url}`);
        await sleep(espera);
        continue;
      }
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      const corpo = Buffer.from(await r.arrayBuffer());
      if (url.endsWith('.json')) JSON.parse(corpo.toString('utf8')); // valida antes de gravar
      await mkdir(dirname(caminho), { recursive: true });
      const tmp = `${caminho}.tmp`;
      await writeFile(tmp, corpo);
      await rename(tmp, caminho); // gravação atômica
      return { caminho, cache: false, bytes: corpo.length };
    } catch (e) {
      ultimoErro = e;
      if (String(e.message).startsWith('404')) throw e;
      await sleep(800 * tentativa);
    }
  }
  throw ultimoErro;
}

async function emLote(itens, tarefa, rotulo) {
  let feitos = 0, falhas = 0, baixados = 0;
  const erros = [];
  const fila = [...itens];
  const inicio = Date.now();
  async function trabalhador() {
    while (fila.length) {
      const item = fila.shift();
      try {
        const r = await tarefa(item);
        if (r && !r.cache && !r.ausente) baixados++;
      } catch (e) {
        falhas++;
        erros.push(String(e.message ?? e));
      }
      feitos++;
      if (feitos % 250 === 0 || feitos === itens.length) {
        const s = ((Date.now() - inicio) / 1000).toFixed(0);
        console.log(`[${rotulo}] ${feitos}/${itens.length} · ${baixados} baixados · ${falhas} falhas · ${s}s`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, itens.length) }, trabalhador));
  return { feitos, falhas, erros };
}

function eleicaoDoCargo(config, cargo) {
  for (const p of config.pl ?? []) {
    if (p.c !== 'ele2026') continue;
    for (const e of p.e ?? []) {
      if (Number(e.t) !== 1) continue;
      if ((e.abr ?? []).some((a) => (a.cp ?? []).some((c) => Number(c.cd) === cargo))) return { cd: String(e.cd), pleito: String(p.cd) };
    }
  }
  return null;
}

async function main() {
  console.log(`Destino: ${DESTINO}`);
  await baixar(CONFIG);
  const config = JSON.parse(await readFile(join(DESTINO, 'oficial/comum/config/ele-c.json'), 'utf8'));
  if (config.f !== 'o') throw new Error('Configuração não está na fase oficial.');

  const relatorio = { iniciadoEm: new Date().toISOString(), cargos: {} };
  const catalogos = {};
  for (const cargo of CARGOS) {
    const e = eleicaoDoCargo(config, cargo);
    if (!e) { console.warn(`Cargo ${cargo} sem eleição no 1º turno de 2026.`); continue; }
    const ele = e.cd;
    const elePad = pad(ele, 6);
    if (!catalogos[ele]) {
      const url = `${BASE}/oficial/ele2026/${ele}/config/mun-e${elePad}-cm.json`;
      await baixar(url);
      catalogos[ele] = JSON.parse(await readFile(join(DESTINO, url.replace(`${BASE}/`, '')), 'utf8'));
    }
    const cat = catalogos[ele];
    const dir = (uf) => `${BASE}/oficial/ele2026/${ele}/dados/${uf}`;
    const nome = (uf, sufixo) => `${dir(uf)}/${uf}${sufixo}-c${pad(cargo, 4)}-e${elePad}-u.json`;

    const ufs = cat.abr.map((a) => a.cd.toLowerCase());
    const urls = [];
    if (cargo === 1) urls.push(nome('br', ''));
    for (const uf of ufs) {
      if (cargo === 7 && uf === 'df') continue; // DF elege deputados distritais (cargo 8)
      if (cargo === 8 && uf !== 'df') continue;
      if (uf === 'zz' && cargo !== 1) continue;
      urls.push(nome(uf, ''));
    }
    // Deputados: o painel usa os agregados por UF; a votação municipal não é necessária.
    if ([1, 3, 5].includes(cargo)) {
      for (const a of cat.abr) {
        const uf = a.cd.toLowerCase();
        if (uf === 'zz' && cargo !== 1) continue;
        for (const m of a.mu) urls.push(nome(uf, m.cd));
      }
    }
    if (ZONAS && cargo === 1) {
      for (const a of cat.abr) {
        const uf = a.cd.toLowerCase();
        if (uf === 'zz') continue;
        for (const m of a.mu) {
          if ((m.z ?? []).length < 2) continue; // município de zona única: o resultado municipal já é o da zona
          for (const z of m.z) urls.push(nome(uf, `${m.cd}-z${z}`));
        }
      }
    }
    console.log(`Cargo ${cargo} (eleição ${ele}): ${urls.length} arquivos`);
    const r = await emLote(urls, (u) => baixar(u, { obrigatorio: false }), `c${cargo}`);
    relatorio.cargos[cargo] = { eleicao: ele, arquivos: urls.length, falhas: r.falhas, erros: r.erros.slice(0, 20) };
  }
  relatorio.concluidoEm = new Date().toISOString();
  await mkdir(DESTINO, { recursive: true });
  await writeFile(join(DESTINO, 'relatorio-coleta.json'), JSON.stringify(relatorio, null, 2));
  console.log('Coleta concluída.', JSON.stringify(relatorio.cargos));
}

main().catch((e) => { console.error(e); process.exit(1); });
