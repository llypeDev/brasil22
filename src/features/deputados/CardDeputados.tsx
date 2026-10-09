// Deputados federais e estaduais/distritais. Ranking por votos e situação oficial são
// informações distintas: a posição no ranking não define eleição (sistema proporcional).

import { useMemo } from 'react';
import { useEstado } from '../../app/store';
import { useDeputadosBr } from '../../app/dados';
import { eleito, rotuloSituacao } from '../../data/calculos';
import { partido, siglaExibicao } from '../../data/partidos';
import { num, pctS } from '../../data/formato';
import { BarraIdeologica, Hemiciclo, LegendaBancadas, type Assento } from '../../components/Composicao';
import { Retrato } from '../../components/Retrato';
import { abrirPerfil } from '../perfil/acoes';
import type { RankingLegislativo } from '../../data/contratos';

export function AlternarCasa() {
  const casa = useEstado((s) => s.casa);
  const set = useEstado((s) => s.set);
  const uf = useEstado((s) => s.nav.uf);
  return (
    <div className="alternar" role="group" aria-label="Deputados">
      <button aria-pressed={casa === 'f'} onClick={() => set({ casa: 'f' })}>Federais</button>
      <button aria-pressed={casa === 'e'} onClick={() => set({ casa: 'e' })}>{uf === 'DF' ? 'Distritais' : 'Estaduais'}</button>
    </div>
  );
}

export function LinhaRanking({ r, k, mostrarUf = true }: { r: RankingLegislativo; k: number; mostrarUf?: boolean }) {
  const [n, nome, sigla, uf, casa, votos, sit, sq] = r;
  return (
    <li>
      <button onClick={() => abrirPerfil({ cargo: 'deputado', uf, n, sq, casa })} aria-label={`${k}º ${nome}, ${siglaExibicao(sigla)}${mostrarUf ? ` ${uf}` : ''}, ${num(votos)} votos${rotuloSituacao(sit) ? `, ${rotuloSituacao(sit)}` : ''}`}>
        <span className="pos tn">{k}</span>
        <Retrato nome={nome} sigla={sigla} sq={sq} cargo="deputado" uf={uf} tamanho={30} />
        <span className="nome"><b>{nome}</b><small style={{ color: partido(sigla).texto }}>{siglaExibicao(sigla)}{mostrarUf ? ` · ${uf}` : ''}</small></span>
        <span className="valor"><b className="tn">{num(votos)}</b>{eleito(sit) ? <em className="tag-eleito">eleito(a)</em> : sit === 'apurando' ? <em className="tag-neutra">apurando</em> : null}</span>
      </button>
    </li>
  );
}

export function CardDeputados() {
  const casa = useEstado((s) => s.casa);
  const set = useEstado((s) => s.set);
  const altura = typeof window !== 'undefined' && window.innerHeight < 860 ? 7 : 10;
  const { dados, carregando } = useDeputadosBr();
  const c = casa === 'f' ? dados?.federal : dados?.estadual;
  const assentos: Assento[] = useMemo(() => {
    if (!c) return [];
    const a: Assento[] = [];
    for (const [p, n] of Object.entries(c.partidos)) for (let i = 0; i < n; i++) a.push({ partido: p, definido: true });
    while (a.length < c.vagas) a.push({ partido: null, definido: false });
    return a;
  }, [c]);
  const contagem = useMemo(() => (c ? Object.entries(c.partidos).sort((x, y) => y[1] - x[1]) : []), [c]);
  const fracao = useMemo(() => {
    if (!dados) return 0;
    let t = 0, s = 0;
    for (const u of Object.values(dados.porUf)) { const x = casa === 'f' ? u.federal : u.estadual; if (x) { t += x.totalizadas; s += x.secoes; } }
    return s ? t / s : 0;
  }, [dados, casa]);
  if (!c) return <section className="card deputados grow"><div className="hd"><h3>Câmara dos Deputados</h3></div><p className="carregando">{carregando ? 'Carregando…' : 'Indisponível.'}</p></section>;
  const federal = casa === 'f';
  return (
    <section className="card deputados grow entrada" aria-labelledby="titulo-dep">
      <div className="hd"><h3 id="titulo-dep">{federal ? 'Câmara dos Deputados' : 'Assembleias Legislativas'}</h3><span className="aside">{num(c.vagas)} vagas</span></div>
      <AlternarCasa />
      {federal ? (
        <>
          <BarraIdeologica assentos={assentos} maioria={Math.floor(c.vagas / 2) + 1} total={c.vagas} />
          <Hemiciclo assentos={assentos} fileiras={13} raioInterno={0.34} rotulo={`Câmara: ${c.eleitos} de ${c.vagas} deputados eleitos`} centro={<><b className="tn serif">{num(c.eleitos)}</b><span>eleitos de {num(c.vagas)}</span></>} />
        </>
      ) : (
        <div className="assembleias">
          <p className="resumo-grande"><b className="tn serif">{num(c.eleitos)}</b> eleitos de {num(c.vagas)} nas 27 assembleias</p>
          <div className="barra-partidos" role="img" aria-label="Cadeiras por partido nas assembleias">
            {contagem.map(([p, n]) => <i key={p} style={{ flexGrow: n, background: partido(p).cor }} title={`${siglaExibicao(p)}: ${n}`} />)}
            {c.vagas > c.eleitos && <i style={{ flexGrow: c.vagas - c.eleitos, background: '#E2E2DF' }} />}
          </div>
        </div>
      )}
      <LegendaBancadas contagem={contagem} max={federal ? 5 : 6} />
      <div className="sub-hd"><h4>{federal ? 'Mais votados do Brasil' : 'Mais votados para deputado estadual'}</h4><span className="aside tn">{pctS(fracao, fracao >= 0.9995 ? 0 : 1)} das seções</span></div>
      <ol className="ranking">
        {c.ranking.slice(0, altura).map((r, k) => <LinhaRanking key={`${r[3]}-${r[0]}-${r[7]}`} r={r} k={k + 1} />)}
      </ol>
      <button className="btn largo" onClick={() => set({ lista: { tipo: 'deputados', casa, uf: null } })}>Ver todos os {num(c.totalCandidatos)} candidatos</button>
      <p className="nota-centro">ou clique num estado no mapa para ver só os dele</p>
    </section>
  );
}
