// Entrar e sair do modo TV preservando o contexto anterior.

import { useEstado } from '../../app/store';

let bloqueioTela: { release: () => Promise<void> } | null = null;

async function pedirTelaCheia() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    /* recusado: o layout de TV funciona mesmo sem tela cheia */
  }
}

async function manterTelaAcesa() {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (wl) bloqueioTela = await wl.request('screen');
  } catch {
    bloqueioTela = null;
  }
}

export function entrarNaTv() {
  const s = useEstado.getState();
  if (s.nav.tv) return;
  s.set({ navAntesDaTv: s.nav, busca: false, perfil: null, lista: null, formulario: null, campanhaModal: false, camadaAntesDoPerfil: null, tvAutomatico: true });
  s.navegar({ tv: true });
  void pedirTelaCheia();
  void manterTelaAcesa();
}

export function sairDaTv() {
  const s = useEstado.getState();
  if (!s.nav.tv) return;
  const antes = s.navAntesDaTv;
  s.set({ navAntesDaTv: null });
  if (antes) s.definirNav({ ...antes, tv: false });
  else s.navegar({ tv: false });
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  void bloqueioTela?.release().catch(() => undefined);
  bloqueioTela = null;
}

/** Reaplica o bloqueio de tela ao voltar à aba (o navegador o libera quando a aba fica oculta). */
export function reacenderSeTv() {
  if (useEstado.getState().nav.tv && !document.hidden && !bloqueioTela) void manterTelaAcesa();
}
