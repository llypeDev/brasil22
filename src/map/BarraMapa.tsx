import { useEffect, useRef, useState } from 'react';
import { useEstado } from '../app/store';
import { useMapa, mapaApi } from './api';
import type { Camada } from '../app/hash';
import { UF_NOME, useGeoBrasil, useGeoMundo, candidatosDe } from '../app/dados';
import { partido, siglaExibicao } from '../data/partidos';
import { tituloLugar } from '../data/formato';
import { IconeBaixo, IconeMais, IconeMenos } from '../components/Icones';
import { alturaPico } from './cores';

export function Trilha() {
  const nav = useEstado((s) => s.nav);
  const navegar = useEstado((s) => s.navegar);
  const geo = useGeoBrasil().dados;
  const mundo = useGeoMundo(nav.zz).dados;
  const itens: { rotulo: string; acao?: () => void }[] = [{ rotulo: 'Brasil', acao: () => navegar({ uf: null, zz: false }) }];
  if (nav.zz) {
    itens.push({ rotulo: 'Exterior', acao: () => navegar({ pais: null, cidade: null }) });
    const pais = nav.pais ?? (nav.cidade ? mundo?.cidadePorTse.get(nav.cidade)?.pais : null);
    if (pais) itens.push({ rotulo: mundo?.porIso.get(pais)?.nome ?? pais, acao: () => navegar({ pais, cidade: null }) });
    if (nav.cidade) itens.push({ rotulo: tituloLugar(mundo?.cidadePorTse.get(nav.cidade)?.nome ?? nav.cidade) });
  } else if (nav.uf) {
    itens.push({ rotulo: UF_NOME[nav.uf], acao: () => navegar({ mun: null }) });
    if (nav.mun && geo) {
      const i = geo.porIbge.get(nav.mun) ?? -1;
      itens.push({ rotulo: i >= 0 ? geo.nome[i] : nav.mun, acao: nav.zona ? () => navegar({ zona: null }) : undefined });
      if (nav.zona) itens.push({ rotulo: `Zona ${nav.zona}` });
    }
  }
  if (itens.length === 1) return null;
  return (
    <nav className="trilha" aria-label="Onde você está">
      {itens.map((it, k) => (
        <span key={k} className="trilha-item">
          {k > 0 && <span className="sep" aria-hidden="true">›</span>}
          {it.acao && k < itens.length - 1 ? <button onClick={it.acao}>{it.rotulo}</button> : <span aria-current={k === itens.length - 1 ? 'location' : undefined}>{it.rotulo}</span>}
        </span>
      ))}
    </nav>
  );
}

function MenuCandidato() {
  const nav = useEstado((s) => s.nav);
  const navegar = useEstado((s) => s.navegar);
  const catalogo = useEstado((s) => s.catalogo);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cargo = nav.cargo === 'presidente' ? 'presidente' : nav.cargo === 'governadores' ? 'governador' : 'senador';
  const lista = candidatosDe(catalogo, cargo, nav.uf).filter((c) => c.destino !== 'anulado');
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAberto(false); } };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc, true); };
  }, [aberto]);
  const atual = lista.find((c) => c.n === nav.cand);
  return (
    <div className="menu-candidato" ref={ref}>
      <button aria-pressed={nav.camada === 'cand'} aria-haspopup="listbox" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        {atual ? atual.nome : 'Candidato'} <IconeBaixo width={12} height={12} />
      </button>
      {aberto && (
        <ul className="menu-lista" role="listbox" aria-label="Mapa de qual candidatura">
          {lista.map((c) => (
            <li key={c.n} role="option" aria-selected={c.n === nav.cand}>
              <button onClick={() => { navegar({ camada: 'cand', cand: c.n }); setAberto(false); }}>
                <i style={{ background: partido(c.partido).cor }} />{c.nome}<small>{siglaExibicao(c.partido)} {c.n}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Camadas() {
  const nav = useEstado((s) => s.nav);
  const navegar = useEstado((s) => s.navegar);
  if (nav.zz) return null;
  if (nav.cargo === 'deputados') return null;
  if (nav.cargo !== 'presidente' && !nav.uf) return null;
  const opcoes: [Camada, string][] = nav.uf ? [['mun', 'Cor'], ['votes', 'Vantagem'], ['apur', 'Apurado']] : [['mun', 'Municípios'], ['uf', 'Estados'], ['votes', 'Vantagem'], ['apur', 'Apurado']];
  return (
    <div className="camadas" role="group" aria-label="O mapa mostra">
      {opcoes.map(([c, r]) => (
        <button key={c} aria-pressed={nav.camada === c || (c === 'mun' && nav.camada === 'uf' && !!nav.uf)} onClick={() => navegar({ camada: c })}>{r}</button>
      ))}
      <MenuCandidato />
    </div>
  );
}

export function Legenda() {
  const leg = useMapa((s) => s.legenda);
  if (!leg) return null;
  return (
    <div className="legenda" aria-live="off">
      {leg.itens.map((it) => (
        <span key={it.rotulo} className="leg-item">
          {it.cor && <i style={{ background: it.cor }} />}{it.rotulo} {it.valor && <b className="tn">{it.valor}</b>}
        </span>
      ))}
      {leg.sufixo && <span className="leg-sufixo">{leg.sufixo}</span>}
      {leg.rampa && (
        <span className="leg-rampa" title={leg.rampa.titulo} aria-label={`${leg.rampa.titulo}: ${leg.rampa.texto}`}>
          <span className="rampa">{leg.rampa.cores.map((c, k) => <i key={k} style={{ background: c }} />)}</span>
          <em>{leg.rampa.texto}</em>
        </span>
      )}
      {leg.picos && (
        <span className="leg-picos" title="Altura de cada pico: a vantagem do líder no município">
          <svg width="150" height="30" aria-hidden="true">
            {[[1e4, 6], [1e5, 52], [5e5, 104]].map(([v, x]) => {
              const h = Math.min(28, alturaPico(v, 26));
              return <g key={v}><path d={`M${x - 3},29 L${x},${29 - h} L${x + 3},29 Z`} fill="var(--fg-4)" /><text x={x + 6} y="29" fontSize="10.5" fill="var(--fg-4)">{v >= 1e5 ? `${v / 1e3} mil` : '10 mil'}</text></g>;
            })}
          </svg>
          <em>votos de vantagem</em>
        </span>
      )}
      {leg.nota && <span className="leg-nota">{leg.nota}</span>}
    </div>
  );
}

export function BarraMapa() {
  const aviso = useMapa((s) => s.aviso);
  return (
    <div className="barra-mapa">
      <div className="barra-esq">
        <Trilha />
        <Camadas />
      </div>
      <Legenda />
      {aviso && <p className="aviso-mapa" role="status">{aviso}</p>}
    </div>
  );
}

export function ControlesZoom() {
  const podeAproximar = useMapa((s) => s.podeAproximar);
  const podeAfastar = useMapa((s) => s.podeAfastar);
  return (
    <div className="zoomctl" role="group" aria-label="Zoom do mapa">
      <button onClick={mapaApi.aproximar} disabled={!podeAproximar} aria-label="Aproximar o mapa" aria-keyshortcuts="+"><IconeMais /></button>
      <button onClick={mapaApi.afastar} disabled={!podeAfastar} aria-label="Afastar o mapa" aria-keyshortcuts="-"><IconeMenos /></button>
    </div>
  );
}
