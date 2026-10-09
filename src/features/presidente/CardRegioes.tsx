// "Por região": líder em cada região pela soma de votos (nunca média de percentuais), com a
// variação em relação à candidatura de mesmo número em 2022 (mapeamento explícito no arquivo).

import { useEstado } from '../../app/store';
import { usePresidente2022 } from '../../app/dados';
import { useAgora } from '../../data/useFeed';
import { delta2022, fracaoSecoes, linhas, vantagem } from '../../data/calculos';
import { partido, siglaExibicao } from '../../data/partidos';
import { pctS, pontos } from '../../data/formato';
import { Retrato } from '../../components/Retrato';
import { BarraParcela } from '../../components/Barra';
import { IconeGlobo } from '../../components/Icones';
import type { Resultado } from '../../data/contratos';

const REGIOES: [string, string][] = [['Norte', 'N'], ['Nordeste', 'NE'], ['Centro-Oeste', 'CO'], ['Sudeste', 'SE'], ['Sul', 'S']];

export function CardRegioes() {
  const catalogo = useEstado((s) => s.catalogo);
  const navegar = useEstado((s) => s.navegar);
  const { agora } = useAgora();
  const h22 = usePresidente2022().dados;
  if (!agora || !catalogo) return <section className="card regioes"><div className="hd"><h3>Por região</h3></div><p className="carregando">Carregando…</p></section>;
  const linha = (nome: string, r: Resultado | undefined, ref: { validos: number; votos: Record<string, number> } | undefined, exterior = false) => {
    const v = vantagem(linhas(r, catalogo.presidente));
    const l = v?.lider;
    const d = l ? delta2022(l.parcela, l.c.n, ref) : null;
    const quem22 = l ? h22?.candidatos[l.c.n] : null;
    const conteudo = (
      <>
        <span className="reg-nome">{exterior && <IconeGlobo width={12} height={12} />}{nome}<small className="tn">{pctS(fracaoSecoes(r), 0)}</small></span>
        {l ? (
          <span className="reg-lider">
            <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo="presidente" tamanho={22} />
            <span className="reg-partido" style={{ color: partido(l.c.partido).texto }}>{siglaExibicao(l.c.partido)}</span>
            <b className="tn">{pctS(l.parcela, 1)}</b>
            <span className={`reg-delta tn ${d == null ? '' : d >= 0 ? 'sobe' : 'cai'}`} title={quem22 ? `Em relação a 2022 (${quem22.nome}${quem22.nome !== l.c.nome ? `, então no ${quem22.partido}` : ''}), em pontos` : 'Sem comparação com 2022'}>{d == null ? '—' : pontos(d, 1)}</span>
          </span>
        ) : <span className="reg-lider f4">Aguardando</span>}
        {l && <BarraParcela parcela={l.parcela} sigla={l.c.partido} />}
      </>
    );
    return exterior
      ? <li key={nome}><button className="reg-linha" onClick={() => navegar({ zz: true, cargo: 'presidente' })} aria-label={`Exterior: ${l ? `${l.c.nome} ${pctS(l.parcela, 1)}` : 'aguardando'}, ${pctS(fracaoSecoes(r), 0)} das seções`}>{conteudo}</button></li>
      : <li key={nome} className="reg-linha">{conteudo}</li>;
  };
  return (
    <section className="card regioes entrada" aria-labelledby="titulo-regioes">
      <div className="hd"><h3 id="titulo-regioes">Por região</h3><span className="aside">Quem lidera para presidente</span></div>
      <ul>
        {REGIOES.map(([nome, sig]) => linha(nome, agora.presidente.regioes[nome], h22?.regioes[sig]))}
        {linha('Exterior', agora.presidente.zz, h22?.ufs.ZZ, true)}
      </ul>
    </section>
  );
}
