import type { ReactNode } from 'react';
import { partido, siglaExibicao } from '../data/partidos';
import { num, pctS } from '../data/formato';
import { eleito, rotuloSituacao, type Linha } from '../data/calculos';
import { Retrato, type CargoFoto } from './Retrato';
import { BarraParcela } from './Barra';
import { abrirPerfil } from '../features/perfil/acoes';

interface Props {
  ls: Linha[];
  cargo: CargoFoto;
  uf: string | null;
  limite?: number;
  votos?: boolean;
  barras?: boolean;
  situacao?: boolean;
  casasDecimais?: number;
}

/** Lista de candidaturas com retrato, partido, parcela e (opcional) votos e situação. */
export function ListaCandidatos({ ls, cargo, uf, limite = 3, votos = false, barras = false, situacao = false, casasDecimais = 1 }: Props) {
  const validos = ls.filter((l) => !l.anulado).slice(0, limite);
  return (
    <ul className="lista-cand">
      {validos.map((l) => {
        const p = partido(l.c.partido);
        const sit = situacao ? rotuloSituacao(l.situacao) : null;
        return (
          <li key={l.c.n}>
            <button onClick={() => abrirPerfil({ cargo: cargo === 'deputado' ? 'deputado' : cargo, uf, n: l.c.n, sq: l.c.sq })} aria-label={`Ver ${l.c.nome}`}>
              <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo={cargo} uf={uf} tamanho={30} />
              <span className="nome"><b>{l.c.nome}</b><small style={{ color: p.texto }}>{siglaExibicao(l.c.partido)} {l.c.n}</small></span>
              {sit && eleito(l.situacao) ? <span className="selo forte mini"><i className="ponto" />{sit}</span> : sit === '2º turno' ? <span className="selo mini">2º turno</span> : null}
              <span className="valor"><b className="tn">{pctS(l.parcela, casasDecimais)}</b>{votos && <small className="tn">{num(l.votos)}</small>}</span>
              {barras && <BarraParcela parcela={l.parcela} sigla={l.c.partido} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Candidaturas anuladas: votos mostrados à parte, fora dos válidos. */
export function Anulados({ ls, cargo, uf }: { ls: Linha[]; cargo: CargoFoto; uf: string | null }) {
  const an = ls.filter((l) => l.anulado);
  if (!an.length) return null;
  return (
    <ul className="lista-anulados">
      {an.map((l) => (
        <li key={l.c.n}>
          <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo={cargo} uf={uf} tamanho={22} />
          <span className="nome">{l.c.nome}</span>
          <span className="tag-neutra">Votos anulados</span>
          <span className="tn">{num(l.votos)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Secao({ titulo, aside, children, id }: { titulo: ReactNode; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <div className="secao" id={id}>
      <div className="secao-hd"><h4>{titulo}</h4>{aside}</div>
      {children}
    </div>
  );
}
