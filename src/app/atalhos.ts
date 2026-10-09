// Atalhos: Ctrl/Cmd+K e "/" buscam; 1–4 trocam o cargo; +, − e 0 controlam o zoom;
// Esc fecha a camada de interface mais próxima e, sem nenhuma aberta, volta um nível.

import { useEffect } from 'react';
import { useEstado } from './store';
import { CARGOS } from './hash';
import { mapaApi } from '../map/api';
import { fecharPerfil } from '../features/perfil/acoes';
import { sairDaTv } from '../features/tv/controle';
import { definirOrigemBusca } from '../components/Cabecalho';

const editando = (el: EventTarget | null) => {
  const e = el as HTMLElement | null;
  return !!e && (e.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName));
};

/** Fecha a camada temporária do topo. Devolve true se algo foi fechado. */
export function fecharCamadaDoTopo(): boolean {
  const s = useEstado.getState();
  if (s.busca) { s.set({ busca: false }); return true; }
  if (s.formulario) { s.set({ formulario: null }); return true; }
  if (s.campanhaModal) { s.set({ campanhaModal: false }); return true; }
  if (s.metodologia) { s.set({ metodologia: false }); return true; }
  if (s.lista) { s.set({ lista: null }); return true; }
  if (s.perfil) { fecharPerfil(); return true; }
  return false;
}

export function voltarUmNivel(): boolean {
  const s = useEstado.getState();
  const n = s.nav;
  if (n.t != null) { s.navegar({ t: null }); return true; }
  if (n.zona) { s.navegar({ zona: null }); return true; }
  if (n.mun) { s.navegar({ mun: null }); return true; }
  if (n.uf) { s.navegar({ uf: null }); return true; }
  if (n.cidade) { s.navegar({ cidade: null }); return true; }
  if (n.pais) { s.navegar({ pais: null }); return true; }
  if (n.zz) { s.navegar({ zz: false }); return true; }
  if (n.camada === 'cand') { s.navegar({ camada: 'mun' }); return true; }
  return false;
}

export function usarAtalhos() {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const s = useEstado.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        definirOrigemBusca(document.activeElement as HTMLElement | null);
        s.set({ busca: !s.busca });
        return;
      }
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        if (fecharCamadaDoTopo()) { e.preventDefault(); return; }
        if (s.nav.tv) { sairDaTv(); e.preventDefault(); return; }
        if (!editando(e.target) && voltarUmNivel()) e.preventDefault();
        return;
      }
      if (editando(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (s.busca || s.formulario || s.lista || s.campanhaModal || s.metodologia) return;
      if (e.key === '/') { e.preventDefault(); definirOrigemBusca(document.activeElement as HTMLElement | null); s.set({ busca: true }); return; }
      if (['1', '2', '3', '4'].includes(e.key) && !s.nav.tv) { s.navegar({ cargo: CARGOS[Number(e.key) - 1] }); return; }
      if (e.key === '+' || e.key === '=') { mapaApi.aproximar(); return; }
      if (e.key === '-' || e.key === '_') { mapaApi.afastar(); return; }
      if (e.key === '0') { mapaApi.reiniciar(); }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);
}
