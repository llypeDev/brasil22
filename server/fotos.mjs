// Proxy das fotos oficiais das candidaturas (TSE), com cache em disco.
// GET /feed/fotos/{eleicao}/{uf}/{sq}.jpeg  →  resultados.tse.jus.br/oficial/ele2026/{eleicao}/fotos/{uf}/{sq}.jpeg
// Parâmetros validados estritamente; nenhuma outra URL pode ser alcançada por aqui.

import { mkdir, readFile, rename, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { erro } from './lib/http.mjs';

const UFS = new Set('br ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc se sp to'.split(' '));
const ELEICOES = new Set(['6257', '6259']);

export function criarFotos({ diretorio, offline = process.env.FOTOS_OFFLINE === '1' }) {
  const emVoo = new Map();
  const ausentes = new Set();
  async function obter(ele, uf, sq) {
    const caminho = join(diretorio, ele, uf, `${sq}.jpeg`);
    try { if ((await stat(caminho)).size > 0) return readFile(caminho); } catch { /* sem cache */ }
    if (offline) return null;
    const chave = `${ele}/${uf}/${sq}`;
    if (ausentes.has(chave)) return null;
    if (emVoo.has(chave)) return emVoo.get(chave);
    const p = (async () => {
      const r = await fetch(`https://resultados.tse.jus.br/oficial/ele2026/${ele}/fotos/${uf}/${sq}.jpeg`, { signal: AbortSignal.timeout(10_000) });
      if (r.status === 404) { ausentes.add(chave); return null; }
      if (!r.ok || !String(r.headers.get('content-type')).startsWith('image/')) throw new Error(`TSE ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 600_000) throw new Error('Imagem grande demais.');
      await mkdir(dirname(caminho), { recursive: true });
      await writeFile(`${caminho}.tmp`, buf);
      await rename(`${caminho}.tmp`, caminho);
      return buf;
    })().finally(() => emVoo.delete(chave));
    emVoo.set(chave, p);
    return p;
  }
  return {
    async tratar(req, res, ele, uf, sq) {
      if (!ELEICOES.has(ele) || !UFS.has(uf) || !/^\d{8,14}$/.test(sq)) return erro(req, res, 400, 'Foto inválida.');
      try {
        const buf = await obter(ele, uf, sq);
        if (!buf) return erro(req, res, 404, 'Foto indisponível.');
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=604800, immutable', 'X-Content-Type-Options': 'nosniff' });
        res.end(buf);
      } catch (e) {
        erro(req, res, 502, 'Fonte das fotos indisponível.');
      }
    },
  };
}
