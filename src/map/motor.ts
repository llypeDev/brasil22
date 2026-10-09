// Motor do mapa em Canvas 2D.
//
// Duas camadas de canvas: base (preenchimentos, bordas, picos, cidades) e sobreposição
// (passagem do ponteiro e seleção). A base só é redesenhada quando dados ou câmera mudam;
// mover o ponteiro redesenha apenas a sobreposição. Preenchimentos são agrupados por cor em
// Path2D compostos (addPath), reconstruídos só quando as cores mudam.
//
// Hit testing usa a geometria real (isPointInPath) com a matriz inversa da câmera, depois
// de um filtro por grade espacial.

import type { GeoBrasil, GeoMundo, ZonasGeo } from './geo';
import { enquadrar, interpolar, limitar, paraMapa, paraTela, suavizar, zoomEm, type Caixa, type Camera, type Quadro } from './camera';

export type CorUf = string | [string, string] | null;

export interface Pico { i: number; h: number; cor: string }
export interface CidadeDesenho { tse: string; x: number; y: number; r: number; cor: string; contorno?: string }

export interface DesenhoBrasil {
  tipo: 'brasil';
  geo: GeoBrasil;
  modo: 'municipios' | 'ufs';
  /** cor por município (null = sem dados) */
  coresMun?: (string | null)[] | null;
  /** cor por UF, na ordem de geo.ufs; par = divisão diagonal (Senado) */
  coresUf?: CorUf[] | null;
  ufFoco?: string | null;
  picos?: Pico[] | null;
  selecionado?: number | null;
  ufSelecionada?: string | null;
  /** áreas aproximadas das zonas do município selecionado, com a cor de cada zona */
  zonas?: { geo: ZonasGeo; cores: Record<string, string | null> } | null;
  zonaSelecionada?: string | null;
}
export interface DesenhoMundo {
  tipo: 'mundo';
  geo: GeoMundo;
  coresUf: (string | null)[];
  cidades: CidadeDesenho[];
  paisFoco?: string | null;
  cidadeSelecionada?: string | null;
}
export type Desenho = DesenhoBrasil | DesenhoMundo;

export type Alvo =
  | { tipo: 'mun'; i: number }
  | { tipo: 'zona'; zona: string }
  | { tipo: 'uf'; k: number }
  | { tipo: 'cidade'; tse: string }
  | { tipo: 'pais'; iso: string }
  | { tipo: 'brasil' };

export interface OpcoesMotor {
  aoPassar?: (alvo: Alvo | null, sx: number, sy: number) => void;
  aoClicar?: (alvo: Alvo | null) => void;
  aoMoverCamera?: (c: Camera) => void;
  aoMudarLimites?: (podeAproximar: boolean, podeAfastar: boolean) => void;
  fundo?: string;
}

const COR_SEM_DADOS = '#DCDCDA';
const COR_TERRA = '#E2E2DF';
const MAX_PIXELS = 7_000_000;

export class MotorMapa {
  private base: HTMLCanvasElement;
  private sobre: HTMLCanvasElement;
  private cb: CanvasRenderingContext2D;
  private cs: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private cam: Camera = { k: 0.05, x: 0, y: 0 };
  private quadro: Quadro = { x: 0, y: 0, w: 1, h: 1 };
  private caixaAlvo: Caixa | null = null;
  private margemAlvo = 0.05;
  private desenho: Desenho | null = null;
  private baldes: { cor: string; foco: boolean; caminho: Path2D }[] = [];
  private chaveBaldes: unknown = null;
  private passando: Alvo | null = null;
  private quadroAnim = 0;
  private anim: { de: Camera; para: Camera; t0: number; dur: number } | null = null;
  private pedido = 0;
  private sujoBase = true;
  private sujoSobre = true;
  private ponteiros = new Map<number, { x: number; y: number }>();
  private arrasto: { x: number; y: number; cam: Camera; moveu: boolean; pinca?: { d: number; mx: number; my: number } } | null = null;
  private obs: ResizeObserver;
  private kMin = 0.01;
  private kMax = 10;
  private interativo = true;
  private ultimoMovimento = 0;

  constructor(private el: HTMLElement, private op: OpcoesMotor = {}) {
    this.base = document.createElement('canvas');
    this.sobre = document.createElement('canvas');
    this.base.className = 'mapa-base';
    this.sobre.className = 'mapa-sobre';
    this.base.setAttribute('aria-hidden', 'true');
    this.sobre.setAttribute('aria-hidden', 'true');
    el.append(this.base, this.sobre);
    this.cb = this.base.getContext('2d', { alpha: true })!;
    this.cs = this.sobre.getContext('2d', { alpha: true })!;
    this.obs = new ResizeObserver(() => this.redimensionar());
    this.obs.observe(el);
    this.redimensionar();
    this.sobre.addEventListener('pointerdown', this.aoApertar);
    this.sobre.addEventListener('pointermove', this.aoMover);
    this.sobre.addEventListener('pointerup', this.aoSoltar);
    this.sobre.addEventListener('pointercancel', this.aoCancelar);
    this.sobre.addEventListener('pointerleave', this.aoSair);
    this.sobre.addEventListener('wheel', this.aoRolar, { passive: false });
    this.sobre.addEventListener('dblclick', this.aoDuploClique);
  }

  destruir() {
    cancelAnimationFrame(this.pedido);
    cancelAnimationFrame(this.quadroAnim);
    this.obs.disconnect();
    this.sobre.removeEventListener('pointerdown', this.aoApertar);
    this.sobre.removeEventListener('pointermove', this.aoMover);
    this.sobre.removeEventListener('pointerup', this.aoSoltar);
    this.sobre.removeEventListener('pointercancel', this.aoCancelar);
    this.sobre.removeEventListener('pointerleave', this.aoSair);
    this.sobre.removeEventListener('wheel', this.aoRolar);
    this.sobre.removeEventListener('dblclick', this.aoDuploClique);
    this.base.remove();
    this.sobre.remove();
  }

  camera() { return this.cam; }
  tamanho() { return { w: this.w, h: this.h }; }
  definirInterativo(v: boolean) { this.interativo = v; this.sobre.style.cursor = v ? '' : 'default'; }

  /** Região do contêiner onde o conteúdo deve ser enquadrado (descontando colunas). */
  definirQuadro(q: Quadro) {
    const mudou = q.x !== this.quadro.x || q.y !== this.quadro.y || q.w !== this.quadro.w || q.h !== this.quadro.h;
    this.quadro = q;
    if (mudou) this.reenquadrar(false);
  }

  /** Afastar só faz sentido longe do mínimo: o enquadramento inicial fica a ~1% dele. */
  private avisarLimites() {
    this.op.aoMudarLimites?.(this.cam.k < this.kMax * 0.999, this.cam.k > this.kMin * 1.03);
  }

  /** Limites de zoom em relação ao enquadramento total do conteúdo. */
  private atualizarLimites() {
    const total = this.caixaConteudo();
    if (!total) return;
    const kFit = enquadrar(total, this.quadro, this.desenho?.tipo === 'mundo' ? 0.02 : 0.04).k;
    this.kMin = kFit * 0.999;
    this.kMax = kFit * (this.desenho?.tipo === 'mundo' ? 60 : 160);
    this.avisarLimites();
  }

  private caixaConteudo(): Caixa | null {
    const d = this.desenho;
    if (!d) return null;
    return d.tipo === 'brasil' ? d.geo.caixaContinental : (d.geo.caixaTotal as Caixa);
  }

  definir(d: Desenho) {
    const trocouTipo = !this.desenho || this.desenho.tipo !== d.tipo;
    this.desenho = d;
    this.sujoBase = true;
    this.sujoSobre = true;
    if (trocouTipo) { this.chaveBaldes = null; this.atualizarLimites(); }
    this.pedirDesenho();
  }

  /** Enquadra uma caixa do espaço do mapa. */
  irPara(caixa: Caixa, { animar = true, margem = 0.05, dur = 700 }: { animar?: boolean; margem?: number; dur?: number } = {}) {
    this.caixaAlvo = caixa;
    this.margemAlvo = margem;
    this.atualizarLimites();
    const alvo = enquadrar(caixa, this.quadro, margem, this.kMax);
    if (!animar || this.w === 0) { this.anim = null; this.aplicar(alvo); return; }
    this.animarPara(alvo, dur);
  }

  private reenquadrar(animar: boolean) {
    this.atualizarLimites();
    if (this.caixaAlvo) this.irPara(this.caixaAlvo, { animar, margem: this.margemAlvo });
  }

  private animarPara(alvo: Camera, dur: number) {
    const reduzir = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzir) { this.anim = null; this.aplicar(alvo); return; }
    this.anim = { de: { ...this.cam }, para: alvo, t0: performance.now(), dur };
    cancelAnimationFrame(this.quadroAnim);
    const passo = (agora: number) => {
      if (!this.anim) return;
      const t = Math.min(1, (agora - this.anim.t0) / this.anim.dur);
      this.aplicar(interpolar(this.anim.de, this.anim.para, suavizar(t), this.quadro));
      if (t < 1) this.quadroAnim = requestAnimationFrame(passo);
      else this.anim = null;
    };
    this.quadroAnim = requestAnimationFrame(passo);
  }

  aproximar(fator = 1.6) {
    const q = this.quadro;
    // teclas repetidas durante a animação acumulam a partir do destino, não do quadro atual
    const alvo = zoomEm(this.anim?.para ?? this.cam, fator, q.x + q.w / 2, q.y + q.h / 2, this.kMin, this.kMax);
    this.caixaAlvo = null;
    this.animarPara(alvo, 280);
  }
  afastar(fator = 1.6) { this.aproximar(1 / fator); }

  private aplicar(c: Camera) {
    const total = this.caixaConteudo();
    this.cam = total ? limitar({ ...c, k: Math.max(this.kMin, Math.min(this.kMax, c.k)) }, total, this.quadro) : c;
    this.sujoBase = true;
    this.sujoSobre = true;
    this.pedirDesenho();
    this.op.aoMoverCamera?.(this.cam);
    this.avisarLimites();
  }

  definirPassando(alvo: Alvo | null) {
    if (JSON.stringify(alvo) === JSON.stringify(this.passando)) return;
    this.passando = alvo;
    this.sujoSobre = true;
    this.pedirDesenho();
  }

  private redimensionar() {
    const r = this.el.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w * h * dpr * dpr > MAX_PIXELS) dpr = Math.sqrt(MAX_PIXELS / (w * h));
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    for (const c of [this.base, this.sobre]) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = `${w}px`; c.style.height = `${h}px`;
    }
    this.sujoBase = true; this.sujoSobre = true;
    this.reenquadrar(false);
    this.pedirDesenho();
  }

  private pedirDesenho() {
    if (this.pedido) return;
    this.pedido = requestAnimationFrame(() => {
      this.pedido = 0;
      if (this.sujoBase) this.desenharBase();
      if (this.sujoSobre) this.desenharSobre();
    });
  }

  // ---------- desenho ----------

  private montarBaldes(d: DesenhoBrasil) {
    const chave = [d.coresMun, d.ufFoco, d.geo];
    if (this.chaveBaldes && (this.chaveBaldes as unknown[]).every((v, i) => v === chave[i])) return;
    this.chaveBaldes = chave;
    const mapa = new Map<string, { cor: string; foco: boolean; caminho: Path2D }>();
    const cores = d.coresMun ?? [];
    for (let i = 0; i < d.geo.n; i++) {
      const cor = cores[i] ?? COR_SEM_DADOS;
      const foco = !d.ufFoco || d.geo.uf[i] === d.ufFoco;
      const k = `${foco ? 1 : 0}${cor}`;
      let b = mapa.get(k);
      if (!b) { b = { cor, foco, caminho: new Path2D() }; mapa.set(k, b); }
      b.caminho.addPath(d.geo.caminho[i]);
    }
    this.baldes = [...mapa.values()].sort((a, b) => Number(a.foco) - Number(b.foco));
  }

  private desenharBase() {
    this.sujoBase = false;
    const ctx = this.cb;
    const { dpr, cam } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.base.width, this.base.height);
    const d = this.desenho;
    if (!d) return;
    ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * cam.x, dpr * cam.y);
    const px = 1 / cam.k; // 1 px de tela em unidades de mapa
    if (d.tipo === 'brasil') this.desenharBrasil(ctx, d, px);
    else this.desenharMundo(ctx, d, px);
    this.op.aoMoverCamera?.(cam);
  }

  private desenharBrasil(ctx: CanvasRenderingContext2D, d: DesenhoBrasil, px: number) {
    const g = d.geo;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (d.modo === 'municipios') {
      this.montarBaldes(d);
      for (const b of this.baldes) {
        ctx.globalAlpha = b.foco ? 1 : 0.26;
        ctx.fillStyle = b.cor;
        ctx.fill(b.caminho);
      }
      ctx.globalAlpha = 1;
      // bordas municipais: só quando legíveis (tamanho médio do município em tela)
      const legivel = this.cam.k > 0.05;
      ctx.strokeStyle = '#FFFFFF';
      if (d.ufFoco) {
        const p = g.bordasMunDaUf.get(d.ufFoco);
        if (p) { ctx.globalAlpha = 0.85; ctx.lineWidth = 0.6 * px; ctx.stroke(p); }
      } else if (legivel) {
        ctx.globalAlpha = Math.min(0.7, 0.25 + (this.cam.k - 0.05) * 6);
        ctx.lineWidth = 0.45 * px;
        ctx.stroke(g.bordasMun);
      }
      ctx.globalAlpha = 1;
    } else {
      const cores = d.coresUf ?? [];
      g.ufs.forEach((u, k) => {
        const c = cores[k];
        const foco = !d.ufFoco || u.uf === d.ufFoco;
        ctx.globalAlpha = foco ? 1 : 0.3;
        if (Array.isArray(c)) {
          // divisão diagonal pela reta que passa no ponto de rótulo (Senado: duas vagas)
          ctx.save();
          ctx.clip(u.caminho);
          const [cx, cy] = u.rotulo;
          const R = Math.max(u.caixa[2] - u.caixa[0], u.caixa[3] - u.caixa[1]) * 2;
          ctx.fillStyle = c[0];
          ctx.beginPath(); ctx.moveTo(cx - R, cy + R); ctx.lineTo(cx + R, cy - R); ctx.lineTo(cx - R, cy - R); ctx.closePath(); ctx.fill();
          ctx.fillStyle = c[1];
          ctx.beginPath(); ctx.moveTo(cx - R, cy + R); ctx.lineTo(cx + R, cy - R); ctx.lineTo(cx + R, cy + R); ctx.closePath(); ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = c ?? COR_SEM_DADOS;
          ctx.fill(u.caminho);
        }
      });
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = (d.modo === 'ufs' ? 1.4 : 1.1) * px;
    ctx.stroke(g.bordasUf);

    if (d.zonas) {
      for (const z of d.zonas.geo.zonas) {
        ctx.fillStyle = d.zonas.cores[z.zona] ?? '#DCDCDA';
        ctx.fill(z.caminho, 'evenodd');
      }
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2 * px;
      for (const z of d.zonas.geo.zonas) ctx.stroke(z.caminho);
    }

    if (d.picos?.length) {
      // picos em espaço de tela, do fundo para a frente
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const base = Math.max(2.2, Math.min(5, this.cam.k * 40));
      const ordenados = [...d.picos].sort((a, b) => g.rotulo[a.i * 2 + 1] - g.rotulo[b.i * 2 + 1]);
      for (const p of ordenados) {
        const [sx, sy] = paraTela(this.cam, g.rotulo[p.i * 2], g.rotulo[p.i * 2 + 1]);
        if (sx < -20 || sx > this.w + 20 || sy < -20 || sy > this.h + 200) continue;
        ctx.fillStyle = p.cor;
        ctx.globalAlpha = 0.82;
        ctx.beginPath(); ctx.moveTo(sx - base, sy); ctx.lineTo(sx, sy - p.h); ctx.lineTo(sx + base, sy); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  private desenharMundo(ctx: CanvasRenderingContext2D, d: DesenhoMundo, px: number) {
    const g = d.geo;
    for (const p of g.paises) {
      ctx.fillStyle = p.iso === d.paisFoco ? '#D3D3CF' : COR_TERRA;
      ctx.fill(p.caminho);
    }
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.7 * px;
    for (const p of g.paises) ctx.stroke(p.caminho);
    g.brasilUfs.forEach((u, k) => {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = d.coresUf[k] ?? COR_SEM_DADOS;
      ctx.fill(u.caminho);
    });
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.6 * px;
    for (const u of g.brasilUfs) ctx.stroke(u.caminho);
    // cidades em espaço de tela, maiores atrás
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const lista = [...d.cidades].sort((a, b) => b.r - a.r);
    const fator = Math.max(1, Math.min(2.6, Math.sqrt(this.cam.k / this.kMin)));
    for (const c of lista) {
      const [sx, sy] = paraTela(this.cam, c.x, c.y);
      if (sx < -30 || sy < -30 || sx > this.w + 30 || sy > this.h + 30) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, c.r * fator, 0, Math.PI * 2);
      ctx.fillStyle = c.cor;
      ctx.globalAlpha = 0.88;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = c.contorno ?? '#FFFFFF';
      ctx.stroke();
    }
  }

  private desenharSobre() {
    this.sujoSobre = false;
    const ctx = this.cs;
    const { dpr, cam } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.sobre.width, this.sobre.height);
    const d = this.desenho;
    if (!d) return;
    ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * cam.x, dpr * cam.y);
    const px = 1 / cam.k;
    ctx.lineJoin = 'round';
    const contornar = (p: Path2D, largura: number, cor = '#111111') => {
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = (largura + 2.5) * px; ctx.stroke(p);
      ctx.strokeStyle = cor; ctx.lineWidth = largura * px; ctx.stroke(p);
    };
    if (d.tipo === 'brasil') {
      if (d.ufSelecionada && d.modo === 'municipios') {
        const k = d.geo.ufIndice.get(d.ufSelecionada);
        if (k != null) { ctx.strokeStyle = '#111111'; ctx.lineWidth = 1.2 * px; ctx.globalAlpha = 0.6; ctx.stroke(d.geo.ufs[k].caminho); ctx.globalAlpha = 1; }
      }
      const pas = this.passando;
      if (pas?.tipo === 'mun') contornar(d.geo.caminho[pas.i], 1.3);
      if (pas?.tipo === 'uf') contornar(d.geo.ufs[pas.k].caminho, 1.6);
      if (d.selecionado != null && d.selecionado >= 0) contornar(d.geo.caminho[d.selecionado], 2.2);
      if (d.zonas) {
        const zp = pas?.tipo === 'zona' ? d.zonas.geo.zonas.find((z) => z.zona === pas.zona) : null;
        if (zp) contornar(zp.caminho, 1.3);
        const zs = d.zonaSelecionada ? d.zonas.geo.zonas.find((z) => z.zona === d.zonaSelecionada) : null;
        if (zs) contornar(zs.caminho, 2.4);
      }
      if (d.modo === 'ufs' && d.ufSelecionada) { const k = d.geo.ufIndice.get(d.ufSelecionada); if (k != null) contornar(d.geo.ufs[k].caminho, 2.2); }
    } else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fator = Math.max(1, Math.min(2.6, Math.sqrt(cam.k / this.kMin)));
      for (const tse of [this.passando?.tipo === 'cidade' ? this.passando.tse : null, d.cidadeSelecionada]) {
        if (!tse) continue;
        const c = d.cidades.find((x) => x.tse === tse);
        if (!c) continue;
        const [sx, sy] = paraTela(cam, c.x, c.y);
        ctx.beginPath(); ctx.arc(sx, sy, c.r * fator + 3.5, 0, Math.PI * 2);
        ctx.lineWidth = tse === d.cidadeSelecionada ? 2.2 : 1.4; ctx.strokeStyle = '#111111'; ctx.stroke();
      }
      if (this.passando?.tipo === 'pais') {
        const p = d.geo.porIso.get(this.passando.iso);
        if (p) { ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * cam.x, dpr * cam.y); ctx.strokeStyle = '#555'; ctx.lineWidth = 1 * px; ctx.stroke(p.caminho); }
      }
    }
  }

  // ---------- interação ----------

  alvoEm(sx: number, sy: number): Alvo | null {
    const d = this.desenho;
    if (!d) return null;
    const [mx, my] = paraMapa(this.cam, sx, sy);
    if (d.tipo === 'brasil') {
      if (d.modo === 'ufs') { const k = d.geo.encontrarUf(mx, my); return k >= 0 ? { tipo: 'uf', k } : null; }
      if (d.zonas) { const z = d.zonas.geo.encontrar(mx, my); if (z) return { tipo: 'zona', zona: z }; }
      const i = d.geo.encontrar(mx, my);
      return i >= 0 ? { tipo: 'mun', i } : null;
    }
    const fator = Math.max(1, Math.min(2.6, Math.sqrt(this.cam.k / this.kMin)));
    let melhor: CidadeDesenho | null = null, md = Infinity;
    for (const c of d.cidades) {
      const [cx, cy] = paraTela(this.cam, c.x, c.y);
      const dist = Math.hypot(cx - sx, cy - sy);
      if (dist <= c.r * fator + 5 && dist < md) { md = dist; melhor = c; }
    }
    if (melhor) return { tipo: 'cidade', tse: melhor.tse };
    const k = d.geo.encontrarPais(mx, my);
    if (k >= 0) return d.geo.paises[k].iso === 'BR' ? { tipo: 'brasil' } : { tipo: 'pais', iso: d.geo.paises[k].iso };
    return null;
  }

  private pos(e: PointerEvent | WheelEvent | MouseEvent) {
    const r = this.sobre.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private aoApertar = (e: PointerEvent) => {
    if (!this.interativo) return;
    this.sobre.setPointerCapture(e.pointerId);
    const p = this.pos(e);
    this.ponteiros.set(e.pointerId, p);
    this.anim = null;
    if (this.ponteiros.size === 2) {
      const [a, b] = [...this.ponteiros.values()];
      this.arrasto = { x: p.x, y: p.y, cam: { ...this.cam }, moveu: true, pinca: { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 } };
    } else {
      this.arrasto = { x: p.x, y: p.y, cam: { ...this.cam }, moveu: false };
    }
  };

  private aoMover = (e: PointerEvent) => {
    const p = this.pos(e);
    if (this.arrasto && this.ponteiros.has(e.pointerId)) {
      this.ponteiros.set(e.pointerId, p);
      const a = this.arrasto;
      if (a.pinca && this.ponteiros.size >= 2) {
        const [p1, p2] = [...this.ponteiros.values()];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        const z = zoomEm(a.cam, dist / Math.max(1, a.pinca.d), a.pinca.mx, a.pinca.my, this.kMin, this.kMax);
        this.caixaAlvo = null;
        this.aplicar({ k: z.k, x: z.x + (mx - a.pinca.mx), y: z.y + (my - a.pinca.my) });
        return;
      }
      const dx = p.x - a.x, dy = p.y - a.y;
      if (!a.moveu && Math.hypot(dx, dy) < 4) return;
      a.moveu = true;
      this.caixaAlvo = null;
      this.sobre.style.cursor = 'grabbing';
      this.aplicar({ k: a.cam.k, x: a.cam.x + dx, y: a.cam.y + dy });
      return;
    }
    if (!this.interativo || e.pointerType === 'touch') return;
    const agora = performance.now();
    if (agora - this.ultimoMovimento < 24) return;
    this.ultimoMovimento = agora;
    const alvo = this.alvoEm(p.x, p.y);
    this.definirPassando(alvo);
    this.sobre.style.cursor = alvo ? 'pointer' : 'grab';
    this.op.aoPassar?.(alvo, p.x, p.y);
  };

  private aoSoltar = (e: PointerEvent) => {
    const a = this.arrasto;
    this.ponteiros.delete(e.pointerId);
    if (this.ponteiros.size === 0) this.arrasto = null;
    else if (a?.pinca) { const [q] = [...this.ponteiros.values()]; this.arrasto = { x: q.x, y: q.y, cam: { ...this.cam }, moveu: true }; }
    this.sobre.style.cursor = '';
    if (a && !a.moveu && this.interativo) {
      const p = this.pos(e);
      const alvo = this.alvoEm(p.x, p.y);
      if (e.pointerType === 'touch') this.op.aoPassar?.(alvo, p.x, p.y);
      this.op.aoClicar?.(alvo);
    }
  };

  private aoCancelar = (e: PointerEvent) => { this.ponteiros.delete(e.pointerId); if (!this.ponteiros.size) this.arrasto = null; };
  private aoSair = () => { if (!this.arrasto) { this.definirPassando(null); this.op.aoPassar?.(null, 0, 0); } };

  private aoRolar = (e: WheelEvent) => {
    if (!this.interativo) return;
    e.preventDefault();
    const p = this.pos(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const fator = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0018));
    this.anim = null;
    this.caixaAlvo = null;
    this.aplicar(zoomEm(this.cam, fator, p.x, p.y, this.kMin, this.kMax));
  };

  private aoDuploClique = (e: MouseEvent) => {
    if (!this.interativo) return;
    const p = this.pos(e);
    this.caixaAlvo = null;
    this.animarPara(zoomEm(this.cam, e.shiftKey ? 0.5 : 2, p.x, p.y, this.kMin, this.kMax), 300);
  };

  /** Posição de tela de um ponto do mapa (para rótulos em DOM). */
  tela(mx: number, my: number) { return paraTela(this.cam, mx, my); }
}
