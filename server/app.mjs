// Roteador do servidor próprio. Usado pelo middleware do Vite (desenvolvimento) e por
// server/index.mjs (produção). Rotas:
//
//   GET  /feed/oficial/{arquivo}                 feed normalizado do TSE (ETag, no-cache)
//   GET  /feed/oficial/arquivo/{t}/{arquivo}     snapshot arquivado (só o final existe no oficial)
//   GET  /feed/simulacao/{arquivo}               simulação no instante do relógio simulado
//   GET  /feed/simulacao/arquivo/{t}/{arquivo}   simulação num instante passado
//   GET  /feed/cenario/{nome}/{arquivo}          cenários de teste: aguardando, vazio, falha, instavel
//   GET  /feed/fotos/{eleicao}/{uf}/{sq}.jpeg    fotos oficiais (proxy com cache)
//   GET  /feed/anuncio.json                      campanha ativa (config/marca.json)
//   POST /api/vivo                               presença
//   POST /api/acesso                             pedidos de acesso/anúncio
//   GET  /api/saude                              estado do serviço
//   POST /api/simulacao/relogio                  controle do relógio simulado (fora de produção)

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { enviarJson, erro, lerCorpo } from './lib/http.mjs';
import { criarPresenca } from './presenca.mjs';
import { criarPedidos } from './pedidos.mjs';
import { criarFotos } from './fotos.mjs';
import { criarSimulacao } from './simulacao.mjs';

export async function criarApp({ raiz, producao = process.env.NODE_ENV === 'production' }) {
  const dirOficial = join(raiz, 'dados', 'publicado', 'oficial');
  const dirArquivoOficial = join(raiz, 'dados', 'arquivo-oficial');
  const presenca = criarPresenca();
  const pedidos = criarPedidos({ arquivo: process.env.PEDIDOS_ARQUIVO || join(raiz, 'dados', 'privado', 'pedidos.sqlite') });
  const fotos = criarFotos({ diretorio: join(raiz, 'dados-brutos', 'fotos') });
  const marca = JSON.parse(await readFile(join(raiz, 'config', 'marca.json'), 'utf8'));
  const geoMundo = existsSync(join(raiz, 'public', 'geo', 'mundo-v1.json')) ? JSON.parse(await readFile(join(raiz, 'public', 'geo', 'mundo-v1.json'), 'utf8')) : null;

  let simulacao = null;
  let erroSimulacao = null;
  const simPronta = criarSimulacao({ diretorio: dirOficial, geoMundo })
    .then((s) => { simulacao = s; console.log(`[simulacao] pronta · calibração ${JSON.stringify(s.calibracao.vies)}`); })
    .catch((e) => { erroSimulacao = e; console.error('[simulacao]', e.message); });

  // Cache do feed oficial em memória, invalidado pelo mtime do manifesto (republicação atômica).
  let versaoOficial = 0;
  const cacheOficial = new Map();
  async function lerOficial(rel) {
    const seguro = normalize(rel).replace(/^([/\\])+/, '');
    if (seguro.includes('..') || !/^[a-z0-9/_-]+\.json$/i.test(seguro.split(sep).join('/'))) return null;
    try {
      const m = (await stat(join(dirOficial, 'manifesto.json'))).mtimeMs;
      if (m !== versaoOficial) { cacheOficial.clear(); versaoOficial = m; }
    } catch { return null; }
    if (cacheOficial.has(seguro)) return cacheOficial.get(seguro);
    try {
      const corpo = await readFile(join(dirOficial, seguro));
      cacheOficial.set(seguro, corpo);
      if (cacheOficial.size > 400) cacheOficial.delete(cacheOficial.keys().next().value);
      return corpo;
    } catch { return null; }
  }
  async function tFinalOficial() {
    const m = await lerOficial('manifesto.json');
    return m ? JSON.parse(m.toString('utf8')).t : null;
  }

  const ARQUIVO = /^([a-z0-9][a-z0-9/_-]*\.json)$/i;

  async function servirSimulacao(req, res, rel, t) {
    await simPronta;
    if (!simulacao) return erro(req, res, 503, 'Simulação indisponível.', { detalhe: erroSimulacao?.message });
    if (rel === 'deputados/busca.json') {
      const corpo = await lerOficial(rel);
      return corpo ? enviarJson(req, res, corpo, { cache: 'public, max-age=300' }) : erro(req, res, 404, 'Inexistente.');
    }
    const agora = simulacao.relogio();
    if (t != null && t > agora) return erro(req, res, 404, 'Instante ainda não ocorreu na simulação.');
    const obj = simulacao.arquivo(rel, t ?? agora);
    if (!obj) return erro(req, res, 404, 'Inexistente.');
    enviarJson(req, res, obj);
  }

  const instavel = () => Math.floor(Date.now() / 20000) % 3 === 2; // 1/3 do tempo fora do ar, em janelas de 20 s

  return async function tratar(req, res, proximo) {
    const url = new URL(req.url ?? '/', 'http://local');
    const p = decodeURIComponent(url.pathname);
    try {
      if (p === '/api/vivo') return await presenca.tratar(req, res);
      if (p === '/api/acesso') return await pedidos.tratar(req, res);
      if (p === '/api/saude') {
        return enviarJson(req, res, { ok: true, oficial: !!(await lerOficial('manifesto.json')), simulacao: !!simulacao, pessoas: presenca.contar() }, { etag: false, cache: 'no-store' });
      }
      if (p === '/api/simulacao/relogio') {
        if (producao) return erro(req, res, 403, 'Indisponível em produção.');
        await simPronta;
        if (!simulacao) return erro(req, res, 503, 'Simulação indisponível.');
        if (req.method === 'POST') return enviarJson(req, res, simulacao.controlar(await lerCorpo(req, 512)), { etag: false, cache: 'no-store' });
        return enviarJson(req, res, { agora: simulacao.relogio(), limites: simulacao.limites }, { etag: false, cache: 'no-store' });
      }
      if (p === '/feed/anuncio.json') {
        const c = (marca.campanhas ?? []).find((x) => x.ativa);
        return enviarJson(req, res, c ? { id: c.id, ativo: true } : { id: null, ativo: false }, { cache: 'public, max-age=60' });
      }
      let m = /^\/feed\/fotos\/(\d{4})\/([a-z]{2})\/(\d+)\.jpe?g$/.exec(p);
      if (m) return await fotos.tratar(req, res, m[1], m[2], m[3]);

      if (req.method !== 'GET' && req.method !== 'HEAD' && p.startsWith('/feed/')) return erro(req, res, 405, 'Somente leitura.');

      m = /^\/feed\/oficial\/arquivo\/(\d{1,4})\/(.+)$/.exec(p);
      if (m) {
        const t = Number(m[1]);
        if (!ARQUIVO.test(m[2])) return erro(req, res, 404, 'Inexistente.');
        if (t === (await tFinalOficial())) {
          const corpo = await lerOficial(m[2]);
          return corpo ? enviarJson(req, res, corpo) : erro(req, res, 404, 'Inexistente.');
        }
        // snapshots próprios, arquivados pelo coletor ao vivo (dados/arquivo-oficial/{t}/)
        const rel = normalize(m[2]).replace(/^([/\\])+/, '');
        const arq = join(dirArquivoOficial, String(t), rel);
        if (!rel.includes('..') && existsSync(arq)) return enviarJson(req, res, await readFile(arq));
        return erro(req, res, 404, 'Sem registro do TSE neste instante.', { semRegistro: true });
      }
      if (p === '/feed/oficial/arquivo-indice.json') {
        const corpo = await lerOficial('arquivo-indice.json');
        if (!corpo) return erro(req, res, 404, 'Inexistente.');
        const indice = JSON.parse(corpo.toString('utf8'));
        let proprios = [];
        try { proprios = (await readdir(dirArquivoOficial)).filter((d) => /^\d+$/.test(d)).map(Number); } catch { /* sem arquivo próprio */ }
        indice.snapshots = [...new Set([...proprios, ...indice.snapshots])].sort((a, b) => a - b);
        return enviarJson(req, res, indice);
      }
      m = /^\/feed\/oficial\/(.+)$/.exec(p);
      if (m) {
        const corpo = ARQUIVO.test(m[1]) ? await lerOficial(m[1]) : null;
        if (!corpo) return erro(req, res, 404, 'Inexistente.');
        return enviarJson(req, res, corpo);
      }
      m = /^\/feed\/simulacao\/arquivo\/(\d{1,4})\/(.+)$/.exec(p);
      if (m) return ARQUIVO.test(m[2]) ? await servirSimulacao(req, res, m[2], Number(m[1])) : erro(req, res, 404, 'Inexistente.');
      m = /^\/feed\/simulacao\/(.+)$/.exec(p);
      if (m) return ARQUIVO.test(m[1]) ? await servirSimulacao(req, res, m[1], url.searchParams.has('t') ? Number(url.searchParams.get('t')) : null) : erro(req, res, 404, 'Inexistente.');

      m = /^\/feed\/cenario\/(aguardando|vazio|falha|instavel|lento)\/(?:arquivo\/(\d{1,4})\/)?(.+)$/.exec(p);
      if (m) {
        const [, nome, tArq, rel] = m;
        if (!ARQUIVO.test(rel)) return erro(req, res, 404, 'Inexistente.');
        if (nome === 'falha') return erro(req, res, 503, 'Fonte temporariamente indisponível (cenário de teste).');
        if (nome === 'instavel' && instavel() && rel === 'agora.json') return erro(req, res, 503, 'Fonte instável (cenário de teste).');
        if (nome === 'vazio' && ['agora.json', 'municipios-presidente.json', 'historico.json', 'eventos.json'].includes(rel)) return erro(req, res, 404, 'Ainda não há dados publicados.');
        if (nome === 'lento') await new Promise((r) => setTimeout(r, 4000));
        if (nome === 'aguardando') { await simPronta; const o = simulacao?.arquivo(rel, simulacao.limites.inicio); return o ? enviarJson(req, res, { ...o, cenario: nome }) : erro(req, res, 404, 'Inexistente.'); }
        const corpo = await lerOficial(rel);
        if (tArq && Number(tArq) !== (await tFinalOficial())) return erro(req, res, 404, 'Sem registro neste instante.', { semRegistro: true });
        return corpo ? enviarJson(req, res, corpo) : erro(req, res, 404, 'Inexistente.');
      }
      if (p.startsWith('/feed/') || p.startsWith('/api/')) return erro(req, res, 404, 'Rota inexistente.');
    } catch (e) {
      console.error('[app]', e);
      return erro(req, res, 500, 'Erro interno.');
    }
    return proximo ? proximo() : erro(req, res, 404, 'Não encontrado.');
  };
}
