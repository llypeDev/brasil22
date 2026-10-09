// Linha do tempo: consulta a instantes passados e retorno ao acompanhamento atual.
//
// O controle escolhe o registro mais recente ANTERIOR OU IGUAL ao instante pedido (índice de
// snapshots + série agregada). Novos lotes ao vivo não alteram o instante escolhido. A
// escala atravessa dias: minutos desde 00:00 de 04/10 podem passar de 1.440.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEstado } from '../../app/store';
import { useEventos, useIndice } from '../../app/dados';
import { horaCurta, horaDe, num, relogio } from '../../data/formato';
import { IconePausa, IconePlay } from '../../components/Icones';

const INICIO_ELEICAO = Date.parse('2026-10-04T00:00:00-03:00');
const minutosAgora = () => Math.floor((Date.now() - INICIO_ELEICAO) / 60000);

export { registroAte } from './registro';
import { registroAte } from './registro';

export function useControleTempo() {
  const modo = useEstado((s) => s.modo);
  const agoraVivo = useEstado((s) => s.agoraVivo);
  const tNav = useEstado((s) => s.nav.t);
  const indice = useIndice().dados;
  const pontos = useMemo(() => [...new Set([...(indice?.snapshots ?? []), ...(indice?.agregados ?? [])])].sort((a, b) => a - b), [indice]);
  const ultimoSnapshot = indice?.snapshots.length ? indice.snapshots[indice.snapshots.length - 1] : agoraVivo?.t ?? null;
  const tVivo = agoraVivo?.t ?? null;
  const br = agoraVivo?.presidente.br;
  // durante a divulgação a escala cresce com o relógio; concluída, termina no resultado final
  const concluida = !!br && br.secoes > 0 && br.totalizadas >= br.secoes;
  const fim = modo === 'oficial' && !concluida ? Math.max(tVivo ?? 0, minutosAgora()) : Math.max(tVivo ?? 1020, (pontos[pontos.length - 1] ?? 1020));
  const inicio = Math.min(1020, pontos[0] ?? 1020);
  const escolher = (t: number | null) => {
    const s = useEstado.getState();
    if (t == null) { s.navegar({ t: null }); return; }
    const r = registroAte(t, pontos);
    if (r == null) { s.navegar({ t: Math.max(inicio, Math.round(t)) }); return; }
    if (ultimoSnapshot != null && r >= ultimoSnapshot) { s.navegar({ t: null }); return; }
    s.navegar({ t: r });
  };
  return { inicio, fim, pontos, tNav, tVivo, escolher, ultimoSnapshot };
}

export function LinhaDoTempo({ compacta = false }: { compacta?: boolean }) {
  const { inicio, fim, pontos, tNav, tVivo, escolher } = useControleTempo();
  const modo = useEstado((s) => s.modo);
  const pessoas = useEstado((s) => s.pessoas);
  const tocando = useEstado((s) => s.tocando);
  const set = useEstado((s) => s.set);
  const eventos = useEventos().dados?.eventos ?? [];
  const [previa, setPrevia] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const trilho = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(600);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { const id = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    const el = trilho.current; if (!el) return;
    const o = new ResizeObserver(() => setLargura(el.getBoundingClientRect().width));
    o.observe(el);
    return () => o.disconnect();
  }, []);

  // reprodução: percorre os registros a partir do instante atual
  useEffect(() => {
    if (!tocando) return;
    const id = setInterval(() => {
      const s = useEstado.getState();
      const t0 = s.nav.t ?? pontos[0] ?? inicio;
      const prox = pontos.find((p) => p > t0 + 2);
      if (prox == null || (tVivo != null && prox >= tVivo)) { s.set({ tocando: false }); s.navegar({ t: null }); return; }
      s.navegar({ t: prox });
    }, 650);
    return () => clearInterval(id);
  }, [tocando, pontos, inicio, tVivo]);

  const valor = previa ?? tNav ?? fim;
  const pos = (t: number) => `${((Math.min(fim, Math.max(inicio, t)) - inicio) / Math.max(1, fim - inicio)) * 100}%`;
  const ticks = useMemo(() => {
    // passo legível para a largura disponível, alinhado às 17h do dia da eleição
    const cabem = Math.max(2, Math.floor(Math.max(200, largura) / 40));
    const passo = [60, 120, 180, 240, 360, 720, 1440, 2880].find((p) => (fim - inicio) / p <= cabem) ?? 2880;
    const deslocamento = ((1020 % passo) + passo) % passo;
    const out: { t: number; rotulo: string }[] = [];
    for (let t = Math.ceil((inicio - deslocamento) / passo) * passo + deslocamento; t <= fim; t += passo) {
      out.push({ t, rotulo: passo >= 1440 ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(INICIO_ELEICAO + t * 60000)) : horaCurta(t) });
    }
    return out;
  }, [inicio, fim, largura]);
  const marcas = eventos.filter((e) => e.tipo === 'definicao' && e.cargo === 'presidente' && e.uf === 'BR');
  const fimDados = pontos[pontos.length - 1];

  const mudar = (v: number) => {
    setPrevia(v);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => { setPrevia(null); escolher(v >= fim - 1 ? null : v); }, 140);
  };
  const ao_vivo = tNav == null;
  const textoValor = `${horaDe(valor)}${valor >= 1440 ? ` de ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(INICIO_ELEICAO + valor * 60000))}` : ''}${ao_vivo ? ', ao vivo' : ''}`;

  return (
    <div className={`linha-tempo ${compacta ? 'compacta' : ''} ${ao_vivo ? 'ao-vivo' : 'passado'}`}>
      {!compacta && <span className="relogio tn" aria-hidden="true">{modo === 'simulacao' ? `${horaDe(tVivo ?? 0)} · sim.` : relogio(agora)}</span>}
      <button className="icone" onClick={() => { if (!tocando && tNav == null) set({ tocando: true }); else set({ tocando: !tocando }); if (!tocando && tNav == null) useEstado.getState().navegar({ t: pontos[0] ?? inicio }); }} aria-label={tocando ? 'Pausar a reprodução' : 'Reproduzir a apuração'} aria-pressed={tocando}>
        {tocando ? <IconePausa /> : <IconePlay />}
      </button>
      <div className="trilho" ref={trilho}>
        <div className="trilho-dados" style={{ width: fimDados != null ? pos(fimDados) : '0%' }} aria-hidden="true" />
        {marcas.map((m) => (
          <button key={m.id} className="marca-evento" style={{ left: pos(m.t) }} onClick={() => escolher(m.t)} aria-label={`2º turno definido às ${horaDe(m.t)}`} title={`2º turno definido às ${horaDe(m.t)}`} />
        ))}
        <input type="range" min={inicio} max={fim} step={1} value={valor} onChange={(e) => mudar(Number(e.target.value))}
          aria-label="Hora da apuração" aria-valuetext={textoValor} />
        <div className="ticks" aria-hidden="true">{ticks.map((k) => <span key={k.t} style={{ left: pos(k.t) }}>{k.rotulo}</span>)}</div>
      </div>
      {!compacta && pessoas != null && <span className="pessoas" aria-label={`${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'} com a página aberta agora`}><b className="tn">{num(pessoas)}</b> {pessoas === 1 ? 'pessoa' : 'pessoas'} agora</span>}
      <button className={`btn ao-vivo-btn ${ao_vivo ? 'ativo' : ''}`} onClick={() => { set({ tocando: false }); escolher(null); }} aria-pressed={ao_vivo}>
        <i className={`ponto ${ao_vivo ? 'pulso' : ''}`} aria-hidden="true" />{ao_vivo ? 'Ao vivo' : 'Voltar ao vivo'}
      </button>
    </div>
  );
}
