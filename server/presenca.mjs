// Presença: quantas sessões estão com o painel aberto agora.
//
// Cada aba envia POST /api/vivo com um identificador efêmero (gerado no navegador, sem
// relação com a pessoa) a cada ~20 s enquanto visível. A sessão expira sem heartbeat.
// Nada é persistido; o contador é em memória do processo.

import { enviarJson, erro, lerCorpo, ipDoCliente, criarLimitador } from './lib/http.mjs';

const EXPIRA_MS = 50_000;
const ID_VALIDO = /^[a-z0-9]{12,40}$/;

export function criarPresenca() {
  const sessoes = new Map(); // id → último sinal
  const limite = criarLimitador({ janelaMs: 60_000, maximo: 12 });
  const contar = () => {
    const agora = Date.now();
    for (const [id, t] of sessoes) if (agora - t > EXPIRA_MS) sessoes.delete(id);
    return sessoes.size;
  };
  return {
    contar,
    async tratar(req, res) {
      if (req.method !== 'POST') return erro(req, res, 405, 'Use POST.');
      if (!limite.permitir(ipDoCliente(req)).ok) return erro(req, res, 429, 'Sinais em excesso.');
      let corpo;
      try { corpo = await lerCorpo(req, 512); } catch (e) { return erro(req, res, e.status ?? 400, e.message); }
      const id = String(corpo.id ?? '');
      if (!ID_VALIDO.test(id)) return erro(req, res, 400, 'Identificador inválido.');
      if (corpo.saindo === true) sessoes.delete(id);
      else sessoes.set(id, Date.now());
      if (sessoes.size > 200_000) contar();
      enviarJson(req, res, { pessoas: contar(), intervaloSegundos: 20 }, { etag: false, cache: 'no-store' });
    },
  };
}
