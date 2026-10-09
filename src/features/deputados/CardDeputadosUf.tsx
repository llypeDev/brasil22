import { useMemo } from 'react';
import { useEstado } from '../../app/store';
import { useDeputadosUf, UF_NOME } from '../../app/dados';
import { fracaoSecoes } from '../../data/calculos';
import { num, pctS } from '../../data/formato';
import { partido } from '../../data/partidos';
import { LegendaBancadas } from '../../components/Composicao';
import { IconeFechar } from '../../components/Icones';
import { AlternarCasa, LinhaRanking } from './CardDeputados';
import type { RankingLegislativo } from '../../data/contratos';

export function CardDeputadosUf() {
  const uf = useEstado((s) => s.nav.uf)!;
  const casa = useEstado((s) => s.casa);
  const navegar = useEstado((s) => s.navegar);
  const set = useEstado((s) => s.set);
  const { dados, carregando } = useDeputadosUf(uf);
  const c = casa === 'f' ? dados?.federal : uf === 'DF' ? dados?.distrital : dados?.estadual;
  const contagem = useMemo(() => (c ? Object.entries(c.partidos).filter(([, p]) => p.cadeiras > 0).map(([s, p]) => [s, p.cadeiras] as [string, number]).sort((a, b) => b[1] - a[1]) : []), [c]);
  const nomeCasa = casa === 'f' ? 'Câmara dos Deputados' : uf === 'DF' ? 'Câmara Legislativa' : 'Assembleia Legislativa';
  const codigo = casa === 'f' ? 'f' : uf === 'DF' ? 'd' : 'e';
  const ranking: RankingLegislativo[] = (c?.candidatos ?? []).slice(0, 12).map((x) => [x[0], x[1], x[2], uf, codigo, x[3], x[4], x[5]]);
  const f = c ? (c.totais.totalizadas ?? 0) / Math.max(1, c.totais.secoes ?? 0) : 0;
  return (
    <section className="card detalhe-uf grow entrada" aria-labelledby="titulo-dep-uf">
      <div className="det-hd">
        <span className="bandeira" aria-hidden="true">{uf}</span>
        <div className="det-titulo">
          <h2 id="titulo-dep-uf" className="serif">{UF_NOME[uf]}</h2>
          <p className="f3">{nomeCasa}{c ? ` · ${num(c.vagas)} vagas` : ''}</p>
        </div>
        <div className="det-acoes"><button className="icone" onClick={() => navegar({ uf: null })} aria-label="Fechar o estado"><IconeFechar /></button></div>
      </div>
      <AlternarCasa />
      {!c ? <p className="carregando">{carregando ? 'Carregando…' : 'Indisponível.'}</p> : (
        <>
          <p className="resumo-grande"><b className="tn serif">{num(c.eleitos)}</b> eleitos de {num(c.vagas)}</p>
          <div className="barra-partidos" role="img" aria-label={`Cadeiras por partido: ${contagem.map(([p, n]) => `${p} ${n}`).join(', ')}`}>
            {contagem.map(([p, n]) => <i key={p} style={{ flexGrow: n, background: partido(p).cor }} />)}
            {c.vagas > c.eleitos && <i style={{ flexGrow: c.vagas - c.eleitos, background: '#E2E2DF' }} />}
          </div>
          <LegendaBancadas contagem={contagem} max={6} />
          <div className="sub-hd"><h4>Mais votados</h4><span className="aside tn">{pctS(f || fracaoSecoes(null), f >= 0.9995 ? 0 : 1)} das seções</span></div>
          <ol className="ranking">{ranking.map((r, k) => <LinhaRanking key={`${r[0]}-${r[7]}`} r={r} k={k + 1} mostrarUf={false} />)}</ol>
          <button className="btn largo" onClick={() => set({ lista: { tipo: 'deputados', casa, uf } })}>Ver todos os {num(c.candidatos.length)} candidatos</button>
        </>
      )}
    </section>
  );
}
