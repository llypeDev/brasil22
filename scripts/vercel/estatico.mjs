// Saída estática para a Vercel (npm run build:vercel, depois de vite build).
//
// Na Vercel não há o servidor Node de server/index.mjs: o feed oficial e a campanha ativa viram
// arquivos em dist/feed/, servidos direto pela CDN, nos mesmos caminhos que o servidor usa.
// O que continua dinâmico (simulação, cenários) fica com api/servidor.mjs, e as fotos vão ao
// TSE por reescrita — as duas coisas estão em vercel.json.

import { cp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anuncioAtivo } from '../../server/lib/anuncio.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(RAIZ, 'dist');
const ORIGEM = join(RAIZ, 'dados', 'publicado', 'oficial');
const DESTINO = join(DIST, 'feed', 'oficial');

if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ sem build: rode npm run build antes.');
if (!existsSync(join(ORIGEM, 'manifesto.json'))) throw new Error('Dados oficiais ausentes em dados/publicado/oficial.');

await rm(join(DIST, 'feed'), { recursive: true, force: true });
await cp(ORIGEM, DESTINO, { recursive: true });

const marca = JSON.parse(await readFile(join(RAIZ, 'config', 'marca.json'), 'utf8'));
await writeFile(join(DIST, 'feed', 'anuncio.json'), JSON.stringify(anuncioAtivo(marca)));

async function contar(dir) {
  let arquivos = 0, bytes = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) { const c = await contar(caminho); arquivos += c.arquivos; bytes += c.bytes; }
    else { arquivos++; bytes += (await stat(caminho)).size; }
  }
  return { arquivos, bytes };
}
const { arquivos, bytes } = await contar(DESTINO);
console.log(`feed oficial estático: ${arquivos} arquivos, ${(bytes / 1e6).toFixed(1)} MB em dist/feed/oficial`);
