// Capturas de comparação em resolução real (Playwright).
// Uso: node scripts/capturas.mjs [base=http://127.0.0.1:5180] [filtro]   (com npm run dev rodando)
// Cada captura espera dados, fontes e o fim das transições antes de fotografar.

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5180';
const FILTRO = process.argv[3] ?? '';
const SAIDA = join(RAIZ, 'docs', 'capturas');

const CENAS = [
  { nome: '01-presidente-desktop', url: '/?semAnuncio#presidente', vp: [1600, 900] },
  { nome: '02-governadores-desktop', url: '/?semAnuncio#governadores', vp: [1600, 900] },
  { nome: '03-senado-desktop', url: '/?semAnuncio#senado', vp: [1600, 900] },
  { nome: '04-deputados-desktop', url: '/?semAnuncio#deputados', vp: [1600, 900] },
  { nome: '05-deputados-estaduais', url: '/?semAnuncio#deputados', vp: [1600, 900], antes: async (p) => { await p.getByRole('button', { name: 'Estaduais' }).first().click(); } },
  { nome: '06-perfil-candidato', url: '/?semAnuncio#presidente', vp: [1600, 900], antes: async (p) => { await p.getByRole('button', { name: 'Ver Lula' }).first().click(); } },
  { nome: '07-presidente-estado', url: '/?semAnuncio#presidente-mg', vp: [1600, 900] },
  { nome: '08-busca', url: '/?semAnuncio#presidente-mg', vp: [1600, 900], antes: async (p) => { await p.keyboard.press('Control+k'); } },
  { nome: '09-municipio-zonas', url: '/?semAnuncio#presidente-mg-3106200', vp: [1600, 900] },
  { nome: '10-zona-eleitoral', url: '/?semAnuncio#presidente-mg-3106200-z26', vp: [1600, 900] },
  { nome: '11-exterior', url: '/?semAnuncio#presidente-zz', vp: [1600, 900] },
  { nome: '12-exterior-pais', url: '/?semAnuncio#presidente-zz-pt', vp: [1600, 900] },
  { nome: '13-exterior-cidade', url: '/?semAnuncio#presidente-zz-29955', vp: [1600, 900] },
  { nome: '14-modo-tv', url: '/?semAnuncio#presidente~v~tv', vp: [1600, 900] },
  { nome: '15-celular-vertical', url: '/?semAnuncio#presidente', vp: [390, 844], mobile: true },
  { nome: '16-celular-horizontal', url: '/?semAnuncio#presidente', vp: [844, 390], mobile: true },
  { nome: '17-acesso-celular', url: '/?semAnuncio#presidente', vp: [390, 844], mobile: true, antes: async (p) => { await p.getByRole('button', { name: /Acesso sob convite/ }).first().click(); } },
  { nome: '18-anuncio-desktop', url: '/?semAnuncio#presidente', vp: [1600, 900], antes: async (p) => { await p.getByRole('button', { name: /Anuncie aqui/ }).first().click(); } },
  { nome: '20-notebook-1366', url: '/?semAnuncio#presidente', vp: [1366, 768] },
  { nome: '21-desktop-1920', url: '/?semAnuncio#presidente', vp: [1920, 1080] },
  { nome: '22-desktop-estreito-1024', url: '/?semAnuncio#presidente', vp: [1024, 768] },
  { nome: '23-tablet-vertical', url: '/?semAnuncio#presidente', vp: [768, 1024], mobile: true },
  { nome: '24-celular-360', url: '/?semAnuncio#presidente', vp: [360, 800], mobile: true },
  { nome: '25-simulacao-apurando', url: '/?semAnuncio&fonte=simulacao#presidente', vp: [1600, 900], relogio: 1140 },
  { nome: '26-presidente-vantagem', url: '/?semAnuncio#presidente~v', vp: [1600, 900] },
  { nome: '27-presidente-candidato', url: '/?semAnuncio#presidente~c13', vp: [1600, 900] },
  { nome: '28-governador-uf', url: '/?semAnuncio#governadores-rj', vp: [1600, 900] },
  { nome: '29-anuncio-modal', url: '/#presidente', vp: [1600, 900], modal: true },
];

async function esperarPronto(p) {
  await p.waitForFunction(() => document.querySelector('.app')?.getAttribute('data-carregando') === 'nao', null, { timeout: 30000 }).catch(() => undefined);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1400);
}

await mkdir(SAIDA, { recursive: true });
// E2E_CHROMIUM: executável específico; E2E_CANAL: canal instalado (ex.: chrome); sem nenhum, o Chromium do Playwright
const navegador = await chromium.launch({
  headless: true,
  ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : process.env.E2E_CANAL ? { channel: process.env.E2E_CANAL } : {}),
});
try {
  for (const c of CENAS) {
    if (FILTRO && !c.nome.includes(FILTRO)) continue;
    const ctx = await navegador.newContext({ viewport: { width: c.vp[0], height: c.vp[1] }, deviceScaleFactor: 1, isMobile: !!c.mobile, hasTouch: !!c.mobile, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const p = await ctx.newPage();
    if (c.relogio) await fetch(`${BASE}/api/simulacao/relogio`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: c.relogio }) });
    await p.goto(BASE + c.url, { waitUntil: 'domcontentloaded' });
    await esperarPronto(p);
    if (c.antes) { await c.antes(p); await p.waitForTimeout(900); }
    if (c.modal) await p.waitForTimeout(3200);
    await p.screenshot({ path: join(SAIDA, `${c.nome}.png`) });
    console.log('ok', c.nome);
    if (c.relogio) await fetch(`${BASE}/api/simulacao/relogio`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: null }) });
    await ctx.close();
  }
} finally {
  await navegador.close();
}
