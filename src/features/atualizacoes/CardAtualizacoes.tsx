// "Últimas atualizações": eventos com identidade estável (id), em ordem decrescente.
// Definições abrem a vista correspondente.

import { memo, useMemo } from 'react';
import { useEstado } from '../../app/store';
import { useEventos, candidatosDe, UF_NOME } from '../../app/dados';
import { horaDe, num, pctS } from '../../data/formato';
import { partido } from '../../data/partidos';
import { Retrato } from '../../components/Retrato';
import type { Catalogo, Evento } from '../../data/contratos';

function nomes(cat: Catalogo | null, ev: Evento) {
  const lista = ev.cargo === 'presidente' ? cat?.presidente ?? [] : candidatosDe(cat, ev.cargo, ev.uf);
  return (ev.candidatos ?? []).map((n) => lista.find((c) => c.n === n)).filter(Boolean) as NonNullable<ReturnType<typeof lista.find>>[];
}

export function textoEvento(cat: Catalogo | null, ev: Evento): { lugar: string; texto: string; cands: ReturnType<typeof nomes> } {
  const lugar = ev.uf === 'BR' ? '' : UF_NOME[ev.uf] ?? ev.uf;
  const cs = nomes(cat, ev);
  const lista = cs.map((c) => c.nome);
  const e = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);
  if (ev.tipo === 'definicao') {
    if (ev.cargo === 'senador') return { lugar, texto: ev.situacao === 'parcial' ? `${e(lista)} garante uma das vagas no Senado.` : `${e(lista)} ${lista.length > 1 ? 'são eleitos' : 'é eleito(a)'} para o Senado.`, cands: cs };
    if (ev.situacao === 'segundo-turno') return { lugar, texto: `${e(lista)} vão ao 2º turno${ev.cargo === 'governador' ? ' para governador' : ''}.`, cands: cs };
    return { lugar, texto: `${e(lista)} vence no 1º turno${ev.cargo === 'governador' ? ' para governador' : ''}.`, cands: cs };
  }
  if (ev.tipo === 'virada') return { lugar, texto: `Virada: ${e(lista.slice(0, 1))} passa à frente de ${lista[1] ?? '—'}${ev.cargo === 'governador' ? ' para governador' : ''}.`, cands: cs };
  if (ev.tipo === 'fim') return { lugar, texto: 'Apuração concluída: 100% das seções totalizadas.', cands: cs };
  return { lugar, texto: '', cands: cs };
}

const Item = memo(function Item({ ev, cat }: { ev: Evento; cat: Catalogo | null }) {
  const navegar = useEstado((s) => s.navegar);
  if (ev.tipo === 'secoes') {
    const f = ev.totalSecoes ? (ev.totalizadas ?? 0) / ev.totalSecoes : 0;
    const vs = Object.entries(ev.votos ?? {}).map(([n, v]) => ({ c: cat?.presidente.find((x) => x.n === n), v })).filter((x) => x.c);
    return (
      <li className="ev ev-secoes">
        <time className="tn">{horaDe(ev.t)}</time>
        <span className="anel" role="img" aria-label={`${pctS(f, f >= 0.9995 ? 0 : 1)} das seções`} style={{ '--f': f } as React.CSSProperties} />
        <p>
          <b className="tn">+{num(ev.secoes ?? 0)}</b> {(ev.secoes ?? 0) === 1 ? 'seção' : 'seções'}
          {vs.map((x) => <span key={x.c!.n} className="ev-cand">{x.c!.nome} <b className="tn" style={{ color: partido(x.c!.partido).texto }}>{ev.validos ? pctS(x.v / ev.validos, 1) : ''}</b></span>)}
        </p>
      </li>
    );
  }
  const { lugar, texto, cands } = textoEvento(cat, ev);
  const abrir = () => navegar(ev.uf === 'BR' ? { cargo: 'presidente', uf: null, zz: false } : { cargo: ev.cargo === 'governador' ? 'governadores' : ev.cargo === 'senador' ? 'senado' : 'presidente', uf: ev.uf, zz: false, mun: null });
  const c = cands[0];
  return (
    <li className={`ev ev-${ev.tipo}`}>
      <button onClick={abrir} aria-label={`${horaDe(ev.t)} ${lugar ? `${lugar}: ` : ''}${texto}`}>
        <time className="tn">{horaDe(ev.t)}</time>
        {c ? <Retrato nome={c.nome} sigla={c.partido} sq={c.sq} cargo={ev.cargo === 'presidente' ? 'presidente' : ev.cargo} uf={ev.uf === 'BR' ? null : ev.uf} tamanho={28} /> : <span className="anel cheio" />}
        <p>{lugar && <b>{lugar}: </b>}{texto}</p>
      </button>
    </li>
  );
});

export function CardAtualizacoes({ limite = 40 }: { limite?: number }) {
  const cat = useEstado((s) => s.catalogo);
  const ev = useEventos();
  const t = useEstado((s) => s.nav.t);
  const eventos = useMemo(() => (ev.dados?.eventos ?? []).filter((e) => t == null || e.t <= t).slice(0, limite), [ev.dados, t, limite]);
  const deReferencia = eventos.some((e) => e.origemHorario === 'referencia');
  return (
    <section className="card atualizacoes grow entrada" aria-labelledby="titulo-atualizacoes">
      <div className="hd"><h3 id="titulo-atualizacoes">Últimas atualizações</h3></div>
      {!eventos.length ? <p className="carregando">{ev.carregando ? 'Carregando…' : 'Nenhuma atualização registrada até este instante.'}</p> : (
        <ol className="lista-eventos">
          {eventos.map((e) => <Item key={e.id} ev={e} cat={cat} />)}
        </ol>
      )}
      {deReferencia && <p className="nota-fonte">Horários registrados pela série de referência; o TSE não publica o instante de cada definição.</p>}
    </section>
  );
}
