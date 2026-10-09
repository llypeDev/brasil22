// Senado: composição (cadeiras mantidas até 2031 + duas vagas por UF em 2026), barra
// ideológica, hemiciclo, grade de UFs e a disputa pela 2ª vaga (2ª × 3ª posições).

import { useMemo } from 'react';
import { useEstado } from '../../app/store';
import { candidatosDe, useSenadoMantidas, UF_NOME, UF_POR_ELEITORADO } from '../../app/dados';
import { useAgora } from '../../data/useFeed';
import { eleito, linhas, margemEntre, type Linha } from '../../data/calculos';
import { partido } from '../../data/partidos';
import { num, pctS } from '../../data/formato';
import { corDisputa } from '../../map/cores';
import { BarraIdeologica, GradeUfs, Hemiciclo, LegendaBancadas, Paginador, usePaginas, type Assento } from '../../components/Composicao';
import { Retrato } from '../../components/Retrato';

export function CardSenado() {
  const { agora } = useAgora();
  const cat = useEstado((s) => s.catalogo);
  const navegar = useEstado((s) => s.navegar);
  const uf = useEstado((s) => s.nav.uf);
  const mantidas = useSenadoMantidas().dados;

  const porUf = useMemo(() => UF_POR_ELEITORADO.map((u) => {
    const r = agora?.senador.uf[u];
    const ls = linhas(r, candidatosDe(cat, 'senador', u)).filter((l) => !l.anulado);
    return { uf: u, r, ls, situacao: r?.situacao ?? 'aguardando', m: margemEntre(ls, 1) };
  }), [agora, cat]);

  const assentos: Assento[] = useMemo(() => {
    const a: Assento[] = (mantidas?.cadeiras ?? []).map((c) => ({ partido: c.partido, definido: true }));
    for (const d of porUf) {
      for (let k = 0; k < 2; k++) {
        const l: Linha | undefined = d.ls[k];
        a.push({ partido: l && l.votos > 0 ? l.c.partido : null, definido: !!l && (eleito(l.situacao) || d.situacao === 'eleitos') });
      }
    }
    return a;
  }, [mantidas, porUf]);

  const definidas = porUf.reduce((s, d) => s + d.ls.slice(0, 2).filter((l) => eleito(l.situacao) || d.situacao === 'eleitos').length, 0);
  const emDisputa = 54 - definidas;
  const contagem = useMemo(() => {
    const c = new Map<string, number>();
    for (const a of assentos) if (a.partido && a.definido) c.set(a.partido, (c.get(a.partido) ?? 0) + 1);
    return [...c.entries()].sort((x, y) => y[1] - x[1]);
  }, [assentos]);
  const completas = porUf.filter((d) => d.situacao === 'eleitos').length;
  const segunda = useMemo(() => [...porUf].filter((d) => d.m).sort((x, y) => (x.m!.pontos) - (y.m!.pontos)), [porUf]);
  const pag = usePaginas(segunda, 3);
  const chips = porUf.map((d) => {
    const def = d.situacao === 'eleitos';
    const cores = d.ls.length >= 2 && d.ls[0].votos ? [corDisputa(d.ls[0].c.partido, def), corDisputa(d.ls[1].c.partido, def)] : [];
    return { uf: d.uf, cores, aria: `${UF_NOME[d.uf]}${d.ls[0]?.votos ? `, ${d.ls[0].c.nome} ${pctS(d.ls[0].parcela, 1)}` : ''}` };
  });

  return (
    <section className="card senado grow entrada" aria-labelledby="titulo-senado">
      <div className="hd"><h3 id="titulo-senado">Senado</h3><span className="aside">Duas vagas por estado</span></div>
      <BarraIdeologica assentos={assentos} maioria={41} total={81} />
      <Hemiciclo assentos={assentos} fileiras={6} raioInterno={0.46} forma="retangulo" rotulo={`Senado: ${definidas} de 54 vagas de 2026 definidas; ${mantidas?.cadeiras.length ?? 27} cadeiras de 2022 seguem até 2031`}
        centro={<><b className="tn serif">{definidas}</b><span>de 54 definidas</span></>} />
      <LegendaBancadas contagem={contagem} max={5} extra={<span><i className="vazio" />Em disputa <b className="tn">{num(emDisputa)}</b></span>} />
      <p className="resumo-linha"><b className="tn">{completas}</b> com as duas vagas</p>
      <GradeUfs chips={chips} aoEscolher={(u) => navegar({ uf: u })} selecionada={uf} />
      <div className="sub-hd">
        <h4>A disputa pela 2ª vaga</h4>
        <Paginador {...pag} rotulo="Disputas" />
      </div>
      <ul className="lista-disputas">
        {pag.itens.map((d) => (
          <li key={d.uf}>
            <button onClick={() => navegar({ uf: d.uf })} aria-label={`${UF_NOME[d.uf]}: ${d.m!.a.c.nome} ${pctS(d.m!.a.parcela, 2)}, ${d.m!.b.c.nome} ${pctS(d.m!.b.parcela, 2)}`}>
              <span className="disp-uf"><span className="chip-uf mini" style={{ background: `linear-gradient(135deg, ${corDisputa(d.ls[0].c.partido, d.situacao === 'eleitos')} 50%, ${corDisputa(d.ls[1].c.partido, d.situacao === 'eleitos')} 50%)` }}>{d.uf}</span><small>{d.situacao === 'eleitos' ? 'definida' : 'apurando'}</small></span>
              <span className="disp-cands">
                {[d.m!.a, d.m!.b].map((l, k) => (
                  <span key={l.c.n} className={`disp-linha ${k === 1 && d.situacao === 'eleitos' ? 'apagado' : ''}`}>
                    <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo="senador" uf={d.uf} tamanho={24} />
                    <span className="nome">{l.c.nome}</span>
                    <b className="tn" style={{ color: partido(l.c.partido).texto }}>{pctS(l.parcela, 2)}</b>
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="nota-fonte">Cadeiras de 2022: partido atual do parlamentar em exercício (Senado Federal, dados abertos).</p>
    </section>
  );
}
