import { describe, expect, it } from 'vitest';
import { parseHash, serializeHash, ESTADO_INICIAL, type EstadoUrl } from '../../src/app/hash';

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
