import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error módulo do servidor sem tipos
import { criarSimulacao } from '../../server/simulacao.mjs';

const RAIZ = join(__dirname, '..', '..');
const DIR = join(RAIZ, 'dados', 'publicado', 'oficial');
const temDados = existsSync(join(DIR, 'manifesto.json'));
type Sim = { arquivo: (rel: string, t: number) => any; limites: { abertura: number; fim: number } };
let sim: Sim;
let final: any;

describe.skipIf(!temDados)('provider de simulação', () => {
  beforeAll(async () => {
    sim = await criarSimulacao({ diretorio: DIR, geoMundo: JSON.parse(readFileSync(join(RAIZ, 'public', 'geo', 'mundo-v1.json'), 'utf8')), tFixo: '1300' });
    final = JSON.parse(readFileSync(join(DIR, 'agora.json'), 'utf8'));
  }, 60_000);

  it('o instante final coincide com o arquivo oficial', () => {
    const a = sim.arquivo('agora.json', sim.limites.fim);
    for (const [n, v] of Object.entries(final.presidente.br.votos)) expect(a.presidente.br.votos[n]).toBe(v);
    expect(a.presidente.br.totalizadas).toBe(final.presidente.br.totalizadas);
    expect(a.presidente.br.situacao).toBe(final.presidente.br.situacao);
    for (const uf of ['MG', 'RJ', 'SP']) {
      expect(a.governador.uf[uf].votos).toEqual(final.governador.uf[uf].votos);
      expect(a.senador.uf[uf].situacao).toBe(final.senador.uf[uf].situacao);
    }
  });

  it('seções nunca regridem e Brasil = UFs + exterior em qualquer instante', () => {
    let anterior = -1;
    for (let t = sim.limites.abertura; t <= sim.limites.fim; t += 37) {
      const a = sim.arquivo('agora.json', t);
      const br = a.presidente.br;
      expect(br.totalizadas).toBeGreaterThanOrEqual(anterior);
      anterior = br.totalizadas;
      let soma = 0, somaVal = 0;
      for (const [uf, r] of Object.entries<any>(a.presidente.uf)) if (uf !== 'ZZ') { soma += r.totalizadas; somaVal += r.validos; }
      expect(soma + a.presidente.zz.totalizadas).toBe(br.totalizadas);
      expect(somaVal + a.presidente.zz.validos).toBe(br.validos);
      expect(br.totalizadas).toBeLessThanOrEqual(br.secoes);
    }
  });

  it('não declara eleito antes do que o resultado oficial confirma', () => {
    for (let t = sim.limites.abertura; t <= sim.limites.fim; t += 53) {
      const a = sim.arquivo('agora.json', t);
      for (const [uf, r] of Object.entries<any>(a.governador.uf)) {
        if (r.situacao === 'eleito' || r.situacao === 'segundo-turno') expect(r.situacao).toBe(final.governador.uf[uf].situacao);
      }
    }
  });

  it('municípios do instante somam o agregado das UFs', () => {
    const t = 1150;
    const m = sim.arquivo('municipios-presidente.json', t);
    const a = sim.arquivo('agora.json', t);
    const i13 = m.candidatos.indexOf('13');
    const total13 = m.votos[i13].reduce((s: number, v: number | null) => s + (v ?? 0), 0);
    let uf13 = 0;
    for (const [uf, r] of Object.entries<any>(a.presidente.uf)) if (uf !== 'ZZ') uf13 += r.votos['13'] ?? 0;
    expect(total13).toBe(uf13);
  });

  it('deputados: situação só ao fim da totalização da UF', () => {
    const d = sim.arquivo('deputados/mg.json', 1100);
    expect(d.federal.eleitos).toBe(0);
    expect(d.federal.candidatos.every((c: any[]) => c[4] === 'apurando' || c[4] === 'aguardando')).toBe(true);
    const f = sim.arquivo('deputados/mg.json', sim.limites.fim);
    expect(f.federal.eleitos).toBe(53);
  });
});
