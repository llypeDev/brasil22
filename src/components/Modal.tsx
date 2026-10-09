// Modal acessível: foco contido, retorno do foco a quem abriu, fundo clicável para fechar.
// Esc é tratado pelos atalhos globais (fecha a camada do topo).

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCAVEIS = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select,textarea,[tabindex]:not([tabindex="-1"])';

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  rotulo: string;
  children: ReactNode;
  className?: string;
  /** folha inferior no celular */
  folha?: boolean;
  focoInicial?: React.RefObject<HTMLElement | null>;
  devolverFocoPara?: HTMLElement | null;
}

export function Modal({ aberto, aoFechar, rotulo, children, className = '', folha = true, focoInicial, devolverFocoPara }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const anterior = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!aberto) return;
    anterior.current = devolverFocoPara ?? (document.activeElement as HTMLElement | null);
    const t = requestAnimationFrame(() => {
      const alvo = focoInicial?.current ?? caixa.current?.querySelector<HTMLElement>(FOCAVEIS);
      alvo?.focus();
    });
    const prender = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !caixa.current) return;
      const f = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const primeiro = f[0], ultimo = f[f.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', prender);
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener('keydown', prender);
      const volta = anterior.current;
      if (volta && document.contains(volta)) requestAnimationFrame(() => volta.focus());
    };
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!aberto) return null;
  return createPortal(
    <div className={`modal-fundo ${folha ? 'folha' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={rotulo} ref={caixa}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
