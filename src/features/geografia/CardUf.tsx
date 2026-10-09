// Detalhe de UF: presidente, governador e Senado (o cargo da navegação vem primeiro).

import { useEstado } from '../../app/store';
import { candidatosDe, useGeoBrasil, useMunicipios, useUfMunicipal, UF_NOME } from '../../app/dados';
import { resultadoDoItem } from '../../data/calculos';
import { usePaginas, Paginador } from '../../components/Composicao';
import { useAgora } from '../../data/useFeed';
import { fracaoSecoes, linhas, vantagem, type Linha } from '../../data/calculos';
import { compacto, pct, pctS } from '../../data/formato';
import { partido, siglaExibicao } from '../../data/partidos';
import { Anulados, ListaCandidatos, Secao } from '../../components/Candidatos';
import { BarraDupla } from '../../components/Barra';
import { Retrato } from '../../components/Retrato';
import { IconeDir, IconeEsq, IconeFechar } from '../../components/Icones';
import { abrirPerfil } from '../perfil/acoes';
import type { Resultado } from '../../data/contratos';

const ORDEM_NOME = Object.keys(UF_NOME).sort((a, b) => UF_NOME[a].localeCompare(UF_NOME[b], 'pt-BR'));

export function SeloDisputa({ r }: { r: Resultado | null | undefined }) {
  if (!r) return null;
  if (r.situacao === 'eleito') return <span className="selo forte mini"><i className="ponto" />Eleito(a)</span>;
  if (r.situacao === 'eleitos') return <span className="selo forte mini"><i className="ponto" />Eleitos</span>;
  if (r.situacao === 'segundo-turno') return <span className="selo forte mini"><i className="ponto" />2º turno</span>;
  if (r.situacao === 'parcial') return <span className="selo mini">1 vaga definida</span>;
  if (r.situacao === 'aguardando') return <span className="selo mini">Aguardando</span>;
  if (r.situacao === 'concluida') return <span className="selo forte mini"><i className="ponto" />Apurado</span>;
  return <span className="selo mini"><i className="ponto pulso" />Apurando</span>;
}

function Duelo({ ls, uf, r }: { ls: Linha[]; uf: string; r: Resultado }) {
  const v = vantagem(ls);
  if (!v) return <p className="carregando">Aguardando os primeiros votos.</p>;
  // Governador: líder à esquerda (a ordem por posição ideológica vale só para presidente).
  const [a, b] = [v.lider, v.segundo];
  const outros = ls.filter((l) => !l.anulado && l !== a && l !== b);
  const lado = (l: Linha | null, pos: 'esq' | 'dir') => l && (
    <button className={`mini-lado ${pos}`} onClick={() => abrirPerfil({ cargo: 'governador', uf, n: l.c.n, sq: l.c.sq })} aria-label={`Ver ${l.c.nome}`}>
      <span className="mini-topo">
        <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo="governador" uf={uf} tamanho={36} forma="quadrado" />
        <span className="mini-nome"><b>{l.c.nome}</b><small style={{ color: partido(l.c.partido).texto }}>{siglaExibicao(l.c.partido)} {l.c.n}</small></span>
      </span>
      <span className="mini-fig tn" style={{ color: partido(l.c.partido).texto }}>{pct(l.parcela, 1)}<sup>%</sup></span>
    </button>
  );
  return (
    <>
      <div className="mini-duelo">{lado(a, 'esq')}{lado(b, 'dir')}</div>
      <BarraDupla esq={a && { nome: a.c.nome, sigla: a.c.partido, parcela: a.parcela }} dir={b && { nome: b.c.nome, sigla: b.c.partido, parcela: b.parcela }} altura={4} />
      <Anulados ls={ls} cargo="governador" uf={uf} />
      <dl className="pares compacto">
        <div><dt>Vantagem</dt><dd className="tn">{compacto(Math.abs(v.votos))} de votos</dd></div>
        {outros.length > 0 && <div><dt>Outras {outros.length} candidaturas</dt><dd className="tn">{pctS(outros.reduce((s, l) => s + (l.parcela ?? 0), 0), 1)}</dd></div>}
      </dl>
      {r.anuladosSJ > 0 && <p className="nota">Percentuais sobre {compacto(r.validos)} de votos válidos; votos anulados sub judice ficam fora do denominador.</p>}
    </>
  );
}

/** Municípios da UF em lista navegável por teclado — alternativa acessível ao mapa. */
function MunicipiosDaUf({ uf, cargo }: { uf: string; cargo: 'presidente' | 'governador' | 'senador' }) {
  const geo = useGeoBrasil().dados;
  const cat = useEstado((s) => s.catalogo);
  const navegar = useEstado((s) => s.navegar);
  const pres = useMunicipios();
  const ufMun = useUfMunicipal(cargo === 'presidente' ? null : uf);
  const col = cargo === 'presidente' ? pres.dados : ufMun.dados?.[cargo];
  const cands = cargo === 'presidente' ? cat?.presidente ?? [] : candidatosDe(cat, cargo, uf);
  const lista = (geo && col ? [...(geo.municipiosDaUf.get(uf) ?? [])].map((g) => {
    const i = col.tse.indexOf(geo.tse[g]);
    return { g, r: resultadoDoItem(col, i, cands) };
  }).sort((a, b) => (b.r?.eleitorado ?? 0) - (a.r?.eleitorado ?? 0)) : []);
  const pag = usePaginas(lista, 6);
  if (!geo || !lista.length) return null;
  return (
    <Secao titulo={`Municípios (${lista.length})`} aside={<Paginador {...pag} rotulo="Municípios" />}>
      <ul className="lista-lugares">
        {pag.itens.map(({ g, r }) => {
          const l = linhas(r, cands).filter((x) => !x.anulado)[0];
          return (
            <li key={geo.ibge[g]}>
              <button onClick={() => navegar({ mun: geo.ibge[g], zona: null })} aria-label={`${geo.nome[g]}: ${l ? `${l.c.nome} ${pctS(l.parcela, 1)}` : 'sem dados'}`}>
                <span className="chip-pais" style={{ background: l ? partido(l.c.partido).cor : '#CCC' }}>{l ? siglaExibicao(l.c.partido) : '—'}</span>
                <span className="nome"><b>{geo.nome[g]}</b><small className="tn">{r ? `${compacto(r.eleitorado)} eleitores` : ''}</small></span>
                <span />
                <b className="tn" style={{ color: l ? partido(l.c.partido).texto : undefined }}>{l ? pctS(l.parcela, 1) : '—'}</b>
              </button>
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}

export function CardUf() {
  const uf = useEstado((s) => s.nav.uf)!;
  const cargo = useEstado((s) => s.nav.cargo);
  const navegar = useEstado((s) => s.navegar);
  const set = useEstado((s) => s.set);
  const cat = useEstado((s) => s.catalogo);
  const { agora, semRegistro } = useAgora();
  const rp = agora?.presidente.uf[uf];
  const rg = agora?.governador.uf[uf];
  const rs = agora?.senador.uf[uf];
  const k = ORDEM_NOME.indexOf(uf);
  const vizinho = (d: number) => ORDEM_NOME[(k + d + ORDEM_NOME.length) % ORDEM_NOME.length];
  const lp = linhas(rp, cat?.presidente);
  const lg = linhas(rg, candidatosDe(cat, 'governador', uf));
  const lsn = linhas(rs, candidatosDe(cat, 'senador', uf));

  const secPres = (
    <Secao key="p" titulo={`Presidente em ${UF_NOME[uf]}`} aside={<span className="aside">Clique num município</span>}>
      <ListaCandidatos ls={lp} cargo="presidente" uf={null} limite={2} />
      <button className="link" onClick={() => set({ lista: { tipo: 'candidatos', cargo: 'presidente', uf } })}>Todos os {lp.length} candidatos</button>
    </Secao>
  );
  const secGov = rg && (
    <Secao key="g" titulo="Governador" aside={<SeloDisputa r={rg} />}>
      <Duelo ls={lg} uf={uf} r={rg} />
      <button className="link" onClick={() => set({ lista: { tipo: 'candidatos', cargo: 'governador', uf } })}>Todos os {lg.length} candidatos</button>
    </Secao>
  );
  const secSen = rs && (
    <Secao key="s" titulo="Senado · duas vagas" aside={<SeloDisputa r={rs} />}>
      <ListaCandidatos ls={lsn} cargo="senador" uf={uf} limite={rs.situacao === 'eleitos' ? 2 : 3} situacao casasDecimais={1} />
      <Anulados ls={lsn} cargo="senador" uf={uf} />
      <button className="link" onClick={() => set({ lista: { tipo: 'candidatos', cargo: 'senador', uf } })}>Todos os {lsn.length} candidatos</button>
    </Secao>
  );
  const secoes = cargo === 'governadores' ? [secGov, secPres, secSen] : cargo === 'senado' ? [secSen, secPres, secGov] : [secPres, secGov, secSen];
  return (
    <section className="card detalhe-uf grow entrada" aria-labelledby="titulo-uf">
      <div className="det-hd">
        <span className="bandeira" aria-hidden="true">{uf}</span>
        <div className="det-titulo">
          <h2 id="titulo-uf" className="serif">{UF_NOME[uf]}</h2>
          <p className="f3 tn">{rp ? `${pctS(fracaoSecoes(rp), fracaoSecoes(rp) >= 0.9995 ? 0 : 1)} das seções` : semRegistro ? 'Sem registro neste instante' : '—'}</p>
          <p className="f3 tn">{rp ? `${compacto(rp.eleitorado)} de eleitores` : ''}</p>
        </div>
        <div className="det-acoes">
          <button className="icone" onClick={() => navegar({ uf: vizinho(-1) })} aria-label={`Estado anterior: ${UF_NOME[vizinho(-1)]}`}><IconeEsq /></button>
          <button className="icone" onClick={() => navegar({ uf: vizinho(1) })} aria-label={`Próximo estado: ${UF_NOME[vizinho(1)]}`}><IconeDir /></button>
          <button className="icone" onClick={() => navegar({ uf: null })} aria-label="Fechar o estado"><IconeFechar /></button>
        </div>
      </div>
      <div className="det-corpo">{secoes}<MunicipiosDaUf uf={uf} cargo={cargo === 'governadores' ? 'governador' : cargo === 'senado' ? 'senador' : 'presidente'} /></div>
    </section>
  );
}
