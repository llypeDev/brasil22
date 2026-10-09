// Ficha da candidatura: identificação, votos, situação, totalização e onde vai melhor/pior.

import { useMemo } from 'react';
import { useEstado } from '../../app/store';
import { candidatosDe, useDeputadosUf, useGeoBrasil, useUfMunicipal, UF_NOME } from '../../app/dados';
import { useAgora } from '../../data/useFeed';
import { fracaoSecoes, linhas, parcelaColunar, rotuloSituacao } from '../../data/calculos';
import { num, pct, pctS, tituloLugar } from '../../data/formato';
import { partido, textoSobreCor, siglaExibicao } from '../../data/partidos';
import { Retrato } from '../../components/Retrato';
import { IconeEsq, IconeFechar } from '../../components/Icones';
import { fecharPerfil } from './acoes';

function situacaoTexto(s: string | undefined, cargo: string) {
  switch (s) {
    case 'segundo-turno': return 'Vai ao 2º turno';
    case 'eleito': return cargo === 'senador' ? 'Eleito(a) para o Senado' : 'Eleito(a)';
    case 'eleito-qp': return 'Eleito(a) por quociente partidário';
    case 'eleito-media': return 'Eleito(a) por média';
    case 'suplente': return 'Suplente';
    case 'nao-eleito': return 'Não eleito(a)';
    case 'aguardando': return 'Aguardando';
    default: return 'Apurando';
  }
}

export function CardPerfil() {
  const perfil = useEstado((s) => s.perfil)!;
  const cat = useEstado((s) => s.catalogo);
  const navegar = useEstado((s) => s.navegar);
  const { agora } = useAgora();
  const geo = useGeoBrasil().dados;
  const majoritario = perfil.cargo !== 'deputado';
  const ufMun = useUfMunicipal(perfil.cargo === 'governador' || perfil.cargo === 'senador' ? perfil.uf : null);
  const dep = useDeputadosUf(perfil.cargo === 'deputado' ? perfil.uf : null);

  const cands = perfil.cargo === 'presidente' ? cat?.presidente ?? [] : perfil.cargo === 'deputado' ? [] : candidatosDe(cat, perfil.cargo, perfil.uf);
  const c = cands.find((x) => x.n === perfil.n);
  const r = perfil.cargo === 'presidente' ? agora?.presidente.br : perfil.cargo === 'governador' || perfil.cargo === 'senador' ? agora?.[perfil.cargo].uf[perfil.uf ?? ''] : null;
  const l = majoritario ? linhas(r, cands).find((x) => x.c.n === perfil.n) : null;

  // onde vai melhor / pior
  const lugares = useMemo(() => {
    if (!c) return null;
    if (perfil.cargo === 'presidente' && agora) {
      const lista = Object.entries(agora.presidente.uf).filter(([u]) => u !== 'ZZ').map(([u, ru]) => ({ id: u, rotulo: u, nome: UF_NOME[u], p: ru.validos ? (ru.votos[c.n] ?? 0) / ru.validos : null }))
        .filter((x) => x.p != null).sort((a, b) => b.p! - a.p!);
      return { melhor: lista.slice(0, 5), pior: lista.slice(-3).reverse(), tipo: 'uf' as const };
    }
    const col = ufMun.dados && perfil.cargo !== 'deputado' ? ufMun.dados[perfil.cargo as 'governador' | 'senador'] : null;
    if (col && geo) {
      const parc = parcelaColunar(col, col.candidatos.indexOf(c.n));
      const lista = col.tse.map((t, i) => ({ id: t, rotulo: '', nome: geo.nome[geo.porTse.get(t) ?? 0], p: Number.isNaN(parc[i]) ? null : parc[i], el: col.eleitorado[i] ?? 0 }))
        .filter((x) => x.p != null && x.el >= 5000).sort((a, b) => b.p! - a.p!);
      return { melhor: lista.slice(0, 5), pior: lista.slice(-3).reverse(), tipo: 'mun' as const };
    }
    return null;
  }, [c, perfil.cargo, agora, ufMun.dados, geo]);

  // deputado
  const casa = perfil.casa === 'f' ? dep.dados?.federal : perfil.casa === 'd' ? dep.dados?.distrital : dep.dados?.estadual;
  const linhaDep = casa?.candidatos.find((x) => x[0] === perfil.n && (!perfil.sq || x[5] === perfil.sq));
  const posicao = casa && linhaDep ? casa.candidatos.indexOf(linhaDep) + 1 : null;

  const nome = c?.nome ?? linhaDep?.[1] ?? perfil.n;
  const sigla = c?.partido ?? linhaDep?.[2] ?? '';
  const p = partido(sigla);
  const cargoRotulo = perfil.cargo === 'presidente' ? 'Presidente' : perfil.cargo === 'governador' ? `Governador · ${perfil.uf}` : perfil.cargo === 'senador' ? `Senado · ${perfil.uf}` : `${perfil.casa === 'f' ? 'Deputado(a) federal' : perfil.casa === 'd' ? 'Deputado(a) distrital' : 'Deputado(a) estadual'} · ${perfil.uf}`;
  const lugar = perfil.cargo === 'presidente' ? 'no Brasil' : `em ${UF_NOME[perfil.uf ?? ''] ?? perfil.uf}`;
  const validosCasa = casa?.totais?.validos ?? 0;

  return (
    <section className="card perfil grow entrada" aria-labelledby="titulo-perfil">
      <div className="perfil-acoes">
        <button className="voltar" onClick={fecharPerfil}><IconeEsq width={14} height={14} />Voltar</button>
        <button className="icone" onClick={fecharPerfil} aria-label="Fechar"><IconeFechar /></button>
      </div>
      <div className="perfil-hd">
        <Retrato nome={nome} sigla={sigla} sq={c?.sq ?? perfil.sq} cargo={perfil.cargo} uf={perfil.cargo === 'presidente' ? null : perfil.uf} tamanho={64} forma="quadrado" />
        <div>
          <h2 id="titulo-perfil" className="serif">{nome}</h2>
          <p><span style={{ color: p.texto }}>{siglaExibicao(sigla)} {perfil.n}</span> · {cargoRotulo}</p>
        </div>
      </div>
      {majoritario ? (
        <>
          <p className="perfil-fig"><b className="tn serif" style={{ color: p.texto }}>{pct(l?.parcela, 1)}<sup>%</sup></b><span>dos votos válidos {lugar}</span></p>
          <dl className="pares">
            <div><dt>Votos</dt><dd className="tn">{num(l?.votos)}</dd></div>
            <div><dt>Situação</dt><dd>{situacaoTexto(l?.situacao, perfil.cargo)}</dd></div>
            <div><dt>Seções apuradas</dt><dd className="tn">{pctS(fracaoSecoes(r), fracaoSecoes(r) >= 0.9995 ? 0 : 1)}</dd></div>
            {c?.vice && <div><dt>Vice</dt><dd>{c.vice}</dd></div>}
            {c?.suplentes?.length ? <div><dt>Suplentes</dt><dd>{c.suplentes.join(' · ')}</dd></div> : null}
            {c?.nomeCompleto && <div><dt>Nome completo</dt><dd>{tituloLugar(c.nomeCompleto)}</dd></div>}
          </dl>
          {lugares && (
            <div className="melhor-pior">
              <h4>Onde vai melhor</h4>
              <ul>{lugares.melhor.map((x) => <li key={x.id}><button onClick={() => x.rotulo && navegar({ uf: x.id })} disabled={!x.rotulo}>{x.rotulo && <span className="chip-uf mini" style={{ background: p.claro, color: textoSobreCor(p.claro) }}>{x.rotulo}</span>}<span className="nome">{x.nome}</span><b className="tn" style={{ color: p.texto }}>{pctS(x.p, 1)}</b></button></li>)}</ul>
              <h4>Onde vai pior</h4>
              <ul>{lugares.pior.map((x) => <li key={x.id}><button onClick={() => x.rotulo && navegar({ uf: x.id })} disabled={!x.rotulo}>{x.rotulo && <span className="chip-uf mini" style={{ background: '#E4E4E1' }}>{x.rotulo}</span>}<span className="nome">{x.nome}</span><b className="tn">{pctS(x.p, 1)}</b></button></li>)}</ul>
              {lugares.tipo === 'mun' && <p className="nota-fonte">Municípios com pelo menos 5 mil eleitores.</p>}
            </div>
          )}
        </>
      ) : (
        <>
          {dep.carregando && !dep.dados ? <p className="carregando">Carregando…</p> : linhaDep ? (
            <>
              <p className="perfil-fig"><b className="tn serif" style={{ color: p.texto }}>{num(linhaDep[3])}</b><span>votos {lugar}</span></p>
              <dl className="pares">
                <div><dt>Situação</dt><dd>{situacaoTexto(linhaDep[4], 'deputado')}</dd></div>
                <div><dt>Posição na UF</dt><dd className="tn">{posicao}º de {num(casa?.candidatos.length)}</dd></div>
                <div><dt>Parcela dos válidos</dt><dd className="tn">{validosCasa ? pctS(linhaDep[3] / validosCasa, 2) : '—'}</dd></div>
                <div><dt>Cadeiras do partido</dt><dd className="tn">{casa?.partidos[sigla]?.cadeiras ?? 0} de {casa?.vagas}</dd></div>
              </dl>
              <p className="nota">{rotuloSituacao(linhaDep[4]) ? 'Situação oficial do TSE.' : 'A situação só é definida ao fim da totalização.'} Em eleições proporcionais, a votação individual não determina sozinha a eleição: valem o quociente partidário e as médias.</p>
            </>
          ) : <p className="carregando">Candidatura não encontrada neste conjunto.</p>}
        </>
      )}
    </section>
  );
}
