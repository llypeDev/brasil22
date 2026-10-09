import { describe, expect, it } from 'vitest';
import { parseHash, serializeHash, ESTADO_INICIAL, type EstadoUrl } from '../../src/app/hash';
import { normalizarNav } from '../../src/app/store';

const ida = (h: string) => serializeHash(parseHash(h));

describe('parseHash / serializeHash', () => {
  it('ida e volta das rotas confirmadas na referência', () => {
    for (const h of ['#presidente', '#governadores', '#senado', '#deputados', '#presidente-mg', '#presidente-mg-3106200', '#presidente-mg-3106200-z26', '#presidente~c13', '#presidente-zz', '#presidente-zz-pt', '#presidente-zz-29955', '#presidente~tv']) {
      expect(ida(h)).toBe(h);
    }
  });

  it('camadas e instante', () => {
    expect(parseHash('#presidente~e').camada).toBe('uf');
    expect(parseHash('#presidente~v').camada).toBe('votes');
    expect(parseHash('#presidente~a').camada).toBe('apur');
    const e = parseHash('#presidente-sp~v~t2055~tv');
    expect(e).toMatchObject({ uf: 'SP', camada: 'votes', t: 20 * 60 + 55, tv: true });
    expect(serializeHash(e)).toBe('#presidente-sp~v~t2055~tv');
    // instantes depois da meia-noite seguem contando (horas > 23)
    expect(parseHash('#presidente~t2700').t).toBe(27 * 60);
  });

  it('preserva códigos longos e zeros à esquerda', () => {
    expect(parseHash('#presidente-zz-09999').cidade).toBe('09999');
    expect(parseHash('#presidente-mg-3106200-z0026').zona).toBe('26');
  });

  it('fragmento inexistente cai em estado válido', () => {
    expect(parseHash('#nada-xx-123~zz')).toEqual(ESTADO_INICIAL);
    expect(parseHash('')).toEqual(ESTADO_INICIAL);
    expect(parseHash('#presidente-qq').uf).toBeNull();
    // exterior só existe para presidente
    expect(parseHash('#senado-zz').zz).toBe(false);
  });

  it('valida contra o catálogo quando há validadores', () => {
    const v = { ufExiste: (uf: string) => uf === 'MG', municipioDaUf: (uf: string, ibge: string) => uf === 'MG' && ibge === '3106200', candidatoExiste: (_: unknown, __: unknown, n: string) => n === '13' };
    expect(parseHash('#presidente-mg-9999999', v)).toMatchObject({ uf: 'MG', mun: null });
    expect(parseHash('#presidente~c99', v)).toMatchObject({ camada: 'mun', cand: null });
    expect(parseHash('#presidente~c13', v)).toMatchObject({ camada: 'cand', cand: '13' });
  });

  it('serializa somente o estado de navegação', () => {
    const e: EstadoUrl = { ...ESTADO_INICIAL, cargo: 'senado', uf: 'BA' };
    expect(serializeHash(e)).toBe('#senado-ba');
  });
});

describe('turno', () => {
  it('#2turno abre a página do 2º turno; as demais rotas são do 1º', () => {
    expect(parseHash('#2turno').turno).toBe(2);
    expect(parseHash('#segundo-turno').turno).toBe(2);
    expect(parseHash('#2T').turno).toBe(2);
    expect(ida('#2turno')).toBe('#2turno');
    expect(serializeHash({ ...ESTADO_INICIAL, turno: 2, cargo: 'senado', uf: 'BA' })).toBe('#2turno');
    expect(parseHash('#governadores-rj', {}, 2)).toMatchObject({ turno: 1, cargo: 'governadores', uf: 'RJ' });
    // fragmento inválido continua voltando ao presidente do 1º turno
    expect(parseHash('#nada', {}, 2)).toEqual(ESTADO_INICIAL);
  });

  it('o turno padrão vale só para o endereço sem fragmento', () => {
    expect(parseHash('', {}, 2)).toEqual({ ...ESTADO_INICIAL, turno: 2 });
    expect(parseHash('#', {}, 2).turno).toBe(2);
    expect(parseHash('').turno).toBe(1);
  });

  it('navegar por cargo, lugar, camada ou TV sai do 2º turno', () => {
    const noSegundo: EstadoUrl = { ...ESTADO_INICIAL, turno: 2 };
    expect(normalizarNav(noSegundo, { cargo: 'senado' })).toMatchObject({ turno: 1, cargo: 'senado' });
    expect(normalizarNav(noSegundo, { uf: 'MG' })).toMatchObject({ turno: 1, uf: 'MG' });
    expect(normalizarNav(noSegundo, { tv: true })).toMatchObject({ turno: 1, tv: true });
    expect(normalizarNav(noSegundo, { turno: 1, cargo: 'governadores', uf: 'RJ' })).toMatchObject({ turno: 1, cargo: 'governadores', uf: 'RJ' });
  });

  it('trocar só o turno preserva o ponto do 1º turno e limpa TV e instante', () => {
    const antes: EstadoUrl = { ...ESTADO_INICIAL, cargo: 'governadores', uf: 'RJ', camada: 'apur', t: 1200, tv: true };
    const segundo = normalizarNav(antes, { turno: 2 });
    expect(segundo).toMatchObject({ turno: 2, tv: false, t: null, cargo: 'governadores', uf: 'RJ', camada: 'apur' });
    expect(serializeHash(normalizarNav(segundo, { turno: 1 }))).toBe('#governadores-rj~a');
  });
});
