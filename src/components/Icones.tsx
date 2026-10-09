import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false, ...p });

export const IconeBusca = (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>;
export const IconeGlobo = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5s-1.2 5.9-3.6 8.5c-2.4-2.6-3.6-5.4-3.6-8.5s1.2-5.9 3.6-8.5Z" /></svg>;
export const IconeCompartilhar = (p: P) => <svg {...base(p)}><path d="M12 15V4m0 0L8 8m4-4 4 4" /><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" /></svg>;
export const IconeTelaCheia = (p: P) => <svg {...base(p)}><path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" /></svg>;
export const IconeFechar = (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const IconeEsq = (p: P) => <svg {...base(p)}><path d="m15 6-6 6 6 6" /></svg>;
export const IconeDir = (p: P) => <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>;
export const IconeBaixo = (p: P) => <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>;
export const IconeMais = (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconeMenos = (p: P) => <svg {...base(p)}><path d="M5 12h14" /></svg>;
export const IconePlay = (p: P) => <svg {...base(p)}><path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" /></svg>;
export const IconePausa = (p: P) => <svg {...base(p)}><path d="M8 5v14M16 5v14" strokeWidth={2.6} /></svg>;
export const IconeOlho = (p: P) => <svg {...base(p)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></svg>;
export const IconeSeta = (p: P) => <svg {...base(p)}><path d="M5 12h14m0 0-5-5m5 5-5 5" /></svg>;
export const IconeInfo = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></svg>;
export const IconeAtualizar = (p: P) => <svg {...base(p)}><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" /></svg>;
export const IconeVoltar = (p: P) => <svg {...base(p)}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>;
export const IconeX = (p: P) => (
  <svg width={15} height={15} viewBox="0 0 24 24" aria-hidden focusable={false} {...p}><path fill="currentColor" d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.32l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58L16.67 19.2Z" /></svg>
);
export const IconeInstagram = (p: P) => <svg {...base({ width: 15, height: 15, ...p })}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" fill="currentColor" /></svg>;
export const IconeAoVivo = (p: P) => <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden {...p}><circle cx="4" cy="4" r="4" fill="currentColor" /></svg>;
