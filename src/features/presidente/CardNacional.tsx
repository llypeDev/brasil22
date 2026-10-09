import { useMemo } from 'react';
import { useEstado } from '../../app/store';
import { useAgora } from '../../data/useFeed';
import { linhas, vantagem, fracaoSecoes, comparecimentoPct, brancosNulosPct, type Linha } from '../../data/calculos';
import { compacto, horaDe, num, pct, pctS } from '../../data/formato';
import { ESCALA_IDEOLOGICA, chavePartido, partido, siglaExibicao } from '../../data/partidos';
import { Retrato } from '../../components/Retrato';
import { BarraDupla } from '../../components/Barra';
import { abrirPerfil } from '../perfil/acoes';
import type { Resultado } from '../../data/contratos';

/** Ordena a dupla por posição ideológica (esquerda à esquerda), como na referência. */
export function ordenarDupla(a: Linha, b: Linha | null): [Linha, Linha | null] {
  if (!b) return [a, null];
  const ia = ESCALA_IDEOLOGICA[chavePartido(a.c.partido)], ib = ESCALA_IDEOLOGICA[chavePartido(b.c.partido)];
  if (ia != null && ib != null && ia > ib) return [b, a];
  return [a, b];
}

export function NomeColorido({ l }: { l: Linha }) {
  return <span className="nome-cor" style={{ color: partido(l.c.partido).texto }}>{l.c.nome}</span>;
}

export function Manchete({ r, ls, cargo = 'presidente' }: { r: Resultado | null; ls: Linha[]; cargo?: 'presidente' | 'governador' }) {
  const v = vantagem(ls);
  if (!r || r.situacao === 'aguardando' || !v) return <h2 className="manchete">Aguardando os primeiros resultados</h2>;
  const a = v.lider, b = v.segundo;
  if (r.situacao === 'segundo-turno') {
    const dupla = ls.filter((l) => l.situacao === 'segundo-turno');
    const [x, y] = dupla.length === 2 ? dupla : [a, b];
    return <h2 className="manchete"><NomeColorido l={x} /> e {y && <NomeColorido l={y} />} vão ao 2º turno</h2>;
  }
  if (r.situacao === 'eleito') {
    const e = ls.find((l) => l.situacao === 'eleito') ?? a;
    return <h2 className="manchete"><NomeColorido l={e} /> vence no 1º turno{cargo === 'governador' ? '' : ''}</h2>;
  }
  return <h2 className="manchete"><NomeColorido l={a} /> à frente{b ? <> de <NomeColorido l={b} /></> : null}</h2>;
}

export function SeloSituacao({ r, segundoTurno }: { r: Resultado | null; segundoTurno?: string }) {
  if (!r) return <span className="selo">Carregando…</span>;
  const f = fracaoSecoes(r);
  const def = r.definido != null ? ` · definido às ${horaDe(r.definido)}` : '';
  if (r.situacao === 'segundo-turno') return <span className="selo forte"><i className="ponto" />2º turno{def}</span>;
  if (r.situacao === 'eleito' || r.situacao === 'eleitos') return <span className="selo forte"><i className="ponto" />{r.situacao === 'eleitos' ? 'Eleitos' : 'Eleito'}{def}</span>;
  if (r.situacao === 'aguardando') return <span className="selo">Aguardando a totalização</span>;
  void segundoTurno;
  return <span className="selo" title={`${pctS(f, 1)} das seções totalizadas`}><i className="ponto pulso" />Apurando · {pctS(f, 1)}</span>;
}

export function CardNacional() {
  const { agora, semRegistro, ponto, historico } = useAgora();
  const catalogo = useEstado((s) => s.catalogo);
  const manifesto = useEstado((s) => s.manifesto);
  const lista = useEstado((s) => s.set);

  // Em consulta histórica sem snapshot completo, usa o agregado nacional da série.
  const r: Resultado | null = useMemo(() => {
    if (agora) return agora.presidente.br;
    if (semRegistro && ponto) {
      const validos = Object.values(ponto.votos).reduce((a, b) => a + b, 0);
      return { secoes: ponto.secoes, totalizadas: ponto.totalizadas, eleitorado: 0, eleitoradoApurado: 0, comparecimento: 0, abstencao: 0, brancos: 0, nulos: 0, validos, anuladosSJ: 0, votos: ponto.votos, anulados: {}, situacao: ponto.situacao as Resultado['situacao'], situacoes: {} };
    }
    return null;
  }, [agora, semRegistro, ponto]);

  const ls = useMemo(() => linhas(r, catalogo?.presidente), [r, catalogo]);
  const v = vantagem(ls);
  const [esq, dir] = v ? ordenarDupla(v.lider, v.segundo) : [null, null];
  const demais = ls.filter((l) => !l.anulado && l !== esq && l !== dir);
  const visiveis = demais.slice(0, 3);
  const resto = demais.slice(3);
  const somaResto = resto.reduce((s, l) => s + (l.parcela ?? 0), 0);
  const segundoTurno = manifesto?.eleicao?.segundoTurno ? new Date(`${manifesto.eleicao.segundoTurno}T12:00:00-03:00`) : null;

  const lado = (l: Linha | null, pos: 'esq' | 'dir') => {
    if (!l) return <div className={`lado ${pos}`} />;
    const p = partido(l.c.partido);
    return (
      <button className={`lado ${pos}`} onClick={() => abrirPerfil({ cargo: 'presidente', uf: null, n: l.c.n, sq: l.c.sq })} aria-label={`Ver ${l.c.nome}`}>
        <span className="lado-topo">
          <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo="presidente" tamanho={50} forma="quadrado" />
          <span className="lado-nome">
            <b>{l.c.nome}</b>
            <small style={{ color: p.texto }}>{siglaExibicao(l.c.partido)} {l.c.n}</small>
          </span>
        </span>
        <span className="figura tn">{pct(l.parcela, 2)}<sup style={{ color: p.texto }}>%</sup></span>
        <span className="votos tn">{num(l.votos)} votos</span>
      </button>
    );
  };

  return (
    <section className="card cand-nacional entrada" aria-labelledby="manchete-pres">
      <div className="hd">
        <span className="contexto">Presidente · Brasil{historico && <em className="historico-tag"> · registro {semRegistro ? 'da série' : ''}</em>}</span>
        <SeloSituacao r={r} />
      </div>
      <div id="manchete-pres"><Manchete r={r} ls={ls} /></div>
      {semRegistro && <p className="aviso-registro">O TSE não publica o mapa e os detalhes deste instante; o card mostra o agregado nacional da série de referência.</p>}
      <div className="duelo">
        {lado(esq, 'esq')}
        {lado(dir, 'dir')}
      </div>
      <BarraDupla esq={esq ? { nome: esq.c.nome, sigla: esq.c.partido, parcela: esq.parcela } : null} dir={dir ? { nome: dir.c.nome, sigla: dir.c.partido, parcela: dir.parcela } : null} />
      <dl className="pares">
        <div><dt>Diferença</dt><dd className="tn">{v?.pontos != null ? `${pct(Math.abs(v.pontos), 2)} pontos · ${compacto(Math.abs(v.votos))} de votos` : '—'}</dd></div>
        {r?.situacao === 'segundo-turno' && segundoTurno && (
          <div><dt>2º turno</dt><dd className="forte">Em {new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(segundoTurno)}</dd></div>
        )}
      </dl>
      <ul className="outros">
        {visiveis.map((l) => (
          <li key={l.c.n}>
            <button onClick={() => abrirPerfil({ cargo: 'presidente', uf: null, n: l.c.n, sq: l.c.sq })} aria-label={`Ver ${l.c.nome}`}>
              <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo="presidente" tamanho={30} />
              <span className="nome"><b>{l.c.nome}</b><small style={{ color: partido(l.c.partido).texto }}>{siglaExibicao(l.c.partido)} {l.c.n}</small></span>
              <span className="valor tn">{pctS(l.parcela, 1)}</span>
            </button>
          </li>
        ))}
      </ul>
      {resto.length > 0 && <p className="nota tn">Mais {resto.length} candidaturas somam {pctS(somaResto, 1)}</p>}
      <button className="link todos" onClick={() => lista({ lista: { tipo: 'candidatos', cargo: 'presidente', uf: null } })}>Todos os {ls.length} candidatos</button>
      <dl className="metricas">
        <div><dt>Votos válidos</dt><dd className="tn">{num(r?.validos)}</dd></div>
        <div><dt>Comparecimento</dt><dd className="tn">{agora ? pctS(comparecimentoPct(r), 1) : '—'}</dd></div>
        <div><dt>Brancos e nulos</dt><dd className="tn">{agora ? pctS(brancosNulosPct(r), 1) : '—'}</dd></div>
      </dl>
    </section>
  );
}
