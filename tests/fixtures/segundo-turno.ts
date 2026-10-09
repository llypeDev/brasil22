// Dados artificiais de teste. Nunca publicados no feed oficial.
import type { Agora, Catalogo, PainelSegundoTurno, Resultado } from '../../src/data/contratos';

export const UFS_TESTE = 'AC AL AP AM BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
export const GOVERNOS_TESTE = ['RJ', 'AM', 'ES', 'RN', 'DF', 'TO', 'AC'];
export const configSegundoTurno = (publicado = true) => ({ f: 'o', pl: [{ c: 'ele2026', cd: '3220', e: [
  { cd: '6257', cdt2: '6258', t: '1', abr: [{ cd: 'br', cp: [{ cd: '1' }] }] },
  ...(publicado ? [{ cd: '6258', t: '2', abr: [{ cd: 'br', cp: [{ cd: '1' }] }] }, { cd: '6260', t: '2', abr: [{ cd: 'br', cp: [{ cd: '3' }] }] }] : []),
] }] });

export function brutoSegundoTurno({ cargo = 1, uf = 'br', final = false }: { cargo?: number; uf?: string; final?: boolean } = {}) {
  return { f: 'o', t: '2', ele: cargo === 1 ? '6258' : '6260', cdabr: uf, tpabr: 'uf', dg: '25/10/2026', hg: final ? '20:00:00' : '18:00:00', dt: '25/10/2026', ht: final ? '20:00:00' : '18:00:00', idg: final ? '2' : '1', dv: 's', and: final ? 'f' : 'p',
    s: { ts: '100', st: final ? '100' : '50' }, e: { te: '1000', est: final ? '1000' : '500', c: '400', a: '100' }, v: { vv: '350', vb: '20', tvn: '20', vansj: '10' },
    carg: [{ cd: String(cargo), nv: '1', agr: [{ n: '1', par: [
      { n: '13', sg: 'PT', cand: [{ n: '13', sqcand: '280001111111', nmu: cargo === 1 ? 'LULA' : 'CANDIDATO A', nm: 'Nome A', dvt: 'Válido', st: final ? 'Eleito' : '', vap: '200' }] },
      { n: '22', sg: 'PL', cand: [{ n: '22', sqcand: '280002222222', nmu: cargo === 1 ? 'FLAVIO BOLSONARO' : 'CANDIDATO B', nm: 'Nome B', dvt: 'Válido', st: final ? 'Não eleito' : '', vap: '150' }] },
      { n: '99', sg: 'TESTE', cand: [{ n: '99', nmu: 'ANULADO', dvt: 'Anulado sub judice', st: '', vap: '10' }] },
    ] }] }] };
}

export function resultadoSegundoTurno(final = false): Resultado {
  return { secoes: 100, totalizadas: final ? 100 : 50, eleitorado: 1000, eleitoradoApurado: 500, comparecimento: 400, abstencao: 100, brancos: 20, nulos: 20, validos: 350, anuladosSJ: 10, votos: { '13': 200, '22': 150 }, anulados: {}, situacao: final ? 'eleito' : 'apurando', situacoes: final ? { '13': 'eleito', '22': 'nao-eleito' } : {}, geradoEm: final ? '2026-10-25T20:00:00-03:00' : '2026-10-25T18:00:00-03:00' };
}

export function painelSegundoTurno(final = false): PainelSegundoTurno {
  const presidente: Catalogo['presidente'] = [
    { n: '13', sq: '280001111111', nome: 'Lula', nomeUrna: 'LULA', nomeCompleto: 'Nome A', partido: 'PT', situacao: final ? 'eleito' : 'apurando', situacaoTse: final ? 'Eleito' : '', destino: 'valido' },
    { n: '22', sq: '280002222222', nome: 'Flávio Bolsonaro', nomeUrna: 'FLAVIO BOLSONARO', nomeCompleto: 'Nome B', partido: 'PL', situacao: final ? 'nao-eleito' : 'apurando', situacaoTse: final ? 'Não eleito' : '', destino: 'valido' },
  ];
  const catalogo: Catalogo = { versao: 1, presidente, governador: Object.fromEntries(GOVERNOS_TESTE.map((u) => [u, presidente.map((c) => ({ ...c, nome: `Candidato ${c.n}` }))])), senador: {}, partidos: {} };
  const agora: Agora = { versao: 1, turno: 2, seq: final ? 200 : 100, t: final ? 1200 : 1080, geradoNaFonte: resultadoSegundoTurno(final).geradoEm!, presidente: { br: resultadoSegundoTurno(final), uf: Object.fromEntries(UFS_TESTE.map((u) => [u, resultadoSegundoTurno(final)])), zz: resultadoSegundoTurno(final), regioes: {} }, governador: { uf: Object.fromEntries(GOVERNOS_TESTE.map((u) => [u, resultadoSegundoTurno(final)])) }, senador: { uf: {} } };
  return { versao: 1, aguardando: false, catalogo, agora, manifesto: { versao: 1, modo: 'oficial', origem: 'Amostra artificial de teste', eleicao: { ano: 2026, turno: 2, data: '2026-10-25', segundoTurno: '2026-10-25', eleicoes: { presidente: '6258', estaduais: '6260' } }, seq: agora.seq, t: agora.t, recarregarSegundos: 15, municipiosComZonas: [] } };
}
