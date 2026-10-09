// "Ao longo da apuração": participação dos dois primeiros em função das seções totalizadas.
// Estilo inspirado na imagem de referência 1 (faixas alternadas, grade discreta e rótulo
// final em pílula na cor da candidatura).

import { useMemo } from 'react';
import { useEstado } from '../../app/store';
import { useHistoricoSerie } from '../../app/dados';
import { useAgora } from '../../data/useFeed';
import { linhas, vantagem } from '../../data/calculos';
import { partido, textoSobreCor } from '../../data/partidos';
import { pct } from '../../data/formato';
import { ordenarDupla } from './CardNacional';
import type { PontoHistorico } from '../../data/contratos';

interface Props { largura?: number; altura?: number; compacto?: boolean }

export function GraficoEvolucao({ largura = 300, altura = 118, compacto = false }: Props) {
  const catalogo = useEstado((s) => s.catalogo);
  const serie = useHistoricoSerie();
  const tNav = useEstado((s) => s.nav.t);
  const { agora } = useAgora();
  const r = agora?.presidente.br ?? null;
  const v = vantagem(linhas(r, catalogo?.presidente));
  const dupla = v ? ordenarDupla(v.lider, v.segundo) : null;
  const numeros = dupla ? dupla.filter(Boolean).map((l) => l!.c.n) : [];

  const pontos = useMemo(() => {
    const ps = [...(serie.dados?.pontos ?? [])].sort((a, b) => a.t - b.t);
    // descarta pontos fora de ordem (seções que regridem) e duplicatas
    const out: PontoHistorico[] = [];
    for (const p of ps) { if (out.length && p.totalizadas < out[out.length - 1].totalizadas) continue; if (out.length && p.totalizadas === out[out.length - 1].totalizadas) out[out.length - 1] = p; else out.push(p); }
    return tNav != null ? out.filter((p) => p.t <= tNav) : out;
  }, [serie.dados, tNav]);

  const M = { e: compacto ? 26 : 30, d: 46, t: 6, b: 18 };
  const W = largura - M.e - M.d, H = altura - M.t - M.b;
  const series = numeros.map((n) => pontos.map((p) => {
    const tot = Object.values(p.votos).reduce((a, b) => a + b, 0);
    return { x: p.secoes ? p.totalizadas / p.secoes : 0, y: tot ? (p.votos[n] ?? 0) / tot : 0 };
  }));
  const todos = series.flat().filter((p) => p.x > 0.005);
  if (pontos.length < 2 || !todos.length) {
    return <div className="grafico-vazio" style={{ height: altura }}>Aguardando pontos suficientes da apuração para desenhar a curva.</div>;
  }
  const yMin = Math.floor((Math.min(...todos.map((p) => p.y)) * 100 - 1) / 4) * 4;
  const yMax = Math.ceil((Math.max(...todos.map((p) => p.y)) * 100 + 1) / 4) * 4;
  const ticks: number[] = [];
  for (let y = yMin; y <= yMax; y += 4) ticks.push(y);
  const sx = (x: number) => M.e + x * W;
  const sy = (y: number) => M.t + H - ((y * 100 - yMin) / Math.max(1, yMax - yMin)) * H;
  const caminho = (s: { x: number; y: number }[]) => s.filter((p) => p.x > 0.005).map((p, k) => `${k ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const nomes = numeros.map((n) => catalogo?.presidente.find((c) => c.n === n));
  const finais = series.map((s) => s[s.length - 1]);
  // evita sobreposição dos rótulos finais
  const ys = finais.map((f) => (f ? sy(f.y) : 0));
  if (ys.length === 2 && Math.abs(ys[0] - ys[1]) < 15) { const m = (ys[0] + ys[1]) / 2; const d = ys[0] < ys[1] ? -1 : 1; ys[0] = m + d * 7.5; ys[1] = m - d * 7.5; }
  const descricao = `Os dois primeiros ao longo da apuração: ${nomes.map((c, k) => `${c?.nome} ${pct(finais[k]?.y, 1)}%`).join(', ')}`;

  return (
    <svg className="grafico-evolucao" width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={descricao}>
      {[0, 0.2, 0.4, 0.6, 0.8].map((x, k) => k % 2 === 0 && <rect key={x} x={sx(x)} y={M.t} width={W * 0.2} height={H} fill="var(--faixa)" opacity=".55" />)}
      {ticks.map((y) => (
        <g key={y}>
          <line x1={M.e} x2={M.e + W} y1={sy(y / 100)} y2={sy(y / 100)} stroke="var(--grade)" strokeWidth=".6" strokeDasharray={y === 50 ? '' : '2 3'} />
          <text x={M.e - 4} y={sy(y / 100) + 3.5} textAnchor="end" className="eixo">{y}%</text>
        </g>
      ))}
      <text x={M.e} y={altura - 4} className="eixo">0% das seções</text>
      <text x={sx(0.5)} y={altura - 4} textAnchor="middle" className="eixo">50%</text>
      <text x={M.e + W} y={altura - 4} textAnchor="end" className="eixo">100%</text>
      {series.map((s, k) => (
        <path key={numeros[k]} d={caminho(s)} fill="none" stroke={partido(nomes[k]?.partido ?? '').cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {finais.map((f, k) => f && (
        <g key={`f${numeros[k]}`}>
          <circle cx={sx(f.x)} cy={sy(f.y)} r="2.8" fill={partido(nomes[k]?.partido ?? '').cor} />
          <rect x={M.e + W + 5} y={ys[k] - 8} width={40} height={16} rx={4} fill={partido(nomes[k]?.partido ?? '').cor} />
          <text x={M.e + W + 25} y={ys[k] + 4} textAnchor="middle" className="rotulo-final" fill={textoSobreCor(partido(nomes[k]?.partido ?? '').cor)}>{pct(f.y, 1)}%</text>
        </g>
      ))}
    </svg>
  );
}

export function CardEvolucao({ altura = 118, largura = 300 }: { altura?: number; largura?: number } = {}) {
  const catalogo = useEstado((s) => s.catalogo);
  const { agora } = useAgora();
  const serie = useHistoricoSerie();
  const v = vantagem(linhas(agora?.presidente.br ?? null, catalogo?.presidente));
  const dupla = v ? ordenarDupla(v.lider, v.segundo) : null;
  return (
    <section className="card evolucao entrada" aria-labelledby="titulo-evolucao">
      <div className="hd"><h3 id="titulo-evolucao">Ao longo da apuração</h3></div>
      {dupla && (
        <div className="leg-linhas">
          {dupla.filter(Boolean).map((l) => <span key={l!.c.n}><i style={{ background: partido(l!.c.partido).cor }} />{l!.c.nome}</span>)}
        </div>
      )}
      <GraficoEvolucao altura={altura} largura={largura} />
      {serie.dados?.origem === 'referencia' && <p className="nota-fonte">Série registrada pela referência durante a apuração (o TSE não publica série histórica); o ponto final confere com o arquivo oficial.</p>}
      {serie.dados?.origem === 'simulacao' && <p className="nota-fonte">Série da simulação — não oficial.</p>}
    </section>
  );
}
