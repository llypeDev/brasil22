// Faixas superiores: campanha (configurável) e faixa institucional. A altura é medida e
// descontada da área útil do painel.

import { MARCA, campanhaAtiva } from '../../app/marca';
import { useEstado } from '../../app/store';
import type { Variante } from '../../app/layout';

export function Faixas({ refRaiz, variante }: { refRaiz: (el: HTMLElement | null) => void; variante: Variante }) {
  const set = useEstado((s) => s.set);
  const c = campanhaAtiva();
  const curto = variante === 'celular' || variante === 'paisagem';
  const fi = MARCA.faixaInstitucional;
  return (
    <div className="faixas" ref={refRaiz}>
      {c && (
        c.destino
          ? <a className="faixa-campanha" href={c.destino} target="_blank" rel="noopener sponsored" style={{ background: c.cores.fundo, color: c.cores.texto }} aria-label={`${c.faixa.titulo}, ${c.faixa.texto}. ${c.faixa.acao}`}><Conteudo c={c} curto={curto} /></a>
          : <button className="faixa-campanha" onClick={() => set({ formulario: c.abre ?? 'anuncio' })} style={{ background: c.cores.fundo, color: c.cores.texto }} aria-label={`${c.faixa.titulo}, ${c.faixa.texto}. ${c.faixa.acao}`}><Conteudo c={c} curto={curto} /></button>
      )}
      {fi.ativa && (
        <button className="faixa-institucional" onClick={() => set({ formulario: fi.abre })}>
          {fi.texto} <b>{fi.acao} →</b>
        </button>
      )}
    </div>
  );
}

function Conteudo({ c, curto }: { c: NonNullable<ReturnType<typeof campanhaAtiva>>; curto: boolean }) {
  return (
    <>
      <b className="fc-marca">{c.faixa.titulo}</b>
      <span className="fc-texto" style={{ color: c.cores.destaque }}>{c.faixa.texto}</span>
      {!curto && <span className="fc-detalhe">· {c.faixa.detalhe}</span>}
      <span className="fc-acao" style={{ color: c.cores.destaque }}>{c.faixa.acao}</span>
      {c.demonstracao && <span className="sr">(campanha de demonstração)</span>}
    </>
  );
}
