// Lista completa de candidaturas (majoritárias) ou de deputados, com filtro e paginação
// incremental — não monta milhares de linhas com fotos de uma vez.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEstado } from '../../app/store';
import { candidatosDe, useDeputadosBr, useDeputadosUf, UF_NOME } from '../../app/dados';
import { useAgora } from '../../data/useFeed';
import { eleito, linhas, rotuloSituacao } from '../../data/calculos';
import { normalizar, num, pctS } from '../../data/formato';
import { partido, siglaExibicao } from '../../data/partidos';
import { Modal } from '../../components/Modal';
import { Retrato } from '../../components/Retrato';
import { IconeFechar } from '../../components/Icones';
import { abrirPerfil } from '../perfil/acoes';
import type { RankingLegislativo } from '../../data/contratos';

export function ListaCompleta() {
  const lista = useEstado((s) => s.lista);
  const set = useEstado((s) => s.set);
  const fechar = () => set({ lista: null });
  return (
    <Modal aberto={!!lista} aoFechar={fechar} rotulo="Lista completa" className="lista-completa">
      {lista?.tipo === 'candidatos' && <Majoritaria cargo={lista.cargo} uf={lista.uf} fechar={fechar} />}
      {lista?.tipo === 'deputados' && <Deputados casa={lista.casa} uf={lista.uf} fechar={fechar} />}
    </Modal>
  );
}

function Majoritaria({ cargo, uf, fechar }: { cargo: 'presidente' | 'governador' | 'senador'; uf: string | null; fechar: () => void }) {
  const cat = useEstado((s) => s.catalogo);
  const { agora } = useAgora();
  const r = cargo === 'presidente' ? (uf ? agora?.presidente.uf[uf] : agora?.presidente.br) : uf ? agora?.[cargo].uf[uf] : null;
  const ls = linhas(r ?? null, candidatosDe(cat, cargo, uf));
  const titulo = cargo === 'presidente' ? 'Presidente' : cargo === 'governador' ? 'Governador' : 'Senado';
  return (
    <>
      <div className="lc-hd">
        <div><h2 className="serif">{titulo} · {uf ? UF_NOME[uf] : 'Brasil'}</h2><p className="f3">Todos os {ls.length} candidatos · parcelas sobre {num(r?.validos)} votos válidos</p></div>
        <button className="icone" onClick={fechar} aria-label="Fechar a lista"><IconeFechar /></button>
      </div>
      <table className="tabela">
        <thead><tr><th scope="col">Candidatura</th><th scope="col" className="num">Votos</th><th scope="col" className="num">%</th><th scope="col">Situação</th></tr></thead>
        <tbody>
          {ls.map((l) => (
            <tr key={l.c.n} className={l.anulado ? 'anulado' : ''}>
              <td><button className="lc-cand" onClick={() => { fechar(); abrirPerfil({ cargo, uf, n: l.c.n, sq: l.c.sq }); }}>
                <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo={cargo} uf={uf} tamanho={26} />
                <span><b>{l.c.nome}</b><small style={{ color: partido(l.c.partido).texto }}>{siglaExibicao(l.c.partido)} {l.c.n}</small></span>
              </button></td>
              <td className="num tn">{num(l.votos)}</td>
              <td className="num tn">{l.anulado ? '—' : pctS(l.parcela, 2)}</td>
              <td>{l.anulado ? <span className="tag-neutra">Votos anulados</span> : rotuloSituacao(l.situacao) ?? 'apurando'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nota-fonte">Candidaturas anuladas (sub judice) aparecem com os votos recebidos, fora do denominador dos válidos. Situação oficial do TSE.</p>
    </>
  );
}

function Deputados({ casa, uf, fechar }: { casa: 'f' | 'e'; uf: string | null; fechar: () => void }) {
  const br = useDeputadosBr(!uf);
  const duf = useDeputadosUf(uf);
  const [filtro, setFiltro] = useState('');
  const [limite, setLimite] = useState(60);
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => { setLimite(60); }, [filtro]);
  const todos: RankingLegislativo[] = useMemo(() => {
    if (uf && duf.dados) {
      const c = casa === 'f' ? duf.dados.federal : uf === 'DF' ? duf.dados.distrital : duf.dados.estadual;
      const cod = casa === 'f' ? 'f' : uf === 'DF' ? 'd' : 'e';
      return (c?.candidatos ?? []).map((x) => [x[0], x[1], x[2], uf, cod, x[3], x[4], x[5]] as RankingLegislativo);
    }
    return (casa === 'f' ? br.dados?.federal.ranking : br.dados?.estadual.ranking) ?? [];
  }, [uf, duf.dados, br.dados, casa]);
  const q = normalizar(filtro);
  const filtrados = q ? todos.filter((r) => normalizar(`${r[1]} ${r[0]} ${r[2]} ${r[3]}`).includes(q)) : todos;
  const total = uf ? todos.length : casa === 'f' ? br.dados?.federal.totalCandidatos : br.dados?.estadual.totalCandidatos;
  return (
    <>
      <div className="lc-hd">
        <div><h2 className="serif">{casa === 'f' ? 'Deputados federais' : uf === 'DF' ? 'Deputados distritais' : 'Deputados estaduais'} · {uf ? UF_NOME[uf] : 'Brasil'}</h2>
          <p className="f3">{uf ? `${num(total)} candidaturas` : `${num(todos.length)} mais votados de ${num(total)} candidaturas · use a busca para encontrar qualquer uma`}</p></div>
        <button className="icone" onClick={fechar} aria-label="Fechar a lista"><IconeFechar /></button>
      </div>
      <input ref={entrada} className="lc-filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por nome, número, partido ou UF" aria-label="Filtrar candidaturas" />
      <ol className="ranking lc-ranking">
        {filtrados.slice(0, limite).map((r, k) => (
          <li key={`${r[3]}-${r[4]}-${r[0]}-${r[7]}`}>
            <button onClick={() => { fechar(); abrirPerfil({ cargo: 'deputado', uf: r[3], n: r[0], sq: r[7], casa: r[4] }); }}>
              <span className="pos tn">{todos.indexOf(r) + 1}</span>
              <Retrato nome={r[1]} sigla={r[2]} sq={r[7]} cargo="deputado" uf={r[3]} tamanho={26} />
              <span className="nome"><b>{r[1]}</b><small style={{ color: partido(r[2]).texto }}>{siglaExibicao(r[2])} {r[0]} · {r[3]}</small></span>
              <span className="valor"><b className="tn">{num(r[5])}</b>{eleito(r[6]) ? <em className="tag-eleito">{rotuloSituacao(r[6])}</em> : <em className="tag-neutra">{rotuloSituacao(r[6]) ?? 'apurando'}</em>}</span>
            </button>
            {k === limite - 1 && null}
          </li>
        ))}
      </ol>
      {filtrados.length > limite && <button className="btn largo" onClick={() => setLimite((l) => l + 120)}>Mostrar mais ({num(filtrados.length - limite)})</button>}
      {!filtrados.length && <p className="carregando">{br.carregando || duf.carregando ? 'Carregando…' : 'Nenhuma candidatura com esse filtro.'}</p>}
      <p className="nota-fonte">A ordem é por votos. Eleição proporcional: a situação (eleito por QP, por média, suplente) é a oficial do TSE, não a posição na lista.</p>
    </>
  );
}
