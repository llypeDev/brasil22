// Campanha publicitária ativa em config/marca.json, como servida em /feed/anuncio.json pelo
// servidor e gravada como arquivo estático no build da Vercel.

export function anuncioAtivo(marca) {
  const c = (marca.campanhas ?? []).find((x) => x.ativa);
  return c ? { id: c.id, ativo: true } : { id: null, ativo: false };
}
