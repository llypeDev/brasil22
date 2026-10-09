// Coletor ao vivo do TSE: mantém dados/publicado/oficial atualizado durante uma divulgação.
//
// A cada ciclo (TSE_INTERVALO segundos, padrão 30):
//  1. baixa os agregados BR/UF de cada cargo e compara a geração (idg) com o último ciclo;
//  2. para as UFs que mudaram, baixa de novo os arquivos municipais (e zonas) daquele cargo;
//  3. arquiva o snapshot publicado atual em dados/arquivo-oficial/{t}/ (registro próprio);
//  4. roda o normalizador, que publica de forma atômica.
// Uma requisição por arquivo, concorrência limitada, recuo em 429/5xx (Retry-After).
//
// Uso: node scripts/tse/coletor-ao-vivo.mjs   (ou npm run coletor)

import { mkdir, readFile, writeFile, cp, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'https://resultados.tse.jus.br';
const PUBLICADO = join(RAIZ, 'dados', 'publicado', 'oficial');
const ARQUIVO = join(RAIZ, 'dados', 'arquivo-oficial');
const ESTADO = join(RAIZ, 'dados-brutos', 'tse', 'estado-coletor.json');
const INTERVALO = Number(process.env.TSE_INTERVALO ?? 30) * 1000;
const UFS = 'ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc se sp to'.split(' ');
const CARGOS = [[1, '6257'], [3, '6259'], [5, '6259'], [6, '6259'], [7, '6259'], [8, '6259']];
const pad = (n, w) => String(n).padStart(w, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lerJson(p, padrao) { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return padrao; } }

async function geracao(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (r.status === 404) return null;
  if (r.status === 429 || r.status >= 500) { const e = new Error(`TSE ${r.status}`); e.espera = Number(r.headers.get('retry-after') ?? 30) * 1000; throw e; }
  if (!r.ok) throw new Error(`TSE ${r.status} ${url}`);
  const j = await r.json();
  return { idg: String(j.idg ?? ''), and: j.and, corpo: j };
}

function rodar(script, args = []) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [join(RAIZ, script), ...args], { cwd: RAIZ, stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`${script} saiu com ${c}`))));
  });
}

async function arquivarAtual() {
  const agora = await lerJson(join(PUBLICADO, 'agora.json'), null);
  if (!agora) return;
  const destino = join(ARQUIVO, String(agora.t));
  if (existsSync(destino)) return;
  const tmp = `${destino}.tmp`;
  await mkdir(tmp, { recursive: true });
  for (const f of ['agora.json', 'municipios-presidente.json', 'exterior.json', 'catalogo.json']) if (existsSync(join(PUBLICADO, f))) await cp(join(PUBLICADO, f), join(tmp, f));
  if (existsSync(join(PUBLICADO, 'uf'))) await cp(join(PUBLICADO, 'uf'), join(tmp, 'uf'), { recursive: true });
  if (existsSync(join(PUBLICADO, 'deputados'))) await cp(join(PUBLICADO, 'deputados'), join(tmp, 'deputados'), { recursive: true });
  await rename(tmp, destino);
  console.log(`[coletor] snapshot ${agora.t} arquivado`);
}

async function ciclo(estado) {
  const mudancas = [];
  for (const [cargo, ele] of CARGOS) {
    const abrs = cargo === 1 ? ['br', ...UFS, 'zz'] : cargo === 7 ? UFS.filter((u) => u !== 'df') : cargo === 8 ? ['df'] : UFS;
    for (const uf of abrs) {
      const url = `${BASE}/oficial/ele2026/${ele}/dados/${uf}/${uf}-c${pad(cargo, 4)}-e${pad(ele, 6)}-u.json`;
      const g = await geracao(url);
      const chave = `${cargo}:${uf}`;
      if (g && g.idg !== estado[chave]) { mudancas.push({ cargo, uf, ele }); estado[chave] = g.idg; }
      await sleep(60);
    }
  }
  return mudancas;
}

async function principal() {
  const estado = await lerJson(ESTADO, {});
  console.log(`[coletor] ao vivo · intervalo ${INTERVALO / 1000}s`);
  let espera = INTERVALO;
  for (;;) {
    try {
      const m = await ciclo(estado);
      if (m.length) {
        console.log(`[coletor] ${m.length} abrangências mudaram: ${m.slice(0, 8).map((x) => `${x.cargo}/${x.uf}`).join(' ')}${m.length > 8 ? '…' : ''}`);
        const cargosMun = [...new Set(m.filter((x) => [1, 3, 5].includes(x.cargo)).map((x) => x.cargo))];
        // rebaixa municipais dos cargos alterados (o coletor usa cache em disco; --forcar renova)
        if (cargosMun.length) await rodar('scripts/tse/coletar.mjs', [`--cargos=${cargosMun.join(',')}`, '--forcar', '--zonas']);
        const outros = [...new Set(m.filter((x) => ![1, 3, 5].includes(x.cargo)).map((x) => x.cargo))];
        if (outros.length) await rodar('scripts/tse/coletar.mjs', [`--cargos=${outros.join(',')}`, '--forcar']);
        await arquivarAtual();
        await rodar('scripts/tse/normalizar.mjs');
        await mkdir(dirname(ESTADO), { recursive: true });
        await writeFile(ESTADO, JSON.stringify(estado));
      } else {
        console.log(`[coletor] sem mudanças (${new Date().toLocaleTimeString('pt-BR')})`);
      }
      espera = INTERVALO;
    } catch (e) {
      espera = Math.min(300_000, Math.max(espera * 2, e.espera ?? 0));
      console.error(`[coletor] falha: ${e.message} · nova tentativa em ${Math.round(espera / 1000)}s`);
    }
    await sleep(espera * (0.85 + Math.random() * 0.3));
  }
}

principal();
