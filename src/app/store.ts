// Estado central. Três grupos separados: navegação (espelha a URL), dados ao vivo e
// interface temporária. Um lote novo de dados nunca mexe em navegação nem em interface.

import { create } from 'zustand';
import type { Agora, Catalogo, Manifesto, Modo } from '../data/contratos';
import { ESTADO_INICIAL, parseHash, type Camada, type Cargo, type EstadoUrl } from './hash';
import { turnoPadrao } from './modo';

export type Conexao = 'conectando' | 'ao-vivo' | 'reconectando' | 'sem-conexao';
export type CargoPerfil = 'presidente' | 'governador' | 'senador' | 'deputado';
export interface PerfilRef { cargo: CargoPerfil; uf: string | null; n: string; sq?: string; casa?: 'f' | 'e' | 'd' }
export type ListaRef =
  | { tipo: 'candidatos'; cargo: 'presidente' | 'governador' | 'senador'; uf: string | null }
  | { tipo: 'deputados'; casa: 'f' | 'e'; uf: string | null; destaque?: string | null };

export interface Estado {
  nav: EstadoUrl;
  modo: Modo;
  manifesto: Manifesto | null;
  catalogo: Catalogo | null;
  agoraVivo: Agora | null;
  seq: number | null;
  conexao: Conexao;
  ultimoSucesso: number | null;
  erroConexao: string | null;
  avisoDados: string | null;
  proximaTentativa: number | null;

  busca: boolean;
  perfil: PerfilRef | null;
  camadaAntesDoPerfil: { camada: Camada; cand: string | null } | null;
  lista: ListaRef | null;
  formulario: 'acesso' | 'anuncio' | null;
  campanhaModal: boolean;
  metodologia: boolean;
  casa: 'f' | 'e';
  tocando: boolean;
  pessoas: number | null;
  tvAutomatico: boolean;
  /** cena atual do roteiro da TV (o roteiro altera a navegação, mas guardamos a de antes) */
  navAntesDaTv: EstadoUrl | null;

  navegar: (p: Partial<EstadoUrl>) => void;
  definirNav: (nav: EstadoUrl) => void;
  set: (p: Partial<Estado>) => void;
}

/** Regras de compatibilidade ao navegar (ex.: exterior só existe para presidente). */
export function normalizarNav(atual: EstadoUrl, p: Partial<EstadoUrl>): EstadoUrl {
  const n: EstadoUrl = { ...atual, ...p };
  // Cargos, lugares, camadas, instante e TV só existem no 1º turno: navegar por eles sai da
  // página do 2º turno. Ao trocar só o turno, o 1º turno volta ao ponto em que estava.
  if (p.turno == null && Object.keys(p).length > 0) n.turno = 1;
  if (n.turno === 2) { n.tv = false; n.t = null; }
  const trocouCargo = p.cargo != null && p.cargo !== atual.cargo;
  if (n.zz) { n.uf = null; n.mun = null; n.zona = null; }
  if (n.zz && n.cargo !== 'presidente') { n.zz = false; n.pais = null; n.cidade = null; }
  if (!n.zz) { n.pais = null; n.cidade = null; }
  if (n.cidade) n.pais = p.pais ?? atual.pais ?? n.pais;
  if (!n.uf) { n.mun = null; n.zona = null; }
  if (!n.mun) n.zona = null;
  if (n.cargo === 'deputados') { n.mun = null; n.zona = null; }
  if (trocouCargo) {
    n.cand = null;
    n.camada = n.cargo === 'presidente' ? (p.camada ?? (atual.camada === 'cand' ? 'mun' : atual.camada)) : n.cargo === 'governadores' ? (p.camada ?? 'mun') : 'mun';
    if (n.cargo !== 'presidente' && n.camada === 'votes' && !n.uf) n.camada = 'mun';
  }
  if (n.camada !== 'cand') n.cand = null;
  if (n.camada === 'cand' && !n.cand) n.camada = 'mun';
  return n;
}

export const useEstado = create<Estado>((set, get) => ({
  // lido já na criação para a primeira pintura não mostrar o turno errado
  nav: typeof location === 'undefined' ? ESTADO_INICIAL : parseHash(location.hash, {}, turnoPadrao()),
  modo: 'oficial',
  manifesto: null,
  catalogo: null,
  agoraVivo: null,
  seq: null,
  conexao: 'conectando',
  ultimoSucesso: null,
  erroConexao: null,
  avisoDados: null,
  proximaTentativa: null,

  busca: false,
  perfil: null,
  camadaAntesDoPerfil: null,
  lista: null,
  formulario: null,
  campanhaModal: false,
  metodologia: false,
  casa: 'f',
  tocando: false,
  pessoas: null,
  tvAutomatico: true,
  navAntesDaTv: null,

  navegar: (p) => set({ nav: normalizarNav(get().nav, p) }),
  definirNav: (nav) => set({ nav }),
  set: (p) => set(p),
}));

export const cargoDoPerfil = (c: Cargo): CargoPerfil => (c === 'governadores' ? 'governador' : c === 'senado' ? 'senador' : c === 'deputados' ? 'deputado' : 'presidente');
