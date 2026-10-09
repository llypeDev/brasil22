// Componentes de composição: hemiciclo, barra ideológica, grade de UFs e paginação.

import { useMemo, useState, type ReactNode } from 'react';
import { CENTRAO, ESCALA_IDEOLOGICA, NOTA_IDEOLOGIA, bloco, chavePartido, partido, siglaExibicao, COR_CENTRAO } from '../data/partidos';
import { misturar } from '../map/cores';
import { num } from '../data/formato';
import { IconeDir, IconeEsq } from './Icones';

export interface Assento { partido: string | null; definido: boolean }

/** Ordem dos partidos no hemiciclo: esquerda → Centrão → sem classificação → direita. */
export function ordemPartido(sigla: string | null) {
  if (!sigla) return 5.0001;
  const k = chavePartido(sigla);
  if (CENTRAO.has(k)) return 5 + (ESCALA_IDEOLOGICA[k] ?? 7) / 100;
  const v = ESCALA_IDEOLOGICA[k];
  return v == null ? 5.5 : v < 5 ? v : 6 + v;
}

/** Posições de assentos em fileiras concêntricas (ângulo de π a 0), preenchidas em leque. */
export function posicoesHemiciclo(total: number, fileiras: number, raioInterno: number) {
  const raios = Array.from({ length: fileiras }, (_, k) => raioInterno + ((1 - raioInterno) * k) / Math.max(1, fileiras - 1));
  const somaR = raios.reduce((a, b) => a + b, 0);
  const porFileira = raios.map((r) => Math.round((total * r) / somaR));
  let dif = total - porFileira.reduce((a, b) => a + b, 0);
  for (let k = fileiras - 1; dif !== 0; k = (k - 1 + fileiras) % fileiras) { porFileira[k] += Math.sign(dif); dif -= Math.sign(dif); }
  const pos: { r: number; a: number }[] = [];
  raios.forEach((r, k) => { for (let i = 0; i < porFileira[k]; i++) pos.push({ r, a: Math.PI * (1 - (i + 0.5) / porFileira[k]) }); });
  return pos.sort((x, y) => y.a - x.a || x.r - y.r);
}

export function Hemiciclo({ assentos, fileiras, raioInterno, forma = 'ponto', centro, rotulo }: { assentos: Assento[]; fileiras: number; raioInterno: number; forma?: 'ponto' | 'retangulo'; centro?: ReactNode; rotulo: string }) {
  const pos = useMemo(() => posicoesHemiciclo(assentos.length, fileiras, raioInterno), [assentos.length, fileiras, raioInterno]);
  const ordenados = useMemo(() => [...assentos].sort((a, b) => ordemPartido(a.partido) - ordemPartido(b.partido) || Number(b.definido) - Number(a.definido)), [assentos]);
  const R = 144, cx = 150, cy = 148;
  const tam = forma === 'ponto' ? Math.max(1.6, Math.min(4.2, 300 / Math.sqrt(assentos.length) / 6.2)) : 0;
  return (
    <div className="hemiciclo">
      <svg viewBox="0 0 300 152" role="img" aria-label={rotulo}>
        {pos.map((p, i) => {
          const a = ordenados[i];
          const cor = !a?.partido ? '#D7D7D4' : a.definido ? partido(a.partido).cor : misturar(partido(a.partido).cor, '#FFFFFF', 0.55);
          const x = cx + R * p.r * Math.cos(p.a), y = cy - R * p.r * Math.sin(p.a);
          return forma === 'ponto'
            ? <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r={tam} fill={cor} />
            : <rect key={i} x={(x - 6.5).toFixed(2)} y={(y - 5).toFixed(2)} width="13" height="10" rx="2.5" fill={cor} transform={`rotate(${(90 - (p.a * 180) / Math.PI).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`} />;
        })}
      </svg>
      {centro && <div className="hemiciclo-centro">{centro}</div>}
    </div>
  );
}

/** Barra esquerda · Centrão · direita. Blocos não exclusivos de outro eixo ficam explicados na nota. */
export function BarraIdeologica({ assentos, maioria, total }: { assentos: Assento[]; maioria: number; total: number }) {
  const conta = { e: 0, el: 0, c: 0, cl: 0, d: 0, dl: 0 };
  for (const a of assentos) {
    if (!a.partido) continue;
    const b = bloco(a.partido);
    if (!b) continue;
    if (b === 'e') a.definido ? conta.e++ : conta.el++;
    else if (b === 'c') a.definido ? conta.c++ : conta.cl++;
    else a.definido ? conta.d++ : conta.dl++;
  }
  const resto = Math.max(0, total - conta.e - conta.el - conta.c - conta.cl - conta.d - conta.dl);
  const pt = partido('PT').cor, pl = partido('PL').cor;
  return (
    <div className="ideologia" title={NOTA_IDEOLOGIA}>
      <div className="ideo-numeros">
        <span className="il"><span>Esquerda</span><b className="tn">{num(conta.e + conta.el)}</b></span>
        <span className="ic"><span>Centrão</span><b className="tn">{num(conta.c + conta.cl)}</b></span>
        <span className="ir"><b className="tn">{num(conta.d + conta.dl)}</b><span>Direita</span></span>
      </div>
      <div className="ibar" aria-hidden="true">
        <i style={{ flexGrow: conta.e, background: pt }} /><i style={{ flexGrow: conta.el, background: misturar(pt, '#FFFFFF', 0.55) }} />
        <i style={{ flexGrow: conta.c, background: COR_CENTRAO }} /><i style={{ flexGrow: conta.cl, background: misturar(COR_CENTRAO, '#FFFFFF', 0.55) }} />
        <i style={{ flexGrow: resto, background: '#E2E2DF' }} />
        <i style={{ flexGrow: conta.dl, background: misturar(pl, '#FFFFFF', 0.55) }} /><i style={{ flexGrow: conta.d, background: pl }} />
        <em style={{ left: `${(maioria / total) * 100}%` }} />
      </div>
      <p className="imaj">maioria {num(maioria)} · Centrão: PP, União Brasil, PSD, Republicanos e MDB</p>
      <p className="sr">{NOTA_IDEOLOGIA}</p>
    </div>
  );
}

/** Legenda de bancadas: maiores partidos + outros. */
export function LegendaBancadas({ contagem, max = 5, extra }: { contagem: [string, number][]; max?: number; extra?: ReactNode }) {
  const outros = contagem.slice(max).reduce((s, [, n]) => s + n, 0);
  return (
    <p className="legenda-bancadas">
      {contagem.slice(0, max).map(([p, n]) => <span key={p}><i style={{ background: partido(p).cor }} />{siglaExibicao(p)} <b className="tn">{num(n)}</b></span>)}
      {outros > 0 && <span><i style={{ background: '#C9C9C6' }} />Outros <b className="tn">{num(outros)}</b></span>}
      {extra}
    </p>
  );
}

export interface ChipUf { uf: string; cores: string[]; aria: string; rotulo?: string }
export function GradeUfs({ chips, aoEscolher, selecionada }: { chips: ChipUf[]; aoEscolher: (uf: string) => void; selecionada?: string | null }) {
  return (
    <div className="grade-ufs">
      {chips.map((c) => (
        <button key={c.uf} className={`chip-uf ${c.uf === selecionada ? 'sel' : ''}`} onClick={() => aoEscolher(c.uf)} aria-label={c.aria}
          style={{ background: c.cores.length > 1 ? `linear-gradient(135deg, ${c.cores[0]} 50%, ${c.cores[1]} 50%)` : c.cores[0] ?? '#E4E4E1' }}>
          {c.rotulo ?? c.uf}
        </button>
      ))}
    </div>
  );
}

export function usePaginas<T>(itens: T[], porPagina: number) {
  const [pagina, setPagina] = useState(0);
  const total = Math.max(1, Math.ceil(itens.length / porPagina));
  const p = Math.min(pagina, total - 1);
  return { pagina: p, total, itens: itens.slice(p * porPagina, (p + 1) * porPagina), anterior: () => setPagina(Math.max(0, p - 1)), proxima: () => setPagina(Math.min(total - 1, p + 1)) };
}

export function Paginador({ pagina, total, anterior, proxima, rotulo }: { pagina: number; total: number; anterior: () => void; proxima: () => void; rotulo: string }) {
  return (
    <span className="paginador">
      <button className="icone" onClick={anterior} disabled={pagina === 0} aria-label={`${rotulo} anteriores`}><IconeEsq /></button>
      <span className="tn">{pagina + 1}/{total}</span>
      <button className="icone" onClick={proxima} disabled={pagina >= total - 1} aria-label={`Próximas ${rotulo.toLowerCase()}`}><IconeDir /></button>
    </span>
  );
}
