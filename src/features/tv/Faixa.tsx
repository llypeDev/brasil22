// Faixa inferior do modo TV: "Últimas" + eventos em rolagem contínua.

import { useEstado } from '../../app/store';
import { useEventos } from '../../app/dados';
import { horaDe, num, pctS } from '../../data/formato';
import { partido } from '../../data/partidos';
import { textoEvento } from '../atualizacoes/CardAtualizacoes';

export function Faixa() {
  const cat = useEstado((s) => s.catalogo);
  const eventos = (useEventos().dados?.eventos ?? []).slice(0, 14);
  const itens = eventos.map((e) => {
    if (e.tipo === 'secoes') {
      const vs = Object.entries(e.votos ?? {}).map(([n, v]) => ({ c: cat?.presidente.find((x) => x.n === n), v }));
      return (
        <span key={e.id} className="fx-item"><time className="tn">{horaDe(e.t)}</time><b>+{num(e.secoes ?? 0)} {(e.secoes ?? 0) === 1 ? 'seção' : 'seções'}</b>
          {vs.map((x) => x.c && <span key={x.c.n}> · {x.c.nome} <b style={{ color: partido(x.c.partido).texto }}>{e.validos ? pctS(x.v / e.validos, 1) : ''}</b></span>)}
        </span>
      );
    }
    const t = textoEvento(cat, e);
    return <span key={e.id} className="fx-item"><time className="tn">{horaDe(e.t)}</time>{t.lugar && <b>{t.lugar}: </b>}{t.texto}</span>;
  });
  return (
    <div className="faixa-tv" aria-label="Últimas atualizações">
      <span className="fx-rotulo">Últimas</span>
      <div className="fx-janela"><div className="fx-trilho" style={{ animationDuration: `${Math.max(30, itens.length * 9)}s` }}>{itens}{itens}</div></div>
    </div>
  );
}
