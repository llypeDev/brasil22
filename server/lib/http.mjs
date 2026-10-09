// Utilitários HTTP mínimos (sem dependências), compartilhados pelo servidor de produção e
// pelo middleware de desenvolvimento do Vite.

import { createHash } from 'node:crypto';
import { brotliCompressSync, gzipSync, constants as zc } from 'node:zlib';

export function etagDe(corpo) {
  return `"${createHash('sha1').update(corpo).digest('base64url').slice(0, 27)}"`;
}

// Respostas comprimidas recentes, por ETag (o feed oficial repete os mesmos corpos).
const comprimidos = new Map();
function comprimir(tag, corpo, tipo) {
  const chave = `${tag}:${tipo}`;
  if (comprimidos.has(chave)) return comprimidos.get(chave);
  const saida = tipo === 'br' ? brotliCompressSync(corpo, { params: { [zc.BROTLI_PARAM_QUALITY]: 5 } }) : gzipSync(corpo, { level: 6 });
  comprimidos.set(chave, saida);
  if (comprimidos.size > 300) comprimidos.delete(comprimidos.keys().next().value);
  return saida;
}

/** Envia JSON com ETag e compressão; responde 304 quando o cliente já tem a versão. */
export function enviarJson(req, res, obj, { status = 200, cache = 'no-cache', etag = true } = {}) {
  // resposta antes de ler o corpo (405, 415, 429…): descarta o resto para a conexão
  // persistente continuar utilizável; corpos grandes fecham a conexão em vez de serem lidos
  if (!req.readableEnded) {
    if (Number(req.headers['content-length'] ?? 0) > 65536) res.setHeader('Connection', 'close');
    else req.resume();
  }
  let corpo = typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj);
  if (typeof corpo === 'string') corpo = Buffer.from(corpo);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Accept-Encoding',
  };
  const tag = etagDe(corpo);
  if (etag && status === 200) {
    headers.ETag = tag;
    if (req.headers['if-none-match'] === tag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
  }
  const ae = String(req.headers['accept-encoding'] ?? '');
  if (corpo.length > 1024 && req.method !== 'HEAD') {
    if (/\bbr\b/.test(ae)) { corpo = comprimir(tag, corpo, 'br'); headers['Content-Encoding'] = 'br'; }
    else if (/\bgzip\b/.test(ae)) { corpo = comprimir(tag, corpo, 'gz'); headers['Content-Encoding'] = 'gzip'; }
  }
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : corpo);
}

export function erro(req, res, status, mensagem, extra = {}) {
  enviarJson(req, res, { erro: mensagem, ...extra }, { status, etag: false, cache: 'no-store' });
}

/** Lê o corpo JSON com limite de tamanho. */
export function lerCorpo(req, limite = 4096) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const partes = [];
    req.on('data', (c) => {
      total += c.length;
      if (total > limite) {
        reject(Object.assign(new Error('Corpo excede o limite.'), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(c);
    });
    req.on('end', () => {
      if (!partes.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('JSON inválido.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

export function ipDoCliente(req) {
  // Atrás de proxy reverso configurado, X-Forwarded-For traz o cliente; localmente, o socket.
  const xff = process.env.CONFIAR_PROXY === '1' ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
  return xff || req.socket?.remoteAddress || 'desconhecido';
}

/** Limitador de frequência por chave (janela deslizante simples, em memória). */
export function criarLimitador({ janelaMs, maximo }) {
  const registros = new Map();
  return {
    permitir(chave) {
      const agora = Date.now();
      const lista = (registros.get(chave) ?? []).filter((t) => agora - t < janelaMs);
      if (lista.length >= maximo) {
        registros.set(chave, lista);
        return { ok: false, esperarSegundos: Math.ceil((janelaMs - (agora - lista[0])) / 1000) };
      }
      lista.push(agora);
      registros.set(chave, lista);
      if (registros.size > 5000) for (const [k, v] of registros) if (!v.some((t) => agora - t < janelaMs)) registros.delete(k);
      return { ok: true };
    },
  };
}
