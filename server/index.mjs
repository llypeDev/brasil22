// Servidor de produção: arquivos estáticos do build (dist/), geografia, feeds e APIs próprias.
// Uso: npm run build && npm start   (PORT, HOST e demais variáveis em .env.example)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync, constants as zc } from 'node:zlib';
import { criarApp } from './app.mjs';
import { etagDe } from './lib/http.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'dist');
const PORTA = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '127.0.0.1';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.map': 'application/json',
};
const COMPRIMIVEIS = new Set(['.html', '.js', '.css', '.json', '.svg', '.map']);

const SEGURANCA = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), screen-wake-lock=(self), fullscreen=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

const cache = new Map();
async function arquivoEstatico(caminho) {
  const st = await stat(caminho);
  const chave = `${caminho}:${st.mtimeMs}`;
  if (cache.has(chave)) return cache.get(chave);
  const corpo = await readFile(caminho);
  const ext = extname(caminho);
  const item = { corpo, ext, etag: etagDe(corpo), br: null, gz: null };
  if (COMPRIMIVEIS.has(ext) && corpo.length > 1024) {
    item.br = brotliCompressSync(corpo, { params: { [zc.BROTLI_PARAM_QUALITY]: 9 } });
    item.gz = gzipSync(corpo, { level: 8 });
  }
  cache.set(chave, item);
  return item;
}

function enviarEstatico(req, res, item, cacheControl) {
  const headers = { 'Content-Type': TIPOS[item.ext] ?? 'application/octet-stream', 'Cache-Control': cacheControl, ETag: item.etag, Vary: 'Accept-Encoding', ...SEGURANCA };
  if (req.headers['if-none-match'] === item.etag) { res.writeHead(304, headers); res.end(); return; }
  const ae = String(req.headers['accept-encoding'] ?? '');
  let corpo = item.corpo;
  if (item.br && /\bbr\b/.test(ae)) { corpo = item.br; headers['Content-Encoding'] = 'br'; }
  else if (item.gz && /\bgzip\b/.test(ae)) { corpo = item.gz; headers['Content-Encoding'] = 'gzip'; }
  headers['Content-Length'] = corpo.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : corpo);
}

const tratarApi = await criarApp({ raiz: RAIZ, producao: true });

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://local');
  if (url.pathname.startsWith('/feed/') || url.pathname.startsWith('/api/')) {
    for (const [k, v] of Object.entries(SEGURANCA)) res.setHeader(k, v);
    return tratarApi(req, res);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, SEGURANCA); res.end(); return; }
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (rel.includes('..')) { res.writeHead(400, SEGURANCA); res.end(); return; }
  const alvo = join(DIST, rel || 'index.html');
  try {
    const item = await arquivoEstatico(alvo);
    // nomes com hash são imutáveis; geografia versionada no nome; HTML sempre revalidado
    const cc = rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : rel.startsWith('geo/') ? 'public, max-age=86400, stale-while-revalidate=604800' : 'no-cache';
    enviarEstatico(req, res, item, cc);
  } catch {
    // SPA: qualquer rota sem extensão devolve a página
    if (!extname(rel)) {
      try { return enviarEstatico(req, res, await arquivoEstatico(join(DIST, 'index.html')), 'no-cache'); } catch { /* sem build */ }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SEGURANCA });
    res.end('Não encontrado. Rode npm run build antes de npm start.');
  }
});

servidor.listen(PORTA, HOST, () => console.log(`Apuração 2026 em http://${HOST}:${PORTA}`));
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => servidor.close(() => process.exit(0)));
