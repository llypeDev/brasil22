// Pedidos de acesso (convite) e de anúncio — POST /api/acesso
//
// Validação no servidor, campo antispam (honeypot "site"), limite por IP e por e-mail e
// persistência em SQLite (node:sqlite). A resposta de sucesso só é enviada depois que o
// INSERT foi confirmado. Os contatos ficam somente neste banco local; retenção configurável
// (PEDIDOS_RETENCAO_DIAS, padrão 180) aplicada na inicialização e a cada hora.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { enviarJson, erro, lerCorpo, ipDoCliente, criarLimitador } from './lib/http.mjs';

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const TIPOS = new Set(['acesso', 'anuncio']);

export function validarPedido(corpo) {
  const campos = {};
  const tipo = String(corpo?.tipo ?? '');
  const email = String(corpo?.email ?? '').trim().toLowerCase();
  const org = String(corpo?.org ?? '').trim().replace(/\s+/g, ' ');
  if (!TIPOS.has(tipo)) campos.tipo = 'Tipo de pedido inválido.';
  if (!email) campos.email = 'Informe um e-mail.';
  else if (email.length > 254 || !EMAIL.test(email)) campos.email = 'Confira o e-mail.';
  if (!org) campos.org = tipo === 'anuncio' ? 'Informe a empresa.' : 'Informe onde você trabalha.';
  else if (org.length < 2 || org.length > 120) campos.org = 'Use entre 2 e 120 caracteres.';
  // honeypot: campo invisível que pessoas não preenchem
  const robo = String(corpo?.site ?? '').length > 0;
  return { ok: Object.keys(campos).length === 0, campos, robo, valores: { tipo, email, org } };
}

export function criarPedidos({ arquivo, retencaoDias = Number(process.env.PEDIDOS_RETENCAO_DIAS ?? 180) }) {
  mkdirSync(dirname(arquivo), { recursive: true });
  const db = new DatabaseSync(arquivo);
  db.exec(`CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('acesso','anuncio')),
    email TEXT NOT NULL,
    org TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    origem_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'recebido'
  )`);
  const inserir = db.prepare('INSERT INTO pedidos (id, tipo, email, org, criado_em, origem_hash) VALUES (?, ?, ?, ?, ?, ?)');
  const conferir = db.prepare('SELECT id FROM pedidos WHERE id = ?');
  const limpar = db.prepare("DELETE FROM pedidos WHERE criado_em < ?");
  const expurgar = () => limpar.run(new Date(Date.now() - retencaoDias * 86400_000).toISOString());
  expurgar();
  const timer = setInterval(expurgar, 3600_000);
  timer.unref?.();

  const porIp = criarLimitador({ janelaMs: 10 * 60_000, maximo: Number(process.env.PEDIDOS_LIMITE_IP ?? 5) });
  const porEmail = criarLimitador({ janelaMs: 60 * 60_000, maximo: 3 });
  const sal = process.env.PEDIDOS_SAL ?? randomUUID();

  return {
    async tratar(req, res) {
      if (req.method !== 'POST') return erro(req, res, 405, 'Use POST.');
      const ip = ipDoCliente(req);
      const lim = porIp.permitir(ip);
      if (!lim.ok) {
        res.setHeader('Retry-After', String(lim.esperarSegundos));
        return erro(req, res, 429, 'Muitos pedidos em pouco tempo.', { esperarSegundos: lim.esperarSegundos });
      }
      if (!String(req.headers['content-type'] ?? '').includes('application/json')) return erro(req, res, 415, 'Envie JSON.');
      let corpo;
      try { corpo = await lerCorpo(req, 2048); } catch (e) { return erro(req, res, e.status ?? 400, e.message); }
      const v = validarPedido(corpo);
      if (!v.ok) return erro(req, res, 400, 'Confira os campos.', { campos: v.campos });
      if (v.robo) {
        // Não sinaliza ao robô que foi detectado; também não grava.
        return enviarJson(req, res, { ok: true, id: randomUUID() }, { status: 201, etag: false, cache: 'no-store' });
      }
      const limE = porEmail.permitir(v.valores.email);
      if (!limE.ok) {
        res.setHeader('Retry-After', String(limE.esperarSegundos));
        return erro(req, res, 429, 'Já recebemos pedidos deste e-mail.', { esperarSegundos: limE.esperarSegundos });
      }
      const id = randomUUID();
      try {
        inserir.run(id, v.valores.tipo, v.valores.email, v.valores.org, new Date().toISOString(), createHash('sha256').update(sal + ip).digest('hex').slice(0, 16));
        if (!conferir.get(id)) throw new Error('Gravação não confirmada.');
      } catch (e) {
        console.error('[pedidos] falha ao gravar:', e.message);
        return erro(req, res, 503, 'Não foi possível registrar agora. Tente novamente.');
      }
      enviarJson(req, res, { ok: true, id }, { status: 201, etag: false, cache: 'no-store' });
    },
    fechar() { clearInterval(timer); db.close(); },
  };
}
