import { useEstado, type PerfilRef } from '../../app/store';

/**
 * Abre a ficha de uma candidatura. Para cargos majoritários com mapa disponível no contexto
 * (presidente no Brasil/UF; governador e Senado na UF), também seleciona o mapa da
 * candidatura e guarda a camada anterior para restaurá-la ao fechar.
 */
export function abrirPerfil(p: PerfilRef) {
  const s = useEstado.getState();
  const nav = s.nav;
  const temMapa = (p.cargo === 'presidente' && !nav.zz) || ((p.cargo === 'governador' || p.cargo === 'senador') && !!nav.uf && nav.uf === p.uf);
  if (temMapa && !nav.tv) {
    s.set({ perfil: p, camadaAntesDoPerfil: s.camadaAntesDoPerfil ?? { camada: nav.camada, cand: nav.cand } });
    s.navegar({ camada: 'cand', cand: p.n });
  } else {
    s.set({ perfil: p });
  }
}

export function fecharPerfil() {
  const s = useEstado.getState();
  const ant = s.camadaAntesDoPerfil;
  s.set({ perfil: null, camadaAntesDoPerfil: null });
  if (ant) s.navegar({ camada: ant.camada, cand: ant.cand });
}
