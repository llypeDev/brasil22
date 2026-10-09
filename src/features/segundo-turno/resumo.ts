// Página do 2º turno: o que o resultado final do 1º turno deixou definido. Finalistas e eleitos
// vêm da situação oficial do TSE (nunca de percentuais arredondados); a dupla de presidente
// segue a ordem do card nacional e as de governador, a ordem dos votos.

import { candidatosDe, UF_POR_ELEITORADO } from '../../app/dados';
import { linhas, type Linha } from '../../data/calculos';
import type { Agora, Candidato, Catalogo, Resultado } from '../../data/contratos';
import { ordenarDupla } from '../presidente/CardNacional';

export type Dupla = [Linha, Linha];

/** As duas candidaturas que vão ao 2º turno, ou null se a disputa não tem 2º turno. */
export function duplaDoSegundoTurno(r: Resultado | null | undefined, cands: Candidato[] | undefined): Dupla | null {
  if (r?.situacao !== 'segundo-turno') return null;
  const ls = linhas(r, cands).filter((l) => !l.anulado && l.situacao === 'segundo-turno');
  return ls.length === 2 ? [ls[0], ls[1]] : null;
}

export interface Placar {
  /** UF, ou "ZZ" para o exterior */
  uf: string;
  esq: Linha;
  dir: Linha;
  venceu: 'esq' | 'dir' | null;
}

function placar(uf: string, r: Resultado | undefined, cands: Candidato[], dupla: Dupla): Placar | null {
  const ls = linhas(r, cands);
  const esq = ls.find((l) => l.c.n === dupla[0].c.n), dir = ls.find((l) => l.c.n === dupla[1].c.n);
  if (!esq || !dir || esq.votos + dir.votos === 0) return null;
  return { uf, esq, dir, venceu: esq.votos > dir.votos ? 'esq' : dir.votos > esq.votos ? 'dir' : null };
}

export interface SegundoTurnoPresidente {
  /** esquerda e direita na mesma ordem do card nacional */
  dupla: Dupla;
  /** votos válidos das demais candidaturas no 1º turno */
  outros: { votos: number; parcela: number | null; candidaturas: number };
  ufs: Placar[];
  exterior: Placar | null;
}

export function presidenteNoSegundoTurno(agora: Agora, cat: Catalogo): SegundoTurnoPresidente | null {
  const r = agora.presidente.br;
  const d = duplaDoSegundoTurno(r, cat.presidente);
  if (!d) return null;
  const [esq, dir] = ordenarDupla(d[0], d[1]);
  const dupla: Dupla = [esq, dir!];
  const demais = linhas(r, cat.presidente).filter((l) => !l.anulado && l.c.n !== esq.c.n && l.c.n !== dir!.c.n);
  const votos = demais.reduce((s, l) => s + l.votos, 0);
  return {
    dupla,
    outros: { votos, parcela: r.validos ? votos / r.validos : null, candidaturas: demais.length },
    ufs: UF_POR_ELEITORADO.flatMap((uf) => placar(uf, agora.presidente.uf[uf], cat.presidente, dupla) ?? []),
    exterior: placar('ZZ', agora.presidente.zz, cat.presidente, dupla),
  };
}

export interface DisputaGovernador { uf: string; dupla: Dupla }

/** Estados em que o governo será decidido no 2º turno, do maior eleitorado ao menor. */
export function governadoresNoSegundoTurno(agora: Agora, cat: Catalogo): DisputaGovernador[] {
  return UF_POR_ELEITORADO.flatMap((uf) => {
    const dupla = duplaDoSegundoTurno(agora.governador.uf[uf], candidatosDe(cat, 'governador', uf));
    return dupla ? [{ uf, dupla }] : [];
  });
}

export interface ResumoPrimeiroTurno {
  presidente: Resultado;
  /** eleito no 1º turno, quando não há 2º turno */
  presidenteEleito: Linha | null;
  governadores: { eleitos: number; segundoTurno: number; total: number };
  senado: { eleitos: number; vagas: number };
}

export function resumoPrimeiroTurno(agora: Agora, cat: Catalogo): ResumoPrimeiroTurno {
  const gov = Object.values(agora.governador.uf);
  const sen = Object.values(agora.senador.uf);
  const r = agora.presidente.br;
  return {
    presidente: r,
    presidenteEleito: r.situacao === 'eleito' ? linhas(r, cat.presidente).find((l) => l.situacao === 'eleito') ?? null : null,
    governadores: { eleitos: gov.filter((x) => x.situacao === 'eleito').length, segundoTurno: gov.filter((x) => x.situacao === 'segundo-turno').length, total: gov.length },
    senado: {
      eleitos: sen.reduce((s, x) => s + Object.values(x.situacoes ?? {}).filter((v) => v === 'eleito').length, 0),
      vagas: sen.reduce((s, x) => s + (x.vagas ?? 0), 0),
    },
  };
}

/** Dias inteiros de hoje (horário de Brasília) até a data `aaaa-mm-dd`; negativo se já passou. */
export function diasAte(data: string, agora = new Date()): number {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  return Math.round((Date.parse(`${data}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
}

export interface Contagem { grande: string; texto: string; rotulo: string; encerrada: boolean }

/** `texto` tem duas linhas fixas, para caber no losango em qualquer largura. */
export function contagemRegressiva(dias: number): Contagem {
  if (dias > 1) return { grande: String(dias), texto: 'dias para o\n2º turno', rotulo: `Faltam ${dias} dias para o 2º turno`, encerrada: false };
  if (dias === 1) return { grande: '1', texto: 'dia para o\n2º turno', rotulo: 'O 2º turno é amanhã', encerrada: false };
  if (dias === 0) return { grande: 'Hoje', texto: 'é dia de\n2º turno', rotulo: 'O 2º turno é hoje', encerrada: false };
  return { grande: '', texto: '', rotulo: 'Votação do 2º turno encerrada', encerrada: true };
}
