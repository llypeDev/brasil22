import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MotorMapa, type Alvo } from './motor';
import type { Camera, Quadro } from './camera';
import { useDesenho, CHAMADAS } from './useDesenho';
import { useMapa } from './api';
import type { Dica, Rotulo } from './especificacao';
import { useEstado } from '../app/store';
import { Retrato } from '../components/Retrato';
import { partido } from '../data/partidos';
import { IconeGlobo } from '../components/Icones';
import type { GeoBrasil } from './geo';

interface Props {
  quadro: Quadro;
  interativo?: boolean;
  escalaPicos?: number;
  escalaRotulos?: number;
  principal?: boolean;
  rotulos?: boolean;
}

export function Mapa({ quadro, interativo = true, escalaPicos = 100, escalaRotulos = 1, principal = true, rotulos = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const motorRef = useRef<MotorMapa | null>(null);
  const r = useDesenho(escalaPicos);
  const ouvintes = useRef(new Set<(c: Camera) => void>());
  const [dica, setDica] = useState<{ d: Dica; x: number; y: number } | null>(null);
  const ultimo = useRef(r);
  ultimo.current = r;
  const primeiraVez = useRef(true);

  useLayoutEffect(() => {
    const m = new MotorMapa(ref.current!, {
      aoPassar: (a: Alvo | null, x, y) => {
        const d = a ? ultimo.current.dica(a) : null;
        setDica(d ? { d, x, y } : null);
      },
      aoClicar: (a) => { setDica(null); ultimo.current.clicar(a); },
      aoMoverCamera: (c) => ouvintes.current.forEach((f) => f(c)),
      aoMudarLimites: (podeAproximar, podeAfastar) => { if (principal) useMapa.getState().set({ podeAproximar, podeAfastar }); },
    });
    motorRef.current = m;
    if (principal) useMapa.getState().set({ motor: m });
    if (import.meta.env.DEV && principal) (window as unknown as { __motor: MotorMapa }).__motor = m;
    return () => { m.destruir(); motorRef.current = null; if (principal) useMapa.getState().set({ motor: null }); };
  }, [principal]);

  useEffect(() => { motorRef.current?.definirInterativo(interativo); }, [interativo]);
  useEffect(() => { motorRef.current?.definirQuadro(quadro); }, [quadro.x, quadro.y, quadro.w, quadro.h]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (r.desenho) motorRef.current?.definir(r.desenho); }, [r.desenho]);
  useEffect(() => {
    if (!r.alvo || !motorRef.current) return;
    motorRef.current.irPara(r.alvo.caixa, { margem: r.alvo.margem, animar: !primeiraVez.current });
    primeiraVez.current = false;
  }, [r.alvo?.chave, !!r.desenho]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = () => { const a = ultimo.current.alvo; if (a) motorRef.current?.irPara(a.caixa, { margem: a.margem }); };
    window.addEventListener('mapa:reenquadrar', f);
    return () => window.removeEventListener('mapa:reenquadrar', f);
  }, []);
  useEffect(() => {
    if (principal) useMapa.getState().set({ legenda: r.legenda, carregando: r.carregando, aviso: r.aviso ?? null });
  }, [r.legenda, r.carregando, r.aviso, principal]);

  const rotulo = r.desenho?.tipo === 'mundo' ? 'Mapa-múndi com as cidades onde brasileiros votam' : 'Mapa do Brasil com quem lidera em cada lugar';
  return (
    <div className="mapa" ref={ref} role="img" aria-label={rotulo}>
      {rotulos && <Rotulos rotulos={r.rotulos} motor={motorRef} ouvintes={ouvintes.current} geo={r.geo} escala={escalaRotulos} quadro={quadro} />}
      {dica && interativo && <CaixaDica {...dica} />}
    </div>
  );
}

function CaixaDica({ d, x, y }: { d: Dica; x: number; y: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 14, top: y + 14 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const pai = el.parentElement!.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    setPos({ left: x + 16 + w > pai.width ? x - w - 12 : x + 16, top: Math.min(pai.height - h - 8, Math.max(8, y + 16)) });
  }, [x, y, d]);
  return (
    <div className="dica" ref={ref} style={pos} role="tooltip">
      <b>{d.titulo}</b>
      {d.subtitulo && <span className="dica-sub">{d.subtitulo}</span>}
      {d.linhas.map((l) => (
        <span className={`dica-linha ${l.destaque ? 'lider' : ''}`} key={l.nome}>
          <i style={{ background: partido(l.sigla).cor }} />{l.nome}<em className="tn">{l.valor}</em>
        </span>
      ))}
      {d.rodape && <span className="dica-rodape">{d.rodape}</span>}
    </div>
  );
}

interface PropsRotulos { rotulos: Rotulo[]; motor: React.MutableRefObject<MotorMapa | null>; ouvintes: Set<(c: Camera) => void>; geo: GeoBrasil | null; escala: number; quadro: Quadro }

/** Rótulos em DOM posicionados pela câmera, sem re-renderizar o React a cada quadro. */
function Rotulos({ rotulos, motor, ouvintes, geo, escala, quadro }: PropsRotulos) {
  const nos = useRef(new Map<string, HTMLElement>());
  const linhas = useRef<SVGSVGElement>(null);
  const navegar = useEstado((s) => s.navegar);
  // tamanhos dos rótulos, medidos uma vez por conjunto de rótulos (evita layout a cada quadro)
  const tamanhos = useRef(new Map<string, { w: number; h: number }>());
  useEffect(() => { tamanhos.current.clear(); }, [rotulos, escala]);
  const medir = (id: string, el: HTMLElement) => {
    let t = tamanhos.current.get(id);
    if (!t) { t = { w: el.offsetWidth, h: el.offsetHeight }; tamanhos.current.set(id, t); }
    return t;
  };

  const posicionar = useCallback((c: Camera) => {
    const m = motor.current; if (!m || !geo) return;
    const { w, h } = m.tamanho();
    const kFit = Math.min(quadro.w / (geo.caixaContinental[2] - geo.caixaContinental[0]), quadro.h / (geo.caixaContinental[3] - geo.caixaContinental[1]));
    const proximo = c.k > kFit * 1.7;
    const leste = geo.caixaContinental[2] * c.k + c.x;
    const chamadas = rotulos.filter((r): r is Extract<Rotulo, { tipo: 'uf' }> => r.tipo === 'uf' && !!r.chamada).sort((a, b) => CHAMADAS.indexOf(a.uf) - CHAMADAS.indexOf(b.uf));
    // empilha as chamadas a leste do litoral, respeitando a latitude e o espaçamento mínimo
    const passo = 25 * escala;
    let ultimoY = -Infinity;
    const posChamada = new Map<string, { x: number; y: number; ax: number; ay: number }>();
    const grupoSul = new Set(['ES', 'RJ']);
    for (const r of chamadas) {
      const ay = r.y * c.k + c.y, ax = r.x * c.k + c.x;
      let y = grupoSul.has(r.uf) ? Math.max(ay, ultimoY + passo * (r.uf === 'ES' ? 3 : 1)) : Math.max(ay - passo * 1.5, ultimoY + passo);
      if (r.uf === 'RN') y = Math.max(ay - passo, quadro.y + 10);
      ultimoY = y;
      posChamada.set(r.uf, { x: leste + 26 * escala, y, ax, ay });
    }
    // a pilha não passa do fim do quadro (em telas baixas ficaria sob a linha do tempo):
    // de baixo para cima, sobe o que exceder mantendo o espaçamento mínimo
    const temExterior = rotulos.some((r) => r.tipo === 'exterior');
    let yExterior = ultimoY + passo * 1.5;
    const limite = quadro.y + quadro.h - passo * 0.5;
    if ((temExterior ? yExterior : ultimoY) > limite) {
      let teto = limite;
      if (temExterior) { yExterior = limite; teto = limite - passo * 1.5; }
      const empilhadas = [...posChamada.values()];
      for (let i = empilhadas.length - 1; i >= 0; i--) {
        if (empilhadas[i].y > teto) empilhadas[i].y = teto;
        teto = empilhadas[i].y - passo;
      }
    }
    let svg = '';
    const ufs = new Map<string, { el: HTMLElement; x: number; y: number }>();
    for (const r of rotulos) {
      const el = nos.current.get(r.id);
      if (!el) continue;
      let x: number, y: number, visivel = !proximo;
      if (r.tipo === 'uf' && r.chamada && posChamada.has(r.uf)) {
        const p = posChamada.get(r.uf)!;
        x = p.x; y = p.y;
        el.classList.add('em-chamada');
        if (visivel) svg += `<path d="M${p.ax.toFixed(1)},${p.ay.toFixed(1)} L${(p.x - 4).toFixed(1)},${p.y.toFixed(1)}"/>`;
      } else if (r.tipo === 'exterior') {
        x = leste + 26 * escala; y = yExterior;
      } else if (r.tipo === 'cidade' || r.tipo === 'lugar' || r.tipo === 'uf' || r.tipo === 'zona') {
        x = r.x * c.k + c.x; y = r.y * c.k + c.y;
        if (r.tipo === 'cidade' || r.tipo === 'zona') visivel = true;
      } else continue;
      const fora = x < -60 || y < -40 || x > w + 60 || y > h + 40;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.visibility = visivel && !fora ? 'visible' : 'hidden';
      if (r.tipo === 'uf' && (r.uf === 'DF' || r.uf === 'GO') && visivel && !fora) ufs.set(r.uf, { el, x, y });
    }
    // O DF fica dentro de Goiás: em mapas pequenos os rótulos se cobrem; o de GO cede para oeste.
    const df = ufs.get('DF'), go = ufs.get('GO');
    if (df && go) {
      const a = medir('DF', df.el), b = medir('GO', go.el);
      const folgaX = (a.w + b.w) / 2 + 3;
      if (Math.abs(df.x - go.x) < folgaX && Math.abs(df.y - go.y) < (a.h + b.h) / 2 + 2) {
        go.el.style.transform = `translate(${(df.x - folgaX).toFixed(1)}px, ${go.y.toFixed(1)}px)`;
      }
    }
    if (linhas.current) linhas.current.innerHTML = svg;
  }, [rotulos, geo, motor, escala, quadro]);

  useEffect(() => {
    ouvintes.add(posicionar);
    const m = motor.current;
    if (m) posicionar(m.camera());
    return () => { ouvintes.delete(posicionar); };
  }, [posicionar, ouvintes, motor]);

  const registrar = (id: string) => (el: HTMLElement | null) => { if (el) nos.current.set(id, el); else nos.current.delete(id); };

  return (
    <div className="rotulos" style={{ '--er': escala } as React.CSSProperties}>
      <svg className="linhas-chamada" ref={linhas} aria-hidden="true" />
      {rotulos.map((r) => {
        if (r.tipo === 'uf') {
          return (
            <button key={r.id} ref={registrar(r.id)} className={`rotulo-uf ${r.fotos?.length ? 'com-fotos' : ''} ${r.chamada ? 'chamada' : ''} ${r.selecionado ? 'selecionado' : ''}`} style={{ '--cor': r.cor ?? '#555', '--cor-texto': r.corTexto ?? r.cor ?? '#333' } as React.CSSProperties} onClick={() => navegar({ uf: r.uf, zz: false, mun: null })} aria-label={r.aria}>
              {r.fotos?.length ? (
                <span className="fotos">{r.fotos.map((f) => <Retrato key={f.sq ?? f.nome} nome={f.nome} sigla={f.sigla} sq={f.sq} cargo={f.cargo} uf={f.uf} tamanho={Math.round(26 * escala)} borda />)}</span>
              ) : null}
              <span className="uf">{r.texto}</span>
              {r.valor ? <span className="valor tn">{r.valor}</span> : null}
            </button>
          );
        }
        if (r.tipo === 'exterior') {
          return (
            <button key={r.id} ref={registrar(r.id)} className="rotulo-uf chamada exterior em-chamada" style={{ '--cor': r.cor } as React.CSSProperties} onClick={() => navegar({ zz: true, uf: null })} aria-label={r.aria}>
              <span className="uf"><IconeGlobo width={12} height={12} /></span><span className="valor tn">{r.valor}</span>
            </button>
          );
        }
        if (r.tipo === 'cidade') {
          return (
            <span key={r.id} ref={registrar(r.id)} className={`rotulo-cidade ${r.selecionado ? 'selecionado' : ''}`} aria-hidden="true">{r.texto}</span>
          );
        }
        if (r.tipo === 'zona') {
          return (
            <button key={r.id} ref={registrar(r.id)} className={`rotulo-zona ${r.selecionado ? 'selecionado' : ''}`} onClick={() => navegar({ zona: r.selecionado ? null : r.zona })} aria-label={r.aria} aria-pressed={!!r.selecionado}>{r.zona}</button>
          );
        }
        return <span key={r.id} ref={registrar(r.id)} className="rotulo-lugar" aria-hidden="true">{r.texto}</span>;
      })}
    </div>
  );
}
