// Contratos do servidor próprio vistos de fora: pedidos (validação, antispam, limite) e feeds.

import { test, expect } from '@playwright/test';

test('pedidos: 415, 400 por campo, honeypot neutro, 201 e 429 com Retry-After', async ({ request }) => {
  const email = `api-${Date.now()}@exemplo.test`;
  const post = (data: unknown) => request.post('/api/acesso', { data });

  let r = await request.post('/api/acesso', { data: 'texto', headers: { 'Content-Type': 'text/plain' } });
  expect(r.status()).toBe(415);

  r = await post({ tipo: 'acesso', email: 'invalido', org: '' });
  expect(r.status()).toBe(400);
  expect((await r.json()).campos).toMatchObject({ email: expect.any(String), org: expect.any(String) });

  // campo invisível preenchido: resposta igual à de sucesso, mas nada é gravado nem contado
  r = await post({ tipo: 'acesso', email, org: 'Teste', site: 'http://exemplo.test' });
  expect(r.status()).toBe(201);

  for (let i = 0; i < 3; i++) {
    r = await post({ tipo: 'anuncio', email, org: 'Teste' });
    expect(r.status()).toBe(201);
    expect((await r.json()).id).toMatch(/^[0-9a-f-]{36}$/);
  }
  r = await post({ tipo: 'anuncio', email, org: 'Teste' });
  expect(r.status()).toBe(429);
  expect(Number(r.headers()['retry-after'])).toBeGreaterThan(0);

  expect((await request.get('/api/acesso')).status()).toBe(405);
});

test('feeds: leitura com ETag, escrita recusada e caminhos fora do feed negados', async ({ request }) => {
  const r = await request.get('/feed/oficial/manifesto.json');
  expect(r.ok()).toBe(true);
  const etag = r.headers()['etag'];
  expect(etag).toBeTruthy();
  expect((await request.get('/feed/oficial/manifesto.json', { headers: { 'If-None-Match': etag } })).status()).toBe(304);

  expect((await request.post('/feed/oficial/manifesto.json', { data: {} })).status()).toBe(405);
  expect([400, 403, 404]).toContain((await request.get('/feed/oficial/..%2F..%2Fpackage.json')).status());
  // instante sem snapshot arquivado: o oficial não inventa resultado
  const semRegistro = await request.get('/feed/oficial/arquivo/1080/agora.json');
  expect(semRegistro.status()).toBe(404);
  expect((await semRegistro.json()).semRegistro).toBe(true);
});
