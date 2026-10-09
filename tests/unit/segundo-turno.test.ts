import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validarAgora } from '../../src/data/validar';
import type { Agora, Candidato, Catalogo, Resultado } from '../../src/data/contratos';
import {
  contagemRegressiva, diasAte, duplaDoSegundoTurno, governadoresNoSegundoTurno, presidenteNoSegundoTurno, resumoPrimeiroTurno,
} from '../../src/features/segundo-turno/resumo';

const DIR = join(__dirname, '..', '..', 'dados', 'publicado', 'oficial');
const temDados = existsSync(join(DIR, 'agora.json'));
const ler = (arq: string) => JSON.parse(readFileSync(join(DIR, arq), 'utf8'));

const cand = (n: string, partido: string): Candidato => ({ n, sq: `1${n}`, nome: `C${n}`, nomeUrna: `C${n}`, nomeCompleto: '', partido, situacao: 'apurando', situacaoTse: '', destino: 'valido' });
const base = (p: Partial<Resultado>): Resultado => ({ secoes: 10, totalizadas: 10, eleitorado: 1000, eleitoradoApurado: 1000, comparecimento: 800, abstencao: 200, brancos: 20, nulos: 30, validos: 750, anuladosSJ: 0, votos: {}, anulados: {}, situacao: 'concluida', situacoes: {}, ...p });

describe('dupla do 2º turno', () => {
  const cands = [cand('10', 'PL'), cand('20', 'PT'), cand('30', 'PSD')];
  it('vem da situação oficial, não dos percentuais', () => {
    // a situação do TSE manda, mesmo quando a ordem dos votos sugeriria outra dupla
    const r = base({ situacao: 'segundo-turno', votos: { '10': 400, '20': 200, '30': 150 }, situacoes: { '10': 'segundo-turno', '20': 'nao-eleito', '30': 'segundo-turno' } });
    expect(duplaDoSegundoTurno(r, cands)?.map((l) => l.c.n)).toEqual(['10', '30']);
  });
  it('sem 2º turno definido não há dupla', () => {
    expect(duplaDoSegundoTurno(base({ situacao: 'eleito', votos: { '10': 500 }, situacoes: { '10': 'eleito' } }), cands)).toBeNull();
    expect(duplaDoSegundoTurno(base({ situacao: 'apurando' }), cands)).toBeNull();
    expect(duplaDoSegundoTurno(base({ situacao: 'segundo-turno', situacoes: { '10': 'segundo-turno' } }), cands)).toBeNull();
    expect(duplaDoSegundoTurno(null, cands)).toBeNull();
  });
});

describe('contagem até o 2º turno', () => {
  it('conta dias no horário de Brasília', () => {
    expect(diasAte('2026-10-25', new Date('2026-10-09T12:00:00-03:00'))).toBe(16);
    // 23h de sábado em Brasília já é domingo em UTC: ainda falta 1 dia
    expect(diasAte('2026-10-25', new Date('2026-10-25T02:00:00Z'))).toBe(1);
    expect(diasAte('2026-10-25', new Date('2026-10-25T10:00:00-03:00'))).toBe(0);
    expect(diasAte('2026-10-25', new Date('2026-10-26T10:00:00-03:00'))).toBe(-1);
  });
  it('textos da contagem', () => {
    expect(contagemRegressiva(16)).toMatchObject({ grande: '16', rotulo: 'Faltam 16 dias para o 2º turno', encerrada: false });
    expect(contagemRegressiva(1).rotulo).toBe('O 2º turno é amanhã');
    expect(contagemRegressiva(0)).toMatchObject({ grande: 'Hoje', encerrada: false });
    expect(contagemRegressiva(-1).encerrada).toBe(true);
  });
});

describe.skipIf(!temDados)('resultado final oficial do 1º turno', () => {
  const agora: Agora = temDados ? validarAgora(ler('agora.json')) : (null as never);
  const cat: Catalogo = temDados ? ler('catalogo.json') : (null as never);

  it('presidente: Lula (esquerda) e Flávio Bolsonaro (direita), como no card nacional', () => {
    const p = presidenteNoSegundoTurno(agora, cat)!;
    expect(p.dupla.map((l) => l.c.nome)).toEqual(['Lula', 'Flávio Bolsonaro']);
    expect(p.ufs).toHaveLength(27);
    expect(p.ufs.filter((x) => x.venceu === 'esq')).toHaveLength(12);
    expect(p.ufs.filter((x) => x.venceu === 'dir')).toHaveLength(15);
    expect(p.exterior?.venceu).toBe('esq');
    // os votos das outras 10 candidaturas completam os válidos
    const br = agora.presidente.br;
    expect(p.outros.candidaturas).toBe(10);
    expect(p.outros.votos + p.dupla[0].votos + p.dupla[1].votos).toBe(br.validos);
  });

  it('governadores: 7 disputas no 2º turno, do maior eleitorado ao menor', () => {
    const g = governadoresNoSegundoTurno(agora, cat);
    expect(g.map((d) => d.uf)).toEqual(['RJ', 'AM', 'ES', 'RN', 'DF', 'TO', 'AC']);
    // dentro de cada disputa, o mais votado primeiro
    for (const d of g) expect(d.dupla[0].votos).toBeGreaterThanOrEqual(d.dupla[1].votos);
  });

  it('o que o 1º turno já definiu', () => {
    const r = resumoPrimeiroTurno(agora, cat);
    expect(r.presidenteEleito).toBeNull();
    expect(r.governadores).toEqual({ eleitos: 20, segundoTurno: 7, total: 27 });
    expect(r.senado).toEqual({ eleitos: 54, vagas: 54 });
  });
});
