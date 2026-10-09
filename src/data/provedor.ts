// Acesso ao feed do servidor próprio. Uma requisição em voo por URL, cache LRU de respostas
// já validadas e tempo-limite. A revalidação HTTP (ETag) fica com o navegador.

import type { Modo } from './contratos';

export class ErroFeed extends Error {
  constructor(message: string, public status = 0, public semRegistro = false, public esperarSegundos: number | null = null) {
    super(message);
  }
}

export function baseDoModo(modo: Modo) {
  if (modo === 'oficial' || modo === 'simulacao') return `/feed/${modo}/`;
  return `/feed/cenario/${modo.replace('cenario-', '')}/`;
}

export function urlDe(modo: Modo, rel: string, t: number | null) {
  return t == null ? `${baseDoModo(modo)}${rel}` : `${baseDoModo(modo)}arquivo/${Math.round(t)}/${rel}`;
}

const LIMITE = 80;
const cache = new Map<string, unknown>();
const emVoo = new Map<string, Promise<unknown>>();

function guardar(chave: string, v: unknown) {
  cache.delete(chave);
  cache.set(chave, v);
  while (cache.size > LIMITE) cache.delete(cache.keys().next().value!);
}

export function emCache<T>(chave: string): T | undefined {
  if (!cache.has(chave)) return undefined;
  const v = cache.get(chave);
  guardar(chave, v);
  return v as T;
}

// AbortSignal.timeout/any só existem em navegadores recentes (Safari 17.4, Chrome 116)
function tempoEsgotado(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(new DOMException('Tempo esgotado.', 'TimeoutError')), ms);
  return c.signal;
}
function qualquer(sinais: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(sinais);
  const c = new AbortController();
  for (const s of sinais) {
    if (s.aborted) { c.abort(s.reason); break; }
    s.addEventListener('abort', () => c.abort(s.reason), { once: true });
  }
  return c.signal;
}

export async function obterJson<T>(url: string, { signal, tempoLimite = 15000 }: { signal?: AbortSignal; tempoLimite?: number } = {}): Promise<T> {
  const limite = tempoEsgotado(tempoLimite);
  const sinal = signal ? qualquer([signal, limite]) : limite;
  let r: Response;
  try {
    r = await fetch(url, { signal: sinal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if ((e as Error).name === 'AbortError' && signal?.aborted) throw e;
    throw new ErroFeed(navigator.onLine === false ? 'Sem conexão com a internet.' : 'Não foi possível falar com o servidor.', 0);
  }
  if (!r.ok) {
    let corpo: { erro?: string; semRegistro?: boolean; esperarSegundos?: number } = {};
    try { corpo = await r.json(); } catch { /* corpo não-JSON */ }
    const ra = Number(r.headers.get('retry-after'));
    throw new ErroFeed(corpo.erro ?? `Erro ${r.status}`, r.status, !!corpo.semRegistro, Number.isFinite(ra) && ra > 0 ? ra : corpo.esperarSegundos ?? null);
  }
  try {
    return (await r.json()) as T;
  } catch {
    throw new ErroFeed('Resposta inválida do servidor.', r.status);
  }
}

/**
 * Busca um arquivo do feed para (modo, instante, sequência). A chave inclui a sequência ao
 * vivo: quando o feed avança, a mesma URL é revalidada; consultas históricas são imutáveis.
 */
export function buscarFeed<T>(modo: Modo, rel: string, t: number | null, seq: number | null, validar?: (x: unknown) => T): Promise<T> {
  const url = urlDe(modo, rel, t);
  const chave = `${url}#${t == null ? seq ?? 0 : 'h'}`;
  const c = emCache<T>(chave);
  if (c !== undefined) return Promise.resolve(c);
  if (emVoo.has(chave)) return emVoo.get(chave) as Promise<T>;
  const p = obterJson<unknown>(url)
    .then((bruto) => {
      const v = validar ? validar(bruto) : (bruto as T);
      guardar(chave, v);
      return v;
    })
    .finally(() => emVoo.delete(chave));
  emVoo.set(chave, p);
  return p as Promise<T>;
}

export const chaveFeed = (modo: Modo, rel: string, t: number | null, seq: number | null) => `${urlDe(modo, rel, t)}#${t == null ? seq ?? 0 : 'h'}`;
