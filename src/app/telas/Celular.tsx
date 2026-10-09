// Celular (vertical em fluxo), tablet (áreas dedicadas) e paisagem (mapa + card lateral).
// A ordem dos blocos muda com o contexto: no detalhe geográfico, o mapa e o card do lugar
// vêm antes do resumo nacional.

import { useEffect, useRef, useState } from 'react';
import { useEstado } from '../store';
import { Mapa } from '../../map/Mapa';
import { BarraMapa, ControlesZoom } from '../../map/BarraMapa';
import { AbasCargo, BotaoBusca, IndicadorVivo, Marca, compartilhar } from '../../components/Cabecalho';
import { LinhaDoTempo } from '../../features/linha-do-tempo/LinhaDoTempo';
import { CardAnuncio } from '../../features/comercial/CardAnuncio';
import { ColunaDireita, ColunaEsquerda } from './Colunas';
import { IconeCompartilhar, IconeGlobo, IconeOlho } from '../../components/Icones';
import { num } from '../../data/formato';
import type { Layout } from '../layout';
import { SeloModo } from '../SeloModo';

function CabecalhoCelular() {
  const zz = useEstado((s) => s.nav.zz);
  const navegar = useEstado((s) => s.navegar);
  const pessoas = useEstado((s) => s.pessoas);
  return (
    <header className="topo-celular">
      <div className="tc-linha">
        <Marca />
        <BotaoBusca compacto />
      </div>
      <div className="tc-linha">
        <IndicadorVivo curto />
        {pessoas != null && <span className="tc-pessoas" aria-label={`${pessoas} pessoas agora`}><IconeOlho width={14} height={14} /> <b className="tn">{num(pessoas)}</b></span>}
        <button className="btn exterior" aria-pressed={zz} onClick={() => navegar(zz ? { zz: false } : { cargo: 'presidente', zz: true })} aria-label="Ver os votos do exterior"><IconeGlobo />Exterior</button>
        <button className="icone grande" onClick={compartilhar} aria-label="Compartilhar esta vista"><IconeCompartilhar /></button>
      </div>
    </header>
  );
}

function MapaEmBloco({ altura, inferior = 0, barra = true }: { altura: number; inferior?: number; barra?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState({ x: 0, y: 0, w: 360, h: altura });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    // reserva uma faixa à direita para as chamadas dos estados pequenos
    const o = new ResizeObserver(() => { const r = el.getBoundingClientRect(); const chamadas = Math.min(78, r.width * 0.17); const topo = barra ? 46 : 8; setQ({ x: 6, y: topo, w: Math.max(100, r.width - 12 - chamadas), h: Math.max(100, r.height - topo - 8 - inferior) }); });
    o.observe(el);
    return () => o.disconnect();
  }, [inferior, barra]);
  return (
    <div className="mapa-bloco" ref={ref} style={{ height: altura }}>
      <Mapa quadro={q} escalaPicos={70} escalaRotulos={0.9} />
      {barra && <div className="mb-barra"><BarraMapa /></div>}
      {/* acima da linha do tempo sobreposta (paisagem), para não ficar coberto por ela */}
      <div className="mb-zoom" style={inferior ? { bottom: inferior + 4 } : undefined}><ControlesZoom /></div>
    </div>
  );
}

export function Celular({ layout, topo }: { layout: Layout; topo: number }) {
  const nav = useEstado((s) => s.nav);
  const detalhe = !!(nav.uf || nav.zz || nav.mun);
  if (layout.variante === 'paisagem') {
    return (
      <div className="painel paisagem" style={{ top: topo, height: layout.h }}>
        <div className="pa-mapa"><MapaEmBloco altura={layout.h - 12} inferior={58} barra={false} /><div className="pa-tempo"><LinhaDoTempo compacta /></div></div>
        <div className="pa-lado">
          <CabecalhoCelular />
          <AbasCargo rolagem />
          {detalhe ? <ColunaDireita /> : <ColunaEsquerda layout={layout} />}
          <SeloModo variante="paisagem" />
        </div>
      </div>
    );
  }
  const tablet = layout.variante === 'tablet';
  const alturaMapa = tablet ? Math.round(layout.h * 0.46) : Math.round(Math.min(layout.w * 0.98, layout.h * 0.62));
  const mapa = <MapaEmBloco key="mapa" altura={alturaMapa} />;
  const tempo = <div key="tempo" className="bloco-tempo"><LinhaDoTempo compacta /></div>;
  const resumo = <div key="resumo" className="bloco-cards"><ColunaEsquerda layout={layout} /></div>;
  const lugar = <div key="lugar" className="bloco-cards"><ColunaDireita /></div>;
  const anuncio = <div key="anuncio" className="bloco-anuncio"><CardAnuncio /></div>;
  const ordem = detalhe ? [mapa, tempo, lugar, resumo, anuncio] : [resumo, mapa, tempo, anuncio, lugar];
  return (
    <div className={`painel fluxo ${tablet ? 'tablet' : ''}`}>
      <CabecalhoCelular />
      <AbasCargo rolagem />
      {tablet ? (
        <>
          {mapa}{tempo}
          <div className="tablet-colunas">{detalhe ? <>{lugar}{resumo}</> : <>{resumo}{lugar}</>}</div>
          {anuncio}
        </>
      ) : ordem}
      <SeloModo variante={layout.variante} />
    </div>
  );
}
