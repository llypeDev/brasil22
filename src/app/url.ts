// Sincronização entre o estado de navegação e a URL (fragmento) com back/forward coerentes.
// Mudanças de escopo (cargo, UF, município, zona, exterior) criam entrada no histórico;
// camada, instante e TV substituem a entrada atual.

import { useEstado } from './store';
import { parseHash, serializeHash, type EstadoUrl, type Validadores } from './hash';
import type { Modo } from '../data/contratos';

let validadoresAtuais: () => Validadores = () => ({});
let aplicandoDaUrl = false;

const escopo = (e: EstadoUrl) => [e.cargo, e.uf, e.mun, e.zona, e.zz, e.pais, e.cidade].join('|');

export function lerModoDaUrl(): Modo {
  const q = new URLSearchParams(location.search);
  const c = q.get('cenario');
  if (c && ['aguardando', 'vazio', 'falha', 'instavel', 'lento'].includes(c)) return `cenario-${c}` as Modo;
  return q.get('fonte') === 'simulacao' ? 'simulacao' : 'oficial';
}

export function trocarModo(modo: Modo) {
  const q = new URLSearchParams(location.search);
  q.delete('fonte'); q.delete('cenario');
  if (modo === 'simulacao') q.set('fonte', 'simulacao');
  else if (modo.startsWith('cenario-')) q.set('cenario', modo.replace('cenario-', ''));
  const s = q.toString();
  location.assign(`${location.pathname}${s ? `?${s}` : ''}${location.hash}`);
}

export function definirValidadores(v: () => Validadores) {
  validadoresAtuais = v;
  // revalida o fragmento atual com os catálogos carregados
  aplicarDaUrl(true);
}

function aplicarDaUrl(substituir = false) {
  const e = parseHash(location.hash, validadoresAtuais());
  aplicandoDaUrl = true;
  useEstado.getState().definirNav(e);
  aplicandoDaUrl = false;
  const h = serializeHash(e);
  if (substituir && location.hash && h !== location.hash) history.replaceState(history.state, '', h);
}

export function iniciarUrl() {
  aplicarDaUrl(false);
  const aoVoltar = () => {
    const s = useEstado.getState();
    // Esc/voltar fecha camadas temporárias antes de navegar
    s.set({ busca: false, lista: null, perfil: null, formulario: null });
    // fragmento inválido volta a um estado válido, e a barra de endereço reflete isso
    aplicarDaUrl(true);
  };
  window.addEventListener('popstate', aoVoltar);
  window.addEventListener('hashchange', aoVoltar);
  const desinscrever = useEstado.subscribe((s, ant) => {
    if (s.nav === ant.nav || aplicandoDaUrl) return;
    const h = serializeHash(s.nav);
    if (h === location.hash) return;
    // o roteiro da TV troca de cena sozinho: não empilha histórico a cada cena
    if (escopo(s.nav) !== escopo(ant.nav) && !(s.nav.tv && ant.nav.tv)) history.pushState(null, '', h);
    else history.replaceState(null, '', h);
  });
  return () => { window.removeEventListener('popstate', aoVoltar); window.removeEventListener('hashchange', aoVoltar); desinscrever(); };
}
