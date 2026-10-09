// Modo TV: composição própria (1280×720 de base), resultado principal e mapa como foco,
// faixa inferior de eventos e roteiro automático de cenas. Sai pelo botão ou Esc,
// restaurando a navegação anterior.

import { useEffect, useState } from 'react';
import { useEstado } from '../store';
import { Mapa } from '../../map/Mapa';
import { Legenda } from '../../map/BarraMapa';
import { Marca, IndicadorVivo, ROTULO_CARGO } from '../../components/Cabecalho';
import { CARGOS } from '../hash';
import { CardNacional } from '../../features/presidente/CardNacional';
import { CardEvolucao } from '../../features/presidente/CardEvolucao';
import { CardGovernadores } from '../../features/governadores/CardGovernadores';
import { CardSenado } from '../../features/senado/CardSenado';
import { CardDeputados } from '../../features/deputados/CardDeputados';
import { CardUf } from '../../features/geografia/CardUf';
import { Faixa } from '../../features/tv/Faixa';
import { useRoteiro } from '../../features/tv/roteiro';
import { sairDaTv, reacenderSeTv } from '../../features/tv/controle';
import { IconeFechar, IconePausa, IconePlay } from '../../components/Icones';
import type { Layout } from '../layout';

export function Tv({ layout }: { layout: Layout }) {
  const nav = useEstado((s) => s.nav);
  const automatico = useEstado((s) => s.tvAutomatico);
  const set = useEstado((s) => s.set);
  const [ocioso, setOcioso] = useState(false);
  const cena = useRoteiro(automatico);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const mexeu = () => { setOcioso(false); clearTimeout(t); t = setTimeout(() => setOcioso(true), 3500); };
    mexeu();
    window.addEventListener('pointermove', mexeu);
    window.addEventListener('keydown', mexeu);
    document.addEventListener('visibilitychange', reacenderSeTv);
    return () => { clearTimeout(t); window.removeEventListener('pointermove', mexeu); window.removeEventListener('keydown', mexeu); document.removeEventListener('visibilitychange', reacenderSeTv); };
  }, []);
  const { g, escala, cw, ch } = layout;
  const esquerda = nav.uf ? <CardUf key={nav.uf} /> : nav.cargo === 'governadores' ? <CardGovernadores /> : nav.cargo === 'senado' ? <CardSenado /> : nav.cargo === 'deputados' ? <CardDeputados /> : <><CardNacional /><CardEvolucao altura={98} largura={344} /></>;
  return (
    <div className={`painel tv ${ocioso ? 'ocioso' : ''}`} style={{ top: 0, height: layout.h }}>
      <div className="area-mapa"><Mapa quadro={layout.quadroMapa} interativo={!automatico} escalaPicos={120 * escala} escalaRotulos={escala} /></div>
      <div className="hud" style={{ zoom: escala, width: cw, height: ch }}>
        <header className="topo tv-topo">
          <Marca compacta />
          <div className="abas-cargo tv-abas" aria-label="Cargo em exibição">
            {CARGOS.map((c) => <span key={c} aria-current={c === nav.cargo ? 'true' : undefined} className={c === nav.cargo ? 'ativo' : ''}>{ROTULO_CARGO[c]}</span>)}
          </div>
          <div className="topo-dir">
            <IndicadorVivo curto />
            <div className="tv-controles">
              <button className="btn" onClick={() => set({ tvAutomatico: !automatico })} aria-pressed={automatico} aria-label={automatico ? 'Pausar o roteiro automático' : 'Retomar o roteiro automático'}>
                {automatico ? <IconePausa /> : <IconePlay />}<span>{automatico ? 'Roteiro' : 'Pausado'}</span>
              </button>
              <button className="btn" onClick={sairDaTv} aria-label="Sair do modo TV" aria-keyshortcuts="Escape"><IconeFechar /><span>Sair</span></button>
            </div>
          </div>
        </header>
        <div className="tv-legenda" style={{ left: g.mapaX0, width: g.mapaX1 - g.mapaX0 }}><Legenda /></div>
        <aside className="col col-esq tv-col" style={{ top: g.colTopo }}>{esquerda}</aside>
        <div className="tv-faixa"><Faixa /></div>
        {cena && <p className="tv-cena sr" aria-live="polite">{cena}</p>}
      </div>
    </div>
  );
}
