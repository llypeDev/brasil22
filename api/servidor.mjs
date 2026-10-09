// Função da Vercel com o servidor próprio (server/app.mjs), para as rotas que não cabem em
// arquivos estáticos: simulação (/feed/simulacao/*), cenários de teste (/feed/cenario/*) e
// /api/saude. vercel.json reescreve essas rotas para cá; a URL original chega em req.url.
//
// O feed oficial não passa por aqui (é estático, scripts/vercel/estatico.mjs). Presença e
// pedidos também não: dependem de memória e de banco persistentes, que a função não tem.

import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarApp } from '../server/app.mjs';

// o disco da função é somente leitura fora de /tmp
process.env.PEDIDOS_ARQUIVO ||= join(tmpdir(), 'pedidos.sqlite');
// relógio da simulação igual em todas as instâncias (ver server/simulacao.mjs)
process.env.SIM_ANCORA ||= '0';

const pronto = criarApp({ raiz: join(dirname(fileURLToPath(import.meta.url)), '..'), producao: true });
// sem isto, uma falha na carga derrubaria o processo antes da primeira requisição, sem log
pronto.catch((e) => console.error('[servidor] falha ao iniciar:', e));

export default async function servidor(req, res) {
  await (await pronto)(req, res);
}
