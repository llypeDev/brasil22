// Card publicitário rotativo: campanha ativa + "Anuncie aqui". Só o slide ativo recebe foco
// e clique. Pausa com o ponteiro/foco e não gira com movimento reduzido.

import { useEffect, useRef, useState } from 'react';
import { useEstado } from '../../app/store';
import { MARCA, campanhaAtiva } from '../../app/marca';
import { num } from '../../data/formato';
import { IconeSeta } from '../../components/Icones';

export function CardAnuncio() {
  const c = campanhaAtiva();
  const pessoas = useEstado((s) => s.pessoas);
  const set = useEstado((s) => s.set);
  const slides = c ? 2 : 1;
  const [k, setK] = useState(0);
  const pausado = useRef(false);
  useEffect(() => {
    if (slides < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => { if (!pausado.current) setK((x) => (x + 1) % slides); }, 8000);
    return () => clearInterval(id);
  }, [slides]);
  const pausar = (v: boolean) => () => { pausado.current = v; };
  return (
    <aside className="card-anuncio" aria-label="Anúncios" onMouseEnter={pausar(true)} onMouseLeave={pausar(false)} onFocus={pausar(true)} onBlur={pausar(false)}>
      <div className="an-hd">
        <span>Anúncio{c?.demonstracao ? ' · demonstração' : ''}</span>
        {slides > 1 && (
          <span className="an-pontos">
            {Array.from({ length: slides }, (_, i) => <button key={i} aria-label={`Anúncio ${i + 1} de ${slides}`} aria-pressed={i === k} onClick={() => setK(i)} />)}
          </span>
        )}
      </div>
      <div className="an-slides">
        {c && (
          <div className={`an-slide ${k === 0 ? 'ativo' : ''}`} aria-hidden={k !== 0} style={{ '--an-destaque': c.cores.destaque } as React.CSSProperties}>
            {c.destino
              ? <a href={c.destino} target="_blank" rel="noopener sponsored" tabIndex={k === 0 ? 0 : -1}><b className="an-marca">{c.card.titulo}</b><span className="an-acao">{c.card.acao} <IconeSeta width={13} height={13} /></span><small>{c.card.detalhe}</small></a>
              : <button tabIndex={k === 0 ? 0 : -1} onClick={() => set({ formulario: c.abre ?? 'anuncio' })}><b className="an-marca">{c.card.titulo}</b><span className="an-acao">{c.card.acao} <IconeSeta width={13} height={13} /></span><small>{c.card.detalhe}</small></button>}
          </div>
        )}
        <div className={`an-slide ${k === slides - 1 ? 'ativo' : ''}`} aria-hidden={k !== slides - 1}>
          <button tabIndex={k === slides - 1 ? 0 : -1} onClick={() => set({ formulario: 'anuncio' })} aria-label={`${MARCA.anuncieAqui.titulo}: fale com a gente`}>
            <b className="an-marca serif">{MARCA.anuncieAqui.titulo}</b>
            <span className="an-acao">Fale com a gente <IconeSeta width={13} height={13} /></span>
            <small>{pessoas != null ? `${num(pessoas)} ${pessoas === 1 ? 'pessoa acompanha' : 'pessoas acompanham'} agora` : 'Painel independente da apuração'}</small>
          </button>
        </div>
      </div>
    </aside>
  );
}
