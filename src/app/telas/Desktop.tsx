import { Mapa } from '../../map/Mapa';
import { BarraMapa, ControlesZoom } from '../../map/BarraMapa';
import { Cabecalho } from '../../components/Cabecalho';
import { LinhaDoTempo } from '../../features/linha-do-tempo/LinhaDoTempo';
import { CardAnuncio } from '../../features/comercial/CardAnuncio';
import { ColunaDireita, ColunaEsquerda } from './Colunas';
import type { Layout } from '../layout';

export function Desktop({ layout, topo }: { layout: Layout; topo: number }) {
  const { g, escala, cw, ch } = layout;
  const larguraMapa = g.mapaX1 - g.mapaX0;
  return (
    <div className="painel" style={{ top: topo, height: layout.h }}>
      <div className="area-mapa">
        <Mapa quadro={layout.quadroMapa} escalaPicos={92 * escala} escalaRotulos={escala} />
      </div>
      <div className="hud" style={{ zoom: escala, width: cw, height: ch }}>
        <Cabecalho />
        <div className="pos-barra-mapa" style={{ left: g.mapaX0, width: larguraMapa, top: g.colTopo }}><BarraMapa /></div>
        <aside className="col col-esq" style={{ top: g.colTopo }} aria-label="Resumo do cargo"><ColunaEsquerda layout={layout} /></aside>
        <aside className="col col-dir" style={{ top: g.colTopo }} aria-label="Detalhes do lugar e atualizações"><ColunaDireita /></aside>
        <div className="pos-zoom" style={{ left: g.mapaX0, top: g.mapaY1 - 64 }}><ControlesZoom /></div>
        <div className="pos-anuncio" style={{ left: g.mapaX1 - 276, top: g.mapaY1 - 92 }}><CardAnuncio /></div>
        <div className="pos-tempo" style={{ left: g.mapaX0, width: larguraMapa }}><LinhaDoTempo /></div>
      </div>
    </div>
  );
}
