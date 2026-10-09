import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error módulo do servidor sem tipos
import { compactar, eleicaoDoCargo, lerResultado, minutosDaEleicao } from '../../server/lib/tse.mjs';
// @ts-expect-error módulo do servidor sem tipos
import { CONFIG_ELEICOES, criarFeedSegundoTurno, criarLeitorTse, caminhoResultado } from '../../server/segundo-turno.mjs';
import { validarAtualizacaoSegundoTurno, validarDetalheSegundoTurno, validarPainelSegundoTurno } from '../../src/data/validar';
import { brutoSegundoTurno, configSegundoTurno, GOVERNOS_TESTE, painelSegundoTurno } from '../fixtures/segundo-turno';
import { baseDoModo } from '../../src/data/provedor';
import { urlFoto } from '../../src/components/Retrato';

const leitor = (final = false) => vi.fn(async (rel: string) => {
  if (rel === CONFIG_ELEICOES) return configSegundoTurno();
  if (rel.includes('/config/mun-')) return { abr: [{ cd: 'mg', mu: [{ cd: '41238', z: ['26', '27'] }] }, { cd: 'zz', mu: [{ cd: '12345', z: [] }] }] };
  const m = /\/dados\/([a-z]{2})\/[^/]+-c(\d{4})-e\d{6}-u\.json$/.exec(rel);
  if (!m) return null;
  const zona = /-z(\d+)/.exec(rel)?.[1];
  const municipio = /\/mg(\d{5})-/.exec(rel)?.[1];
  return brutoSegundoTurno({ cargo: Number(m[2]), uf: zona ?? municipio ?? m[1], final });
});

describe('publicação e contrato do 2º turno', () => {
  it('espera t=2, sem usar os códigos previstos em cdt2 como publicação', async () => {
    expect(eleicaoDoCargo(configSegundoTurno(false), 1, 2)).toBeNull();
    const feed = criarFeedSegundoTurno({ ler: async () => configSegundoTurno(false) });
    expect(validarPainelSegundoTurno(await feed.painel())).toMatchObject({ aguardando: true, agora: null });
    expect(eleicaoDoCargo(configSegundoTurno(), 1, 2).cd).toBe('6258');
    expect(eleicaoDoCargo(configSegundoTurno(), 3, 2).cd).toBe('6260');
  });
  it('valida o turno solicitado e conta minutos desde 25/10', () => {
    const bruto = brutoSegundoTurno();
    expect(() => lerResultado(bruto, { cargo: 1, abrangencia: 'br' })).toThrow(/Turno/);
    const r = compactar(lerResultado(bruto, { cargo: 1, abrangencia: 'br', turno: 2, eleicao: '6258' }));
    expect(r.votos).toEqual({ '13': 200, '22': 150 });
    expect(r.anulados).toEqual({ '99': 10 });
    expect(r.validos).toBe(350);
    expect(r.situacao).toBe('apurando'); // 200/350 não autoriza declarar vitória
    expect(minutosDaEleicao(r.geradoEm, '2026-10-25')).toBe(1080);
  });
  it('normaliza Brasil, 27 UFs, exterior e somente os sete governos', async () => {
    const ler = leitor();
    const p = validarPainelSegundoTurno(await criarFeedSegundoTurno({ ler }).painel());
    expect(p.agora?.turno).toBe(2);
    expect(Object.keys(p.agora!.presidente.uf)).toHaveLength(27);
    expect(Object.keys(p.agora!.governador.uf)).toEqual(GOVERNOS_TESTE);
    expect(p.agora!.senador.uf).toEqual({});
    expect(ler.mock.calls.every(([rel]) => !rel.includes('consulta_cand') && !/-c000[5678]-/.test(rel))).toBe(true);
    expect(p.manifesto.eleicao.data).toBe('2026-10-25');
  });
  it('vitória só depois de Eleito no TSE; preserva os números finais', async () => {
    const p = validarPainelSegundoTurno(await criarFeedSegundoTurno({ ler: leitor(true) }).painel());
    expect(p.agora!.presidente.br.situacoes['13']).toBe('eleito');
    expect(p.agora!.presidente.br.totalizadas).toBe(100);
    expect(p.agora!.presidente.br.votos).toEqual({ '13': 200, '22': 150 });
  });
  it('municípios e zonas são conferidos no cadastro; não aceita outros cargos ou UFs', async () => {
    const ler = leitor();
    const feed = criarFeedSegundoTurno({ ler });
    const d = validarDetalheSegundoTurno(await feed.detalhe('resultados/presidente/mg/41238/z26.json'));
    expect(d.resultado.validos).toBe(350);
    expect(await feed.detalhe('resultados/presidente/mg/41238/z999.json')).toBeNull();
    expect(await feed.detalhe('resultados/presidente/mg/99999.json')).toBeNull();
    expect(await feed.detalhe('resultados/governador/sp.json')).toBeNull();
    expect(await feed.detalhe('resultados/senador/rj.json')).toBeNull();
    expect(await feed.detalhe('../consulta_cand.json')).toBeNull();
    expect(await feed.detalhe('cadastro/presidente/zz.json')).toMatchObject({ turno: 2, municipios: [{ tse: '12345' }] });
  });
  it('ausência (404) e divulgação bloqueada aguardam; lote incoerente é rejeitado', async () => {
    const ler = leitor();
    expect((await criarFeedSegundoTurno({ ler: async (rel: string) => rel === caminhoResultado('6258', 1, 'br') ? null : ler(rel) }).painel()).agora).toBeNull();
    expect((await criarFeedSegundoTurno({ ler: async (rel: string) => rel === caminhoResultado('6258', 1, 'br') ? { ...brutoSegundoTurno(), dv: 'n' } : ler(rel) }).painel()).agora).toBeNull();
    await expect(criarFeedSegundoTurno({ ler: async (rel: string) => rel.includes('/dados/') ? { ...brutoSegundoTurno(), t: '1' } : ler(rel) }).painel()).rejects.toThrow(/Turno/);
  });
  it('cache de 15 s compartilha requisições e respeita indisponibilidade sem esconder falhas', async () => {
    let agora = 0;
    const consultar = vi.fn(async () => new Response(JSON.stringify(configSegundoTurno())));
    const ler = criarLeitorTse({ consultar, agora: () => agora });
    await Promise.all([ler(CONFIG_ELEICOES), ler(CONFIG_ELEICOES)]);
    expect(consultar).toHaveBeenCalledTimes(1);
    agora = 14_999; await ler(CONFIG_ELEICOES); expect(consultar).toHaveBeenCalledTimes(1);
    agora = 15_000; await ler(CONFIG_ELEICOES); expect(consultar).toHaveBeenCalledTimes(2);
    const falha = criarLeitorTse({ consultar: async () => new Response('', { status: 429, headers: { 'retry-after': '30' } }) });
    await expect(falha(CONFIG_ELEICOES)).rejects.toMatchObject({ esperarSegundos: 30 });
  });
  it('cliente recusa outro turno e fotos/feed mantêm bases independentes', () => {
    const p = painelSegundoTurno();
    p.agora!.turno = 1;
    expect(() => validarPainelSegundoTurno(p)).toThrow(/outro turno/);
    expect(baseDoModo('oficial')).toBe('/feed/oficial/');
    expect(baseDoModo('oficial', 2)).toBe('/feed/oficial-2t/');
    expect(urlFoto('presidente', null, '280001111111', '6258')).toBe('/feed/fotos/6258/br/280001111111.jpeg');
    expect(urlFoto('presidente', null, '280001111111')).toBe('/feed/fotos/6257/br/280001111111.jpeg');
  });
  it('arquivo de uma UF mais antigo ou ausente não é escondido por uma sequência maior', () => {
    const anterior = painelSegundoTurno(true);
    const novo = painelSegundoTurno(true);
    novo.agora!.seq = 300;
    novo.agora!.presidente.uf.MG = { ...novo.agora!.presidente.uf.MG, geradoEm: '2026-10-25T18:00:00-03:00' };
    expect(() => validarAtualizacaoSegundoTurno(novo, anterior)).toThrow(/presidente MG/);
    delete novo.agora!.presidente.uf.MG;
    expect(() => validarAtualizacaoSegundoTurno(novo, anterior)).toThrow(/presidente MG/);
    expect(validarAtualizacaoSegundoTurno(painelSegundoTurno(true), painelSegundoTurno())).toBeTruthy();
  });
});
