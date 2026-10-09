// Governadores: resumo das 27 disputas, grade de UFs e disputas mais apertadas.
// Situação (eleito / 2º turno) vem do provedor. "Apertada" = menor diferença entre as duas
// candidaturas pertinentes (1º e 2º colocados), função testável em calculos.ts.

import { useMemo } from 'react';
import { useEstado } from '../../app/store';
import { candidatosDe, UF_NOME, UF_POR_ELEITORADO } from '../../app/dados';
import { useAgora } from '../../data/useFeed';
import { linhas, margemEntre, type Linha } from '../../data/calculos';
import { partido } from '../../data/partidos';
import { pctS } from '../../data/formato';
import { corDisputa } from '../../map/cores';
import { GradeUfs, Paginador, usePaginas } from '../../components/Composicao';
import { Retrato } from '../../components/Retrato';
import type { Agora, Catalogo } from '../../data/contratos';

export interface Disputa { uf: string; situacao: string; a: Linha; b: Linha | null; pontos: number | null }

export function disputasGovernador(agora: Agora | null, cat: Catalogo | null): Disputa[] {
  if (!agora || !cat) return [];
  return UF_POR_ELEITORADO.map((uf) => {
    const r = agora.governador.uf[uf];
    const ls = linhas(r, candidatosDe(cat, 'governador', uf)).filter((l) => !l.anulado);
    const m = margemEntre(ls, 0);
    return { uf, situacao: r?.situacao ?? 'aguardando', a: ls[0], b: ls[1] ?? null, pontos: m?.pontos ?? null };
  }).filter((d) => d.a && d.a.votos > 0);
}

export function CardGovernadores() {
  const { agora } = useAgora();
  const cat = useEstado((s) => s.catalogo);
  const navegar = useEstado((s) => s.navegar);
  const uf = useEstado((s) => s.nav.uf);
  const disputas = useMemo(() => disputasGovernador(agora, cat), [agora, cat]);
  const eleitos = disputas.filter((d) => d.situacao === 'eleito').length;
  const segundo = disputas.filter((d) => d.situacao === 'segundo-turno').length;
  const apertadas = useMemo(() => [...disputas].sort((x, y) => (x.pontos ?? 9) - (y.pontos ?? 9)), [disputas]);
  const pag = usePaginas(apertadas, 7);
  const chips = UF_POR_ELEITORADO.map((u) => {
    const d = disputas.find((x) => x.uf === u);
    if (!d) return { uf: u, cores: [], aria: `${UF_NOME[u]}, aguardando` };
    const cores = d.situacao === 'segundo-turno' && d.b ? [corDisputa(d.a.c.partido, true), corDisputa(d.b.c.partido, true)] : [corDisputa(d.a.c.partido, d.situacao === 'eleito')];
    return { uf: u, cores, aria: `${UF_NOME[u]}: ${d.situacao === 'eleito' ? `${d.a.c.nome} eleito(a)` : d.situacao === 'segundo-turno' ? `2º turno entre ${d.a.c.nome} e ${d.b?.c.nome}` : `${d.a.c.nome} à frente`}` };
  });
  const total = Object.keys(agora?.governador.uf ?? {}).length || 27;
  return (
    <section className="card governadores grow entrada" aria-labelledby="titulo-gov">
      <div className="hd"><h3 id="titulo-gov">Governadores</h3><span className="aside">{total} disputas</span></div>
      <p className="resumo-grande"><b className="tn">{eleitos}</b> {eleitos === 1 ? 'eleito' : 'eleitos'} <span className="sep" /> <b className="tn">{segundo}</b> no 2º turno</p>
      <GradeUfs chips={chips} aoEscolher={(u) => navegar({ uf: u })} selecionada={uf} />
      <div className="sub-hd">
        <h4>Disputas, das mais apertadas</h4>
        <Paginador {...pag} rotulo="Disputas" />
      </div>
      <ul className="lista-disputas">
        {pag.itens.map((d) => (
          <li key={d.uf}>
            <button onClick={() => navegar({ uf: d.uf })} aria-label={`${UF_NOME[d.uf]}: ${d.a.c.nome} ${pctS(d.a.parcela, 2)}${d.b ? `, ${d.b.c.nome} ${pctS(d.b.parcela, 2)}` : ''}, ${d.situacao === 'eleito' ? 'eleito' : d.situacao === 'segundo-turno' ? '2º turno' : 'apurando'}`}>
              <span className="disp-uf"><span className="chip-uf mini" style={{ background: corDisputa(d.a.c.partido, d.situacao !== 'apurando') }}>{d.uf}</span><small>{d.situacao === 'eleito' ? 'eleito' : d.situacao === 'segundo-turno' ? '2º turno' : 'apurando'}</small></span>
              <span className="disp-cands">
                {[d.a, d.b].filter(Boolean).map((l, k) => (
                  <span key={l!.c.n} className={`disp-linha ${k === 1 && d.situacao === 'eleito' ? 'apagado' : ''}`}>
                    <Retrato nome={l!.c.nome} sigla={l!.c.partido} sq={l!.c.sq} cargo="governador" uf={d.uf} tamanho={24} />
                    <span className="nome">{l!.c.nome}</span>
                    <b className="tn" style={{ color: partido(l!.c.partido).texto }}>{pctS(l!.parcela, d.pontos != null && d.pontos < 0.02 ? 2 : 1)}</b>
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
