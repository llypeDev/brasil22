// Roteiro automático do modo TV: cenas com duração própria; uma definição nova interrompe o
// roteiro e mostra a UF correspondente. O mesmo modelo de eventos alimenta "Últimas
// atualizações" e a faixa inferior.

import { useEffect, useRef, useState } from 'react';
import { useEstado } from '../../app/store';
import { useEventos } from '../../app/dados';
import type { EstadoUrl } from '../../app/hash';

interface Cena { id: string; rotulo: string; nav: Partial<EstadoUrl>; dur: number }

export const CENAS: Cena[] = [
  { id: 'pres-vantagem', rotulo: 'Presidente: vantagem em votos por município', nav: { cargo: 'presidente', uf: null, zz: false, mun: null, camada: 'votes' }, dur: 22 },
  { id: 'pres-municipios', rotulo: 'Presidente: quem lidera em cada município', nav: { cargo: 'presidente', uf: null, zz: false, camada: 'mun' }, dur: 16 },
  { id: 'governadores', rotulo: 'Governadores nas 27 disputas', nav: { cargo: 'governadores', uf: null, zz: false, camada: 'mun' }, dur: 16 },
  { id: 'senado', rotulo: 'Senado: duas vagas por estado', nav: { cargo: 'senado', uf: null, zz: false, camada: 'mun' }, dur: 16 },
  { id: 'deputados', rotulo: 'Câmara dos Deputados', nav: { cargo: 'deputados', uf: null, zz: false, camada: 'mun' }, dur: 12 },
  { id: 'pres-sp', rotulo: 'Presidente em São Paulo', nav: { cargo: 'presidente', uf: 'SP', zz: false, mun: null, camada: 'mun' }, dur: 12 },
  { id: 'pres-mg', rotulo: 'Presidente em Minas Gerais', nav: { cargo: 'presidente', uf: 'MG', zz: false, mun: null, camada: 'mun' }, dur: 12 },
  { id: 'pres-ba', rotulo: 'Presidente na Bahia', nav: { cargo: 'presidente', uf: 'BA', zz: false, mun: null, camada: 'mun' }, dur: 12 },
  { id: 'exterior', rotulo: 'Votos no exterior', nav: { cargo: 'presidente', uf: null, zz: true, camada: 'mun' }, dur: 12 },
];

export function useRoteiro(automatico: boolean) {
  const [k, setK] = useState(0);
  const [interrupcao, setInterrupcao] = useState<Cena | null>(null);
  const eventos = useEventos().dados?.eventos;
  const ultimoVisto = useRef<string | null>(null);

  // definição nova → cena da UF
  useEffect(() => {
    if (!eventos?.length) return;
    const def = eventos.find((e) => e.tipo === 'definicao');
    if (!def) return;
    if (ultimoVisto.current == null) { ultimoVisto.current = def.id; return; }
    if (def.id === ultimoVisto.current || !automatico) return;
    ultimoVisto.current = def.id;
    const cargo = def.cargo === 'governador' ? 'governadores' : def.cargo === 'senador' ? 'senado' : 'presidente';
    setInterrupcao({ id: `def-${def.id}`, rotulo: `Definição: ${def.uf}`, nav: def.uf === 'BR' ? { cargo, uf: null, zz: false } : { cargo, uf: def.uf, zz: false, mun: null, camada: 'mun' }, dur: 14 });
  }, [eventos, automatico]);

  const cena = interrupcao ?? CENAS[k % CENAS.length];
  useEffect(() => {
    if (!automatico) return;
    useEstado.getState().navegar({ ...cena.nav, tv: true, t: null });
    const id = setTimeout(() => {
      if (interrupcao) setInterrupcao(null);
      else setK((x) => x + 1);
    }, cena.dur * 1000);
    return () => clearTimeout(id);
  }, [automatico, cena]);
  return automatico ? cena.rotulo : null;
}
