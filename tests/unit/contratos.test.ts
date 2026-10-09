import { describe, expect, it } from 'vitest';
import { ErroValidacao, sequenciaAceita, validarAgora, validarColunar, validarResultado } from '../../src/data/validar';
// @ts-expect-error módulo do servidor sem tipos
import { lerResultado, situacaoDaDisputa, codigoSituacao, nomeDeExibicao, minutosDaEleicao, compactar } from '../../server/lib/tse.mjs';
// @ts-expect-error módulo do servidor sem tipos
import { validarPedido } from '../../server/pedidos.mjs';

const r = (p: Record<string, unknown> = {}) => ({ secoes: 10, totalizadas: 5, eleitorado: 100, eleitoradoApurado: 50, comparecimento: 40, abstencao: 10, brancos: 1, nulos: 1, validos: 38, anuladosSJ: 0, votos: { '1': 20, '2': 18 }, anulados: {}, situacao: 'apurando', situacoes: {}, ...p });
const agora = (p: Record<string, unknown> = {}) => ({ versao: 1, seq: 10, t: 1100, turno: 1, presidente: { br: r(), uf: { MG: r() }, zz: r(), regioes: {} }, governador: { uf: { MG: r() } }, senador: { uf: { MG: r() } }, ...p });

describe('validação de ingestão no cliente', () => {
  it('aceita um lote coerente', () => { expect(validarAgora(agora()).seq).toBe(10); });
  it('rejeita esquema desconhecido e turno inválido', () => {
    expect(() => validarAgora(agora({ versao: 2 }))).toThrow(ErroValidacao);
    expect(() => validarAgora(agora({ turno: 3 }))).toThrow(ErroValidacao);
  });
  it('rejeita seções totalizadas acima do total, contagem negativa e não inteira', () => {
    expect(() => validarResultado(r({ totalizadas: 11 }), 'x')).toThrow(/excedem/);
    expect(() => validarResultado(r({ brancos: -1 }), 'x')).toThrow(ErroValidacao);
    expect(() => validarResultado(r({ validos: 1.5 }), 'x')).toThrow(ErroValidacao);
  });
  it('rejeita soma nominal acima dos válidos', () => {
    expect(() => validarResultado(r({ validos: 10 }), 'x')).toThrow(/soma nominal/);
  });
  it('colunar: dimensões e ordem declaradas', () => {
    const c = { candidatos: ['1'], tse: ['a', 'b'], secoes: [1, 1], totalizadas: [1, 1], eleitorado: [1, 1], comparecimento: [1, 1], brancos: [0, 0], nulos: [0, 0], validos: [1, 1], anuladosSJ: [0, 0], votos: [[1, 1]] };
    expect(validarColunar(c)).toBe(c);
    expect(() => validarColunar({ ...c, votos: [[1]] })).toThrow(/dimensão/);
    expect(() => validarColunar({ ...c, candidatos: ['1', '2'] })).toThrow(/colunas de votos/);
    expect(() => validarColunar({ ...c, totalizadas: [2, 1] })).toThrow(/acima do total/);
  });
  it('sequência não regride no oficial; a simulação pode reiniciar o ciclo', () => {
    expect(sequenciaAceita(10, 11, 'oficial')).toBe(true);
    expect(sequenciaAceita(10, 9, 'oficial')).toBe(false);
    expect(sequenciaAceita(1600, 1012, 'simulacao')).toBe(true);
  });
});

const bruto = (p: Record<string, unknown> = {}) => ({
  ele: '6257', t: '1', f: 'o', tpabr: 'uf', cdabr: 'mg', dg: '05/10/2026', hg: '12:51:47', idg: '1', dt: '05/10/2026', ht: '12:51:05', dv: 's', and: 'f',
  s: { ts: '10', st: '10' }, e: { te: '100', est: '100', c: '80', a: '20' },
  v: { vv: '70', vb: '5', tvn: '5', vansj: '10', vnom: '70', vl: '0' },
  carg: [{ cd: '1', nv: '1', agr: [{ n: '1', nm: 'A', tp: 'i', com: '', par: [{ n: '22', sg: 'PL', tvtn: '40', tvan: '40', cand: [{ n: '22', sqcand: '1', nmu: 'FULANO DE TAL', nm: 'FULANO', dvt: 'Válido', st: '2º turno', vap: '40' }] }, { n: '13', sg: 'PT', tvtn: '30', tvan: '30', cand: [{ n: '13', sqcand: '2', nmu: 'BELTRANO', nm: 'B', dvt: 'Válido', st: '2º turno', vap: '30' }] }, { n: '10', sg: 'REPUBLICANOS', tvtn: '10', tvan: '10', cand: [{ n: '10', sqcand: '3', nmu: 'SICRANO', nm: 'S', dvt: 'Anulado sub judice', st: 'Não eleito', vap: '10' }] }] }] }],
  ...p,
});

describe('adaptador do TSE', () => {
  it('normaliza e separa anulados sub judice', () => {
    const x = lerResultado(bruto(), { cargo: 1, abrangencia: 'mg', eleicao: '6257' });
    const c = compactar(x);
    expect(c.votos).toEqual({ '22': 40, '13': 30 });
    expect(c.anulados).toEqual({ '10': 10 });
    expect(c.validos).toBe(70);
    expect(c.situacao).toBe('segundo-turno');
    expect(x.geradoEm).toBe('2026-10-05T12:51:47-03:00');
  });
  it('recusa abrangência, turno ou fase divergentes', () => {
    expect(() => lerResultado(bruto({ cdabr: 'sp' }), { cargo: 1, abrangencia: 'mg' })).toThrow(/Abrangência/);
    expect(() => lerResultado(bruto({ t: '2' }), { cargo: 1, abrangencia: 'mg' })).toThrow(/Turno/);
    expect(() => lerResultado(bruto({ f: 's' }), { cargo: 1, abrangencia: 'mg' })).toThrow(/oficial/);
    expect(() => lerResultado(bruto({ s: { ts: '5', st: '6' } }), { cargo: 1, abrangencia: 'mg' })).toThrow(/excedem/);
  });
  it('situação vem das candidaturas, nunca de percentuais', () => {
    const x = lerResultado(bruto(), { cargo: 1, abrangencia: 'mg' });
    // 40/70 = 57% dos válidos, mas a situação oficial é 2º turno
    expect(situacaoDaDisputa(x)).toBe('segundo-turno');
  });
  it('códigos de situação e grafia de exibição', () => {
    expect(codigoSituacao('Eleito por QP')).toBe('eleito-qp');
    expect(codigoSituacao('Eleito por média')).toBe('eleito-media');
    expect(codigoSituacao('Suplente')).toBe('suplente');
    expect(nomeDeExibicao('PROFESSORA DORINHA')).toBe('Professora Dorinha');
    expect(nomeDeExibicao('JHC')).toBe('JHC');
    expect(nomeDeExibicao('ZÉ DA SILVA E SOUZA')).toBe('Zé da Silva e Souza');
  });
  it('minutos da eleição atravessam a meia-noite', () => {
    expect(minutosDaEleicao('2026-10-04T20:55:00-03:00')).toBe(1255);
    expect(minutosDaEleicao('2026-10-05T12:51:05-03:00')).toBe(2211);
  });
});

describe('pedidos (servidor)', () => {
  it('valida tipo, e-mail e organização; detecta honeypot', () => {
    expect(validarPedido({ tipo: 'anuncio', email: 'a@empresa.com.br', org: 'Empresa' }).ok).toBe(true);
    expect(validarPedido({ tipo: 'outro', email: 'a@b.co', org: 'X Y' }).campos.tipo).toBeTruthy();
    expect(validarPedido({ tipo: 'acesso', email: 'sem-arroba', org: 'Org' }).campos.email).toBeTruthy();
    expect(validarPedido({ tipo: 'acesso', email: 'a@b.co', org: '' }).campos.org).toBeTruthy();
    expect(validarPedido({ tipo: 'acesso', email: 'a@b.co', org: 'Org', site: 'x' }).robo).toBe(true);
  });
});
