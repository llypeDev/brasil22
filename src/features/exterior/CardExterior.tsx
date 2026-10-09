// Exterior → país → cidade. Só há votação para presidente fora do Brasil.
// Fechamento das urnas: 17h no fuso local da cidade em 04/10/2026, exibido em Brasília.

import { useMemo } from 'react';
import { useEstado } from '../../app/store';
import { useExterior, useGeoMundo, usePresidente2022 } from '../../app/dados';
import { useAgora } from '../../data/useFeed';
import { fracaoSecoes, linhas, resultadoDoItem, somarItens } from '../../data/calculos';
import { compacto, num, pctS, tituloLugar } from '../../data/formato';
import { partido, textoSobreCor } from '../../data/partidos';
import { ListaCandidatos, Secao } from '../../components/Candidatos';
import { Retrato } from '../../components/Retrato';
import { IconeEsq, IconeFechar, IconeGlobo } from '../../components/Icones';
import { SeloDisputa } from '../geografia/CardUf';
import { Linha2022 } from '../geografia/CardMunicipio';
import type { Resultado } from '../../data/contratos';

/** Instante absoluto em que as urnas fecham (17h locais) e o horário correspondente em Brasília. */
export function fechamentoEmBrasilia(fuso: string | undefined, data = '2026-10-04') {
  if (!fuso) return null;
  try {
    const base = Date.parse(`${data}T17:00:00Z`);
    const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(base)).map((p) => [p.type, p.value]));
    const deslocMin = (Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute) - base) / 60000;
    const instante = new Date(base - deslocMin * 60000); // 17h locais em UTC
    const br = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', day: '2-digit', month: '2-digit' }).formatToParts(instante);
    const g = Object.fromEntries(br.map((p) => [p.type, p.value]));
    const hh = Number(g.hour), mm = g.minute;
    const dia = `${g.day}/${g.month}`;
    return { instante, texto: `${hh}h${mm !== '00' ? mm : ''}`, outroDia: dia !== '04/10' ? dia : null };
  } catch { return null; }
}

export function CardExterior() {
  const nav = useEstado((s) => s.nav);
  const navegar = useEstado((s) => s.navegar);
  const cat = useEstado((s) => s.catalogo);
  const { agora } = useAgora();
  const mundo = useGeoMundo(true).dados;
  const ext = useExterior(true);
  const h22 = usePresidente2022().dados;
  const col = ext.dados?.cidades;
  const cidadesDoPais = useMemo(() => (mundo && nav.pais ? mundo.cidades.filter((c) => c.pais === nav.pais) : []), [mundo, nav.pais]);
  const pais = nav.pais ? mundo?.porIso.get(nav.pais) : null;
  const cidade = nav.cidade ? mundo?.cidadePorTse.get(nav.cidade) : null;
  const cands = cat?.presidente ?? [];

  let r: Resultado | null = null;
  if (nav.cidade && col) r = resultadoDoItem(col, col.tse.indexOf(nav.cidade), cands);
  else if (nav.pais && col) r = somarItens(col, cidadesDoPais.map((c) => col.tse.indexOf(c.tse)).filter((i) => i >= 0), cands);
  else r = agora?.presidente.zz ?? null;
  const ls = linhas(r, cands);

  const paises = useMemo(() => {
    if (!mundo || !col) return [];
    const m = new Map<string, number[]>();
    mundo.cidades.forEach((c) => { const i = col.tse.indexOf(c.tse); if (i >= 0) { if (!m.has(c.pais)) m.set(c.pais, []); m.get(c.pais)!.push(i); } });
    return [...m.entries()].map(([iso, idx]) => ({ iso, nome: mundo.porIso.get(iso)?.nome ?? (iso === 'GF' ? 'Guiana Francesa' : iso), idx, r: somarItens(col, idx, cands) })).sort((a, b) => (b.r?.eleitorado ?? 0) - (a.r?.eleitorado ?? 0));
  }, [mundo, col, cands]);

  const titulo = cidade ? tituloLugar(cidade.nome) : pais ? pais.nome : nav.pais === 'GF' ? 'Guiana Francesa' : 'Exterior';
  const voltar = nav.cidade ? { rotulo: pais?.nome ?? cidade?.paisNome ?? 'País', acao: () => navegar({ cidade: null, pais: cidade?.pais ?? nav.pais }) } : nav.pais ? { rotulo: 'Exterior', acao: () => navegar({ pais: null }) } : null;
  const fech = cidade ? fechamentoEmBrasilia(cidade.fuso) : null;
  const i22 = h22 && nav.cidade ? h22.municipios.tse.indexOf(nav.cidade) : -1;
  const ref22 = !nav.pais && !nav.cidade ? h22?.ufs.ZZ : null;

  return (
    <section className="card exterior grow entrada" aria-labelledby="titulo-ext">
      {voltar && <button className="voltar" onClick={voltar.acao}><IconeEsq width={14} height={14} />{voltar.rotulo}</button>}
      <div className="det-hd">
        <span className="bandeira" aria-hidden="true">{nav.cidade ? cidade?.pais : nav.pais ?? <IconeGlobo />}</span>
        <div className="det-titulo">
          <h2 id="titulo-ext" className="serif">{titulo}</h2>
          <p className="f3 tn">{cidade ? `${pais?.nome ?? cidade.paisNome} · ${r ? `${compacto(r.eleitorado)} eleitores` : '—'}` : r ? `${pctS(fracaoSecoes(r), 0)} das seções · ${compacto(r.eleitorado)} eleitores` : '—'}</p>
        </div>
        <div className="det-acoes"><button className="icone" onClick={() => navegar({ zz: false })} aria-label="Fechar o exterior"><IconeFechar /></button></div>
      </div>
      <Secao titulo={nav.cidade || nav.pais ? 'Presidente' : 'Presidente no exterior'} aside={<SeloDisputa r={r && { ...r, situacao: fracaoSecoes(r) >= 1 ? 'concluida' : r.situacao }} />}>
        {cidade && fech && <p className="f3 sub">As urnas fecharam às {fech.texto}{fech.outroDia ? ` de ${fech.outroDia}` : ''}, no horário de Brasília · {r ? `${num(r.totalizadas)} de ${num(r.secoes)} seções` : ''}</p>}
        {r ? <ListaCandidatos ls={ls} cargo="presidente" uf={null} limite={cidade ? 4 : 3} votos={!!cidade} barras={!!cidade} /> : <p className="carregando">{ext.carregando ? 'Carregando…' : 'Sem dados.'}</p>}
        {i22 >= 0 && h22 && <Linha2022 v13={h22.municipios.v13[i22]} v22={h22.municipios.v22[i22]} validos={h22.municipios.validos[i22]} />}
        {ref22 && <Linha2022 v13={ref22.votos['13'] ?? 0} v22={ref22.votos['22'] ?? 0} validos={ref22.validos} />}
      </Secao>
      {!nav.pais && !nav.cidade && (
        <Secao titulo="Por país" aside={<span className="aside">{paises.length} países</span>}>
          <ul className="lista-lugares">
            {paises.map((p) => {
              const l = linhas(p.r, cands).filter((x) => !x.anulado)[0];
              return (
                <li key={p.iso}>
                  <button onClick={() => navegar({ pais: p.iso })} aria-label={`${p.nome}: ${l ? `${l.c.nome} ${pctS(l.parcela, 1)}` : 'sem dados'}`}>
                    <span className="chip-pais" style={{ background: l ? partido(l.c.partido).cor : '#CCC', color: textoSobreCor(l ? partido(l.c.partido).cor : '#CCC') }}>{p.iso}</span>
                    <span className="nome"><b>{p.nome}</b><small className="tn">{p.idx.length} {p.idx.length === 1 ? 'cidade' : 'cidades'} · {compacto(p.r?.eleitorado)} eleitores</small></span>
                    {l && <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo="presidente" tamanho={22} />}
                    <b className="tn" style={{ color: l ? partido(l.c.partido).texto : undefined }}>{l ? pctS(l.parcela, 1) : '—'}</b>
                  </button>
                </li>
              );
            })}
          </ul>
        </Secao>
      )}
      {nav.pais && !nav.cidade && col && (
        <Secao titulo="Cidades">
          <ul className="lista-lugares">
            {cidadesDoPais.map((c) => ({ c, r: resultadoDoItem(col, col.tse.indexOf(c.tse), cands) })).sort((a, b) => (b.r?.eleitorado ?? 0) - (a.r?.eleitorado ?? 0)).map(({ c, r: rc }) => {
              const l = linhas(rc, cands).filter((x) => !x.anulado)[0];
              const f = fechamentoEmBrasilia(c.fuso);
              return (
                <li key={c.tse}>
                  <button onClick={() => navegar({ cidade: c.tse, pais: c.pais })} aria-label={`${tituloLugar(c.nome)}: ${l ? `${l.c.nome} ${pctS(l.parcela, 1)}` : 'sem dados'}`}>
                    <span className="chip-pais" style={{ background: l ? partido(l.c.partido).cor : '#CCC', color: textoSobreCor(l ? partido(l.c.partido).cor : '#CCC') }}>{c.pais}</span>
                    <span className="nome"><b>{tituloLugar(c.nome)}</b><small className="tn">{f ? `fecha às ${f.texto}` : ''} · {compacto(rc?.eleitorado)} eleitores</small></span>
                    {l && <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo="presidente" tamanho={22} />}
                    <b className="tn" style={{ color: l ? partido(l.c.partido).texto : undefined }}>{l ? pctS(l.parcela, 1) : '—'}</b>
                  </button>
                </li>
              );
            })}
          </ul>
        </Secao>
      )}
      <p className="nota-fonte">Fora do Brasil, só se vota para presidente. Coordenadas das cidades: Natural Earth; fusos: limites oficiais (tz database).</p>
    </section>
  );
}
