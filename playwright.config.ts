// Jornadas de ponta a ponta (T01–T15). Uso: npm run test:e2e
//
// Sem E2E_BASE, sobe o servidor de desenvolvimento numa porta própria (5190) com banco de
// pedidos temporário e limite por IP folgado, para não misturar dados com o uso local.
// E2E_CANAL=chrome usa o Chrome instalado em vez do Chromium do Playwright; E2E_CHROMIUM, um executável.

import { defineConfig } from '@playwright/test';
import { ARQUIVO_PEDIDOS, BASE, BASE_EXTERNA, PORTA } from './tests/e2e/ambiente';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // relógio da simulação e limitadores de pedidos são estado do servidor: uma jornada por vez
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.E2E_CANAL ? { channel: process.env.E2E_CANAL } : {}),
    // E2E_CHROMIUM aponta um executável específico (ex.: build já baixada de outra versão)
    ...(process.env.E2E_CHROMIUM ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM } } : {}),
  },
  webServer: BASE_EXTERNA ? undefined : {
    command: `npx vite --port ${PORTA} --strictPort`,
    url: BASE,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PEDIDOS_ARQUIVO: ARQUIVO_PEDIDOS ?? '',
      PEDIDOS_LIMITE_IP: '50',
      FOTOS_OFFLINE: '1',
    },
  },
});
