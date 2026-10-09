// Jornadas críticas do plano (T01–T15), de ponta a ponta no navegador, contra o servidor próprio
// com os dados oficiais publicados em dados/publicado/oficial. A simulação entra só onde o
// roteiro precisa de relógio (T09). Textos conferidos são os da interface.

import { test, expect, type Page } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { ARQUIVO_PEDIDOS } from './ambiente';

async function abrir(page: Page, caminho: string) {
  await page.goto(caminho);
  await page.waitForFunction(() => document.querySelector('.app')?.getAttribute('data-carregando') === 'nao', null, { timeout: 45_000 });
}
const camadas = (page: Page) => page.getByRole('group', { name: 'O mapa mostra' });
const abaCargo = (page: Page, nome: string) => page.getByRole('group', { name: 'Cargo' }).getByRole('button', { name: nome, exact: true });
const legenda = (page: Page) => page.locator('.legenda').first();
const indicador = (page: Page) => page.locator('.vivo').first();
const figuras = (page: Page) => page.locator('.cand-nacional .figura');

/** Toca/clica num ponto do mapa que acerta uma geometria (usa o motor exposto em desenvolvimento). */
async function tocarNoMapa(page: Page, toque = false) {
  const p = await page.evaluate(() => {
    const m = (window as unknown as { __motor?: { sobre: HTMLCanvasElement; alvoEm: (x: number, y: number) => unknown } }).__motor;
    if (!m) return null;
    m.sobre.scrollIntoView({ block: 'center' });
    const r = m.sobre.getBoundingClientRect();
    for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.55], [0.55, 0.45], [0.4, 0.4], [0.6, 0.6]]) {
      if (m.alvoEm(r.width * fx, r.height * fy)) return { x: r.left + r.width * fx, y: r.top + r.height * fy };
    }
    return null;
  });
  expect(p, 'ponto do mapa sobre uma geometria').not.toBeNull();
  if (toque) await page.touchscreen.tap(p!.x, p!.y);
  else await page.mouse.click(p!.x, p!.y);
}

test('T01 · camadas do mapa nacional mudam a URL e a legenda', async ({ page }) => {
  await abrir(page, '/?semAnuncio#presidente');
  await expect(legenda(page)).toContainText('municípios');
  await camadas(page).getByRole('button', { name: 'Estados' }).click();
  await expect(page).toHaveURL(/#presidente~e$/);
  await expect(legenda(page)).toContainText('estados');
  await camadas(page).getByRole('button', { name: 'Vantagem' }).click();
  await expect(page).toHaveURL(/#presidente~v$/);
  await expect(legenda(page)).toContainText('votos de vantagem');
  await camadas(page).getByRole('button', { name: 'Apurado' }).click();
  await expect(page).toHaveURL(/#presidente~a$/);
  await expect(legenda(page).locator('.leg-rampa')).toHaveAttribute('aria-label', /^Seções totalizadas/);
  await camadas(page).getByRole('button', { name: 'Municípios' }).click();
  await expect(page).toHaveURL(/#presidente$/);
  await expect(camadas(page).getByRole('button', { name: 'Municípios' })).toHaveAttribute('aria-pressed', 'true');
});

test('T02 · Brasil → MG → Belo Horizonte → zona 26, Esc e histórico do navegador', async ({ page }) => {
  await abrir(page, '/?semAnuncio#presidente');
  await page.locator('button.rotulo-uf[aria-label^="Minas Gerais"]').click();
  await expect(page).toHaveURL(/#presidente-mg$/);
  await expect(page.locator('#titulo-uf')).toHaveText('Minas Gerais');
  await page.getByRole('button', { name: /^Belo Horizonte:/ }).click();
  await expect(page).toHaveURL(/#presidente-mg-3106200$/);
  await expect(page.locator('#titulo-mun')).toHaveText('Belo Horizonte');
  await page.getByRole('button', { name: /^Zona 26:/ }).click();
  await expect(page).toHaveURL(/#presidente-mg-3106200-z26$/);
  await expect(page.locator('section.detalhe-mun')).toContainText('Presidente na 26ª zona');
  await expect(page.locator('section.detalhe-mun')).toContainText('Comparecimento');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#presidente-mg-3106200$/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#presidente-mg$/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#presidente$/);
  await page.goBack();
  await expect(page).toHaveURL(/#presidente-mg$/);
  await expect(page.locator('#titulo-uf')).toHaveText('Minas Gerais');
  await page.goForward();
  await expect(page).toHaveURL(/#presidente$/);
});

test('T03 · busca sem acento e homônimos identificados pela UF', async ({ page }) => {
  await abrir(page, '/?semAnuncio#presidente');
  await page.keyboard.press('Control+k');
  const caixa = page.getByRole('combobox', { name: /^Buscar/ });
  await expect(caixa).toBeFocused();
  await caixa.fill('sao jose do rio preto');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#presidente-sp-3549805$/);
  await expect(page.locator('#titulo-mun')).toHaveText('São José do Rio Preto');

  await page.keyboard.press('Control+k');
  await caixa.fill('bom jesus');
  const homonimos = page.getByRole('group', { name: 'Municípios' }).getByRole('option').filter({ has: page.locator('.busca-texto b', { hasText: /^Bom Jesus$/ }) });
  await expect(homonimos).toHaveCount(5);
  const ufs = await homonimos.locator('.busca-selo').allTextContents();
  expect(new Set(ufs).size).toBe(5);
  await homonimos.filter({ has: page.locator('.busca-selo', { hasText: /^RS$/ }) }).click();
  await expect(page).toHaveURL(/#presidente-rs-4302303$/);
  await expect(page.locator('#titulo-mun')).toHaveText('Bom Jesus');
});

test('T04 · ficha de candidato nacional mostra o mapa dele e restaura a camada ao fechar', async ({ page }) => {
  await abrir(page, '/?semAnuncio#presidente~e');
  await page.getByRole('button', { name: 'Ver Lula' }).first().click();
  await expect(page).toHaveURL(/#presidente~c13$/);
  await expect(page.locator('#titulo-perfil')).toContainText('Lula');
  await expect(legenda(page).locator('.leg-rampa')).toHaveAttribute('aria-label', /^Participação de Lula/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#titulo-perfil')).toHaveCount(0);
  await expect(page).toHaveURL(/#presidente~e$/);
});

test('T05 · governadores → disputa mais apertada → UF com o governador primeiro', async ({ page }) => {
  await abrir(page, '/?semAnuncio#governadores');
  const item = page.locator('section.governadores').getByRole('button', { name: /, (eleito|2º turno|apurando)$/ }).first();
  const uf = (await item.getAttribute('aria-label'))!.split(':')[0];
  await item.click();
  await expect(page).toHaveURL(/#governadores-[a-z]{2}$/);
  await expect(page.locator('#titulo-uf')).toHaveText(uf);
  const primeira = page.locator('section.detalhe-uf .secao').first();
  await expect(primeira.locator('h4')).toHaveText('Governador');
  await expect(primeira.locator('.secao-hd .selo')).toHaveText(/2º turno|Eleito\(a\)/);
});

test('T06 · Senado → disputa pela segunda vaga → candidatos da UF', async ({ page }) => {
  await abrir(page, '/?semAnuncio#senado');
  const item = page.locator('section.senado').getByRole('button', { name: /^[^:,]+: .+ \d+,\d{2}%, .+ \d+,\d{2}%$/ }).first();
  const uf = (await item.getAttribute('aria-label'))!.split(':')[0];
  await item.click();
  await expect(page).toHaveURL(/#senado-[a-z]{2}$/);
  await expect(page.locator('#titulo-uf')).toHaveText(uf);
  const primeira = page.locator('section.detalhe-uf .secao').first();
  await expect(primeira.locator('h4')).toHaveText('Senado · duas vagas');
  expect(await primeira.getByRole('button', { name: /^Ver / }).count()).toBeGreaterThanOrEqual(2);
});

test('T07 · deputados → estaduais → DF usa Câmara Legislativa e distritais', async ({ page }) => {
  await abrir(page, '/?semAnuncio#deputados');
  await page.getByRole('button', { name: 'Estaduais', exact: true }).first().click();
  await page.locator('button.rotulo-uf[aria-label^="Distrito Federal"]').click();
  await expect(page).toHaveURL(/#deputados-df$/);
  const card = page.locator('section.detalhe-uf');
  await expect(card).toContainText('Câmara Legislativa');
  await expect(card.getByRole('button', { name: 'Distritais', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('T08 · exterior → Portugal → Lisboa → voltar, com horário de fechamento em Brasília', async ({ page }) => {
  await abrir(page, '/?semAnuncio#presidente');
  await page.getByRole('button', { name: 'Ver os votos do exterior' }).first().click();
  await expect(page).toHaveURL(/#presidente-zz$/);
  await page.getByRole('button', { name: /^Portugal:/ }).click();
  await expect(page).toHaveURL(/#presidente-zz-pt$/);
  await page.getByRole('button', { name: /^Lisboa:/ }).click();
  await expect(page).toHaveURL(/#presidente-zz-\d{5}$/);
  await expect(page.locator('section.exterior')).toContainText(/As urnas fecharam às 13h/);
  await page.goBack();
  await expect(page).toHaveURL(/#presidente-zz-pt$/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#presidente-zz$/);
  await abaCargo(page, 'Senado').click();
  await expect(page).toHaveURL(/#senado$/);
});

test('T09 · instante passado não muda com novas atualizações; voltar ao vivo', async ({ page, request }) => {
  await request.post('/api/simulacao/relogio', { data: { t: 1200 } });
  try {
    await abrir(page, '/?semAnuncio&fonte=simulacao#presidente~t1800');
    await expect(indicador(page)).toHaveText(/Histórico · 18h00/);
    await expect(figuras(page).first()).toBeVisible();
    const antes = await figuras(page).allTextContents();
    // nova atualização ao vivo (21h40) e um ciclo de consulta forçado
    await request.post('/api/simulacao/relogio', { data: { t: 1300 } });
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(2500);
    await expect(indicador(page)).toHaveText(/Histórico · 18h00/);
    expect(await figuras(page).allTextContents()).toEqual(antes);
    await page.getByRole('button', { name: 'Voltar ao vivo' }).click();
    await expect(page).toHaveURL(/#presidente$/);
    await expect(indicador(page)).toContainText('21h40');
    expect(await figuras(page).allTextContents()).not.toEqual(antes);
  } finally {
    await request.post('/api/simulacao/relogio', { data: { t: null } });
  }
});

test('T10 · link copiado restaura cargo, lugar e camada noutro navegador', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await abrir(page, '/?semAnuncio#governadores-rj~a');
  await expect(page).toHaveURL(/#governadores-rj~a$/);
  await expect(page.locator('#titulo-uf')).toHaveText('Rio de Janeiro');
  await expect(abaCargo(page, 'Governadores')).toHaveAttribute('aria-pressed', 'true');
  await expect(camadas(page).getByRole('button', { name: 'Apurado' })).toHaveAttribute('aria-pressed', 'true');
  // fragmento inválido volta ao estado válido mais próximo, e a barra de endereço acompanha
  await page.goto('/?semAnuncio#presidente-mg-9999999');
  await expect(page).toHaveURL(/#presidente-mg$/);
  await page.goto('/?semAnuncio#nada');
  await expect(page).toHaveURL(/#presidente$/);
  await ctx.close();
});

test('T11 · atalhos de teclado, foco devolvido e controle deslizante', async ({ page }) => {
  await abrir(page, '/?semAnuncio#presidente');
  const botaoBusca = page.getByRole('button', { name: 'Buscar município, estado ou candidato' });
  const caixa = page.getByRole('combobox', { name: /^Buscar/ });
  await botaoBusca.focus();
  await page.keyboard.press('Control+k');
  await expect(caixa).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(caixa).toBeHidden();
  await expect(botaoBusca).toBeFocused();
  await page.keyboard.press('/');
  await expect(caixa).toBeFocused();
  await page.keyboard.press('Escape');

  await page.keyboard.press('2');
  await expect(page).toHaveURL(/#governadores$/);
  await page.keyboard.press('1');
  await expect(page).toHaveURL(/#presidente$/);

  const afastar = page.getByRole('button', { name: 'Afastar o mapa' });
  await expect(afastar).toBeDisabled();
  await page.keyboard.press('+');
  await expect(afastar).toBeEnabled();
  await page.keyboard.press('0');
  await expect(afastar).toBeDisabled();

  const slider = page.getByRole('slider', { name: 'Hora da apuração' });
  await expect(slider).toHaveAttribute('aria-valuetext', /ao vivo/);
  await slider.focus();
  // no oficial há registros da série nacional desde as 17h; Home leva ao início da apuração
  await page.keyboard.press('Home');
  await expect(page).toHaveURL(/~t\d{4}$/);
  await expect(indicador(page)).toHaveText(/^Histórico/);
  await page.getByRole('button', { name: 'Voltar ao vivo' }).click();
  await expect(page).toHaveURL(/#presidente$/);
});

test('T12 · sem rede mantém o último dado válido e reconecta', async ({ page, context }) => {
  await abrir(page, '/?semAnuncio#presidente');
  const antes = await figuras(page).allTextContents();
  const alerta = page.locator('.alerta-conexao[role="alert"]');
  await context.setOffline(true);
  await expect(alerta).toContainText('Mantido o último dado válido');
  await expect(indicador(page)).toContainText('Reconectando');
  expect(await figuras(page).allTextContents()).toEqual(antes);
  await context.setOffline(false);
  await expect(alerta).toBeHidden({ timeout: 30_000 });
  await expect(indicador(page)).toContainText('Atualizado às');
  expect(await figuras(page).allTextContents()).toEqual(antes);
});

test('T12 · fonte fora do ar não exibe resultado algum', async ({ page }) => {
  await page.goto('/?semAnuncio&cenario=falha#presidente');
  await expect(page.locator('.alerta-conexao[role="alert"]')).toContainText('Nenhum resultado exibido até a primeira resposta válida');
  await expect(page.locator('.selo-modo-botao')).toContainText('Cenário de teste: falha');
  expect(await page.locator('body').innerText()).not.toMatch(/\d+,\d%/);
});

test('T13 · pedido inválido, sucesso só após gravação e limite por e-mail', async ({ page }) => {
  const email = `t13-${Date.now()}@exemplo.test`;
  const abrirFormulario = async () => {
    await page.getByRole('button', { name: /Acesso sob convite/ }).first().click();
    return page.getByRole('dialog');
  };
  const enviar = async (d: ReturnType<Page['getByRole']>) => {
    await d.locator('#f-email').fill(email);
    await d.locator('#f-org').fill('Teste automatizado');
    await d.getByRole('button', { name: 'Solicitar acesso' }).click();
  };
  await abrir(page, '/?semAnuncio#presidente');
  let d = await abrirFormulario();
  await d.getByRole('button', { name: 'Solicitar acesso' }).click();
  await expect(d.locator('#f-email')).toHaveAttribute('aria-invalid', 'true');
  await expect(d.getByRole('heading', { name: 'Pedido recebido' })).toHaveCount(0);

  for (let i = 0; i < 3; i++) {
    if (i > 0) d = await abrirFormulario();
    await enviar(d);
    await expect(d.getByRole('heading', { name: 'Pedido recebido' })).toBeVisible();
    await d.locator('.form-ok').getByRole('button', { name: 'Fechar' }).click();
  }
  if (ARQUIVO_PEDIDOS) {
    const db = new DatabaseSync(ARQUIVO_PEDIDOS);
    const linha = db.prepare('SELECT COUNT(*) AS n FROM pedidos WHERE email = ?').get(email) as { n: number };
    db.close();
    expect(linha.n).toBe(3);
  }
  d = await abrirFormulario();
  await enviar(d);
  await expect(d.locator('.erro-form')).toContainText('Já recebemos pedidos deste e-mail.');
  await expect(d.locator('.erro-form')).toContainText(/Tente de novo em \d+ min\./);
  await expect(d.getByRole('heading', { name: 'Pedido recebido' })).toHaveCount(0);
});

test('T14 · modo TV: roteiro troca de cena sem empilhar histórico; sair restaura o contexto', async ({ page }) => {
  await abrir(page, '/?semAnuncio#presidente-mg~a');
  const entradas = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: /^Tela cheia/ }).click();
  await expect(page).toHaveURL(/#presidente~v~tv$/);
  await expect(page.locator('.app')).toHaveClass(/v-tv/);
  await expect(page.getByRole('button', { name: 'Sair do modo TV' })).toBeAttached();
  // primeira cena dura 22 s
  await expect(page).toHaveURL(/#presidente~tv$/, { timeout: 40_000 });
  expect(await page.evaluate(() => history.length)).toBe(entradas);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#presidente-mg~a$/);
  await expect(page.locator('.app')).toHaveClass(/v-desktop/);
});

test('T15 · girar o celular mantém o layout usável e o mapa clicável', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const semRolagemLateral = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const zoomDesobstruido = () => page.evaluate(() => [...document.querySelectorAll('.zoomctl button')].every((b) => {
    const r = b.getBoundingClientRect();
    return document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)?.closest('button') === b;
  }));

  await abrir(page, '/?semAnuncio#presidente');
  await expect(page.locator('.app')).toHaveClass(/v-celular/);
  expect(await semRolagemLateral()).toBe(true);
  await tocarNoMapa(page, true);
  await expect(page).toHaveURL(/#presidente-[a-z]{2}$/);

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('.app')).toHaveClass(/v-paisagem/);
  expect(await semRolagemLateral()).toBe(true);
  expect(await zoomDesobstruido()).toBe(true);
  await tocarNoMapa(page, true);
  await expect(page).toHaveURL(/#presidente-[a-z]{2}-\d{7}$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.app')).toHaveClass(/v-celular/);
  expect(await semRolagemLateral()).toBe(true);
  const antes = page.url();
  await page.getByRole('button', { name: /^Voltar para / }).click();
  await expect(page).not.toHaveURL(antes);
  await tocarNoMapa(page, true);
  await expect(page).toHaveURL(/#presidente-[a-z]{2}-\d{7}$/);
  await ctx.close();
});
