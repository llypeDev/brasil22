// Cadeiras do Senado que NÃO estão em disputa em 2026 (mandatos eleitos em 2022, até 31/01/2031).
//
// Fonte: Senado Federal — Dados Abertos, lista de parlamentares em exercício:
// https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json
// Somente nome parlamentar, partido, UF e fim do mandato são gravados. Telefones, e-mails e
// demais dados de contato da resposta são descartados e nunca persistidos.
//
// Saída: dados/senado/cadeiras-mantidas.json

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const URL_API = 'https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json';
const SAIDA = join(RAIZ, 'dados', 'senado', 'cadeiras-mantidas.json');

const r = await fetch(URL_API, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
if (!r.ok) throw new Error(`Senado respondeu ${r.status}`);
const j = await r.json();
const lista = j?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar ?? [];
const fimDoMandato = (p) => p.Mandato?.SegundaLegislaturaDoMandato?.DataFim ?? p.Mandato?.PrimeiraLegislaturaDoMandato?.DataFim ?? '';
const mantidas = lista
  .filter((p) => fimDoMandato(p).startsWith('2031'))
  .map((p) => ({
    uf: p.Mandato?.UfParlamentar ?? p.IdentificacaoParlamentar?.UfParlamentar,
    nome: p.IdentificacaoParlamentar?.NomeParlamentar,
    partido: p.IdentificacaoParlamentar?.SiglaPartidoParlamentar,
    mandatoAte: fimDoMandato(p),
  }))
  .sort((a, b) => a.uf.localeCompare(b.uf));
const porUf = {};
for (const c of mantidas) porUf[c.uf] = (porUf[c.uf] ?? 0) + 1;
const ufsIrregulares = Object.entries(porUf).filter(([, n]) => n !== 1);
await mkdir(dirname(SAIDA), { recursive: true });
await writeFile(SAIDA, JSON.stringify({
  versao: 1,
  fonte: 'Senado Federal — Dados Abertos (senador/lista/atual)',
  url: URL_API,
  consultadoEm: new Date().toISOString(),
  observacao: 'Partido atual do parlamentar em exercício na data da consulta (titular ou suplente em exercício).',
  emExercicio: lista.length,
  cadeiras: mantidas,
}, null, 1));
console.log(`${lista.length} em exercício · ${mantidas.length} cadeiras mantidas até 2031${ufsIrregulares.length ? ` · UFs fora do padrão: ${JSON.stringify(ufsIrregulares)}` : ''}`);
