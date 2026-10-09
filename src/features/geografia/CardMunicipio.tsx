// Município: resultado do cargo, indicadores, comparação com 2022 e zonas eleitorais.
// O TSE não publica limites de zona; o painel lista os resultados oficiais por zona e
// mantém o mapa municipal (sem desenhar polígonos aproximados).

import { useMemo } from 'react';
import { useEstado } from '../../app/store';
import { candidatosDe, useGeoBrasil, useMunicipios, usePresidente2022, useUfMunicipal, useZonas, UF_NOME } from '../../app/dados';
import { useAgora } from '../../data/useFeed';
import { abstencaoPct, brancosNulosPct, comparecimentoPct, fracaoSecoes, linhas, resultadoDoItem } from '../../data/calculos';
import { compacto, num, pctS } from '../../data/formato';
import { partido } from '../../data/partidos';
import { ListaCandidatos, Secao } from '../../components/Candidatos';
import { Paginador, usePaginas } from '../../components/Composicao';
import { Retrato } from '../../components/Retrato';
import { IconeEsq, IconeFechar } from '../../components/Icones';
import type { Resultado } from '../../data/contratos';

export function Linha2022({ v13, v22, validos }: { v13: number; v22: number; validos: number }) {
  if (!validos) return null;
  return (
    <p className="linha-2022 tn" title="1º turno de 2022, TSE">
      <span className="ano">2022</span>
      <span><i style={{ background: partido('PT').cor }} />Lula {pctS(v13 / validos, 1)}</span>
      <span><i style={{ background: partido('PL').cor }} />Bolsonaro {pctS(v22 / validos, 1)}</span>
    </p>
  );
}

export function Indicadores({ r }: { r: Resultado | null }) {
  if (!r) return null;
  return (
    <dl className="metricas">
      <div><dt>Comparecimento</dt><dd className="tn">{pctS(comparecimentoPct(r), 1)}</dd></div>
      <div><dt>Abstenção</dt><dd className="tn">{pctS(abstencaoPct(r), 1)}</dd></div>
      <div><dt>Brancos e nulos</dt><dd className="tn">{pctS(brancosNulosPct(r), 1)}</dd></div>
    </dl>
  );
}

export function CardMunicipio() {
  const nav = useEstado((s) => s.nav);
  const navegar = useEstado((s) => s.navegar);
  const cat = useEstado((s) => s.catalogo);
  const geo = useGeoBrasil().dados;
  const mun = useMunicipios();
  const { semRegistro } = useAgora();
  const cargoUf = nav.cargo === 'governadores' ? 'governador' : nav.cargo === 'senado' ? 'senador' : null;
  const ufMun = useUfMunicipal(cargoUf ? nav.uf : null);
  const h22 = usePresidente2022().dados;
  const gi = geo && nav.mun ? geo.porIbge.get(nav.mun) ?? -1 : -1;
  const tse = gi >= 0 ? geo!.tse[gi] : null;
  const comZonas = useEstado((s) => s.manifesto?.municipiosComZonas);
  const temZonas = cargoUf == null && !!tse && (comZonas ?? []).includes(tse);
  const zonas = useZonas(temZonas ? tse : null);

  const cands = cargoUf ? candidatosDe(cat, cargoUf, nav.uf) : cat?.presidente ?? [];
  const rMun: Resultado | null = useMemo(() => {
    if (!tse || !cat) return null;
    const col = cargoUf ? ufMun.dados?.[cargoUf] : mun.dados;
    if (!col) return null;
    return resultadoDoItem(col, col.tse.indexOf(tse), cands);
  }, [tse, cat, cargoUf, ufMun.dados, mun.dados, cands]);
  const zonaSel = nav.zona && zonas.dados ? zonas.dados.tse.findIndex((z) => Number(z) === Number(nav.zona)) : -1;
  const rZona = zonaSel >= 0 && zonas.dados ? resultadoDoItem(zonas.dados, zonaSel, cat?.presidente ?? []) : null;
  const r = rZona ?? rMun;
  const ls = linhas(r, cands);
  const zonasLista = useMemo(() => (zonas.dados ? zonas.dados.tse.map((z, i) => ({ z, i, r: resultadoDoItem(zonas.dados!, i, cat?.presidente ?? []) })) : []), [zonas.dados, cat]);
  const pag = usePaginas(zonasLista, 4);
  const i22 = h22 && tse ? h22.municipios.tse.indexOf(tse) : -1;

  if (gi < 0 || !geo) return null;
  const nome = geo.nome[gi];
  const cargoRotulo = cargoUf === 'governador' ? 'Governador' : cargoUf === 'senador' ? 'Senado' : 'Presidente';
  return (
    <section className="card detalhe-mun grow entrada" aria-labelledby="titulo-mun">
      <button className="voltar" onClick={() => navegar({ mun: null })} aria-label={`Voltar para ${UF_NOME[nav.uf!]}`}><IconeEsq width={14} height={14} />{UF_NOME[nav.uf!]}</button>
      <div className="det-hd">
        <span className="bandeira" aria-hidden="true">{nav.uf}</span>
        <div className="det-titulo">
          <h2 id="titulo-mun" className="serif">{nome}</h2>
          <p className="f3 tn">{nav.uf} · {rMun ? `${compacto(rMun.eleitorado)} de eleitores` : semRegistro ? 'sem registro neste instante' : '—'}</p>
        </div>
        <div className="det-acoes"><button className="icone" onClick={() => navegar({ uf: null })} aria-label="Fechar o município"><IconeFechar /></button></div>
      </div>
      <Secao titulo={rZona ? `${cargoRotulo} na ${Number(nav.zona)}ª zona` : `${cargoRotulo} em ${nome}`} aside={rZona ? <button className="link" onClick={() => navegar({ zona: null })} aria-label="Voltar ao município inteiro">Município inteiro</button> : null}>
        {r ? (
          <>
            <p className="f3 tn sub">{rZona ? `${Number(nav.zona)}ª zona · ` : ''}{pctS(fracaoSecoes(r), 0)} das seções · {compacto(r.eleitorado)} eleitores</p>
            <ListaCandidatos ls={ls} cargo={cargoUf ?? 'presidente'} uf={cargoUf ? nav.uf : null} limite={cargoUf === 'senador' ? 4 : 3} votos barras />
            {rZona && <p className="f3 tn sub">Comparecimento {pctS(comparecimentoPct(rZona), 1)} · Brancos e nulos {pctS(brancosNulosPct(rZona), 1)}</p>}
          </>
        ) : <p className="carregando">{mun.carregando || ufMun.carregando ? 'Carregando o município…' : 'Sem dados deste município neste instante.'}</p>}
      </Secao>
      <Indicadores r={rMun} />
      {nav.cargo === 'presidente' && i22 >= 0 && h22 && <Linha2022 v13={h22.municipios.v13[i22]} v22={h22.municipios.v22[i22]} validos={h22.municipios.validos[i22]} />}
      {temZonas && (
        <Secao titulo="Zonas eleitorais" aside={zonasLista.length > 4 ? <Paginador {...pag} rotulo="Zonas" /> : null}>
          {zonas.carregando && !zonas.dados ? <p className="carregando">Carregando zonas…</p> : (
            <ul className="lista-zonas">
              {pag.itens.map(({ z, r: rz }) => {
                const l = linhas(rz, cat?.presidente).filter((x) => !x.anulado)[0];
                const sel = Number(z) === Number(nav.zona);
                return (
                  <li key={z}>
                    <button aria-pressed={sel} onClick={() => navegar({ zona: sel ? null : String(Number(z)) })} aria-label={`Zona ${Number(z)}${l ? `: ${l.c.nome} ${pctS(l.parcela, 1)}` : ''}, ${pctS(fracaoSecoes(rz), 0)} das seções`}>
                      <span className="chip-zona" style={{ background: l ? partido(l.c.partido).cor : '#CCC' }}>{Number(z)}</span>
                      <span className="nome"><b>{Number(z)}ª zona</b><small className="tn">{rz ? `${compacto(rz.eleitorado)} eleitores` : ''}</small></span>
                      {l && <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo="presidente" tamanho={22} />}
                      <b className="tn" style={{ color: l ? partido(l.c.partido).texto : undefined }}>{l ? pctS(l.parcela, 1) : '—'}</b>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="nota-fonte">No mapa, a área de cada zona é aproximada, pelos locais de votação — o TSE não publica limites de zona. Os resultados por zona são os arquivos oficiais do TSE.</p>
        </Secao>
      )}
      {cargoUf && <p className="nota-fonte">Zonas eleitorais disponíveis para presidente.</p>}
      <p className="sr">{num(rMun?.validos)} votos válidos</p>
    </section>
  );
}
