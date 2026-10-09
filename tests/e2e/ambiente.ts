// Endereços e arquivos compartilhados entre a configuração do Playwright e as jornadas.

import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const PORTA = Number(process.env.E2E_PORTA ?? 5190);
/** Servidor externo opcional (E2E_BASE); sem ele, o Playwright sobe o de desenvolvimento. */
export const BASE_EXTERNA = process.env.E2E_BASE ?? null;
export const BASE = BASE_EXTERNA ?? `http://127.0.0.1:${PORTA}`;
/** Banco de pedidos isolado dos testes; com servidor externo, só é conferido se informado. */
export const ARQUIVO_PEDIDOS = process.env.E2E_PEDIDOS ?? (BASE_EXTERNA ? null : join(tmpdir(), 'apuracao-2026-e2e', 'pedidos.sqlite'));
