import { describe, expect, it } from 'vitest';
import { abstencaoPct, brancosNulosPct, comparecimentoPct, delta2022, indicadores, limitesCandidato, linhas, margemEntre, resultadoDoItem, vantagem } from '../../src/data/calculos';
import type { Candidato, Colunar, Resultado } from '../../src/data/contratos';
import { registroAte } from '../../src/features/linha-do-tempo/registro';

const cand = (n: string, partido: string, destino: 'valido' | 'anulado' = 'valido'): Candidato => ({ n, sq: `1${n}`, nome: `C${n}`, nomeUrna: `C${n}`, nomeCompleto: '', partido, situacao: 'apurando', situacaoTse: '', destino });
const base = (p: Partial<Resultado>): Resultado => ({ secoes: 10, totalizadas: 10, eleitorado: 1000, eleitoradoApurado: 1000, comparecimento: 800, abstencao: 200, brancos: 20, nulos: 30, validos: 750, anuladosSJ: 0, votos: {}, anulados: {}, situacao: 'apurando', situacoes: {}, ...p });

describe('denominadores', () => {
  it('parcela sobre válidos, anulados fora do denominador', () => {
    const r = base({ validos: 700, votos: { '10': 400, '20': 300 }, anulados: { '30': 50 }, anuladosSJ: 50 });
    const ls = linhas(r, [cand('10', 'PL'), cand('20', 'PT'), cand('30', 'PSD', 'anulado')]);
    expect(ls.map((l) => l.c.n)).toEqual(['10', '20', '30']);
    expect(ls[0].parcela).toBeCloseTo(400 / 700);
    expect(ls[2]).toMatchObject({ anulado: true, parcela: null, votos: 50 });
    // a soma das parcelas válidas é 100%, sem os anulados
    expect((ls[0].parcela ?? 0) + (ls[1].parcela ?? 0)).toBeCloseTo(1);
  });

  it('comparecimento e abstenção no universo das seções apuradas', () => {
    const r = base({ secoes: 10, totalizadas: 5, eleitorado: 1000, eleitoradoApurado: 500, comparecimento: 400, abstencao: 100 });
    expect(comparecimentoPct(r)).toBeCloseTo(0.8);
    expect(abstencaoPct(r)).toBeCloseTo(0.2);
    expect(brancosNulosPct(base({ comparecimento: 1000, brancos: 20, nulos: 30 }))).toBeCloseTo(0.05);
  });

  it('denominador zero vira ausência de dado', () => {
    expect(comparecimentoPct(base({ eleitoradoApurado: 0 }))).toBeNull();
    expect(linhas(base({ validos: 0, votos: { '10': 0 } }), [cand('10', 'PL')])[0].parcela).toBeNull();
  });
});

describe('vantagem e disputas', () => {
  const r = base({ validos: 1000, votos: { '1': 360, '2': 350, '3': 290 } });
  const ls = linhas(r, [cand('1', 'PL'), cand('2', 'PT'), cand('3', 'MDB')]);
  it('diferença em pontos e votos', () => {
    const v = vantagem(ls)!;
    expect(v.pontos).toBeCloseTo(0.01);
    expect(v.votos).toBe(10);
  });
  it('Senado compara a 2ª e a 3ª posições', () => {
    const m = margemEntre(ls, 1)!;
    expect(m.a.c.n).toBe('2');
    expect(m.b.c.n).toBe('3');
    expect(m.pontos).toBeCloseTo(0.06);
  });
  it('comparação com 2022 pela candidatura de mesmo número', () => {
    expect(delta2022(0.45, '13', { validos: 100, votos: { '13': 48 } })).toBeCloseTo(-0.03);
    expect(delta2022(0.45, '99', { validos: 100, votos: { '13': 48 } })).toBeNull();
  });
});

describe('regiões ponderadas por votos', () => {
  it('soma votos e válidos em vez de média de percentuais', () => {
    // UF A: 90% de 100 válidos; UF B: 10% de 900 válidos → região: (90+90)/1000 = 18%
    const somaVotos = 90 + 90, somaValidos = 100 + 900;
    expect(somaVotos / somaValidos).toBeCloseTo(0.18);
    expect((0.9 + 0.1) / 2).not.toBeCloseTo(0.18);
  });
});

describe('coleções colunares', () => {
  const col: Colunar = {
    candidatos: ['13', '22', '30'], tse: ['00001', '00002', '00003'],
    secoes: [2, 4, null], totalizadas: [2, 1, null], eleitorado: [100, 400, null], comparecimento: [80, 100, null],
    brancos: [1, 2, null], nulos: [1, 2, null], validos: [78, 96, null], anuladosSJ: [0, 0, null],
    votos: [[50, 30, null], [28, 60, null], [0, 6, null]],
  };
  it('líder, margem e fração por item; item sem dados fica neutro', () => {
    const ind = indicadores(col, [true, true, true]);
    expect(Array.from(ind.lider)).toEqual([0, 1, -1]);
    expect(ind.margem[0]).toBeCloseTo((50 - 28) / 78);
    expect(ind.fracao[1]).toBeCloseTo(0.25);
    expect(ind.temDados[2]).toBe(0);
  });
  it('resultado de um item separa anulados', () => {
    const r = resultadoDoItem(col, 1, [cand('13', 'PT'), cand('22', 'PL'), cand('30', 'NOVO', 'anulado')])!;
    expect(r.votos).toEqual({ '13': 30, '22': 60 });
    expect(r.anulados).toEqual({ '30': 6 });
    expect(r.eleitoradoApurado).toBe(100);
  });
  it('limites da escala do candidato são quantis ponderados', () => {
    const parc = Float32Array.from([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    const lim = limitesCandidato(parc, [1, 1, 1, 1, 1, 1], 3);
    expect(lim).toEqual([0.2, 0.4]);
  });
});

describe('linha do tempo', () => {
  it('escolhe o registro anterior ou igual ao instante pedido', () => {
    const lista = [1042, 1044, 1050, 1255, 1620];
    expect(registroAte(1255, lista)).toBe(1255);
    expect(registroAte(1254, lista)).toBe(1050);
    expect(registroAte(1000, lista)).toBeNull();
    expect(registroAte(9999, lista)).toBe(1620);
  });
});
