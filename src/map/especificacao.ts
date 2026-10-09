// Tipos compartilhados entre o construtor do desenho, a legenda, os rótulos e a dica.

import type { Caixa } from './camera';
import type { Desenho } from './motor';

export interface ItemLegenda { cor: string; rotulo: string; valor: string }
export interface Legenda {
  itens: ItemLegenda[];
  sufixo?: string;
  rampa?: { cores: string[]; texto: string; titulo: string };
  picos?: boolean;
  nota?: string;
}

export interface FotoRotulo { nome: string; sigla: string; sq?: string; cargo: 'presidente' | 'governador' | 'senador'; uf: string | null }

export type Rotulo =
  | { tipo: 'uf'; id: string; uf: string; x: number; y: number; texto: string; valor?: string; cor?: string; corTexto?: string; chamada?: boolean; fotos?: FotoRotulo[]; aria: string; selecionado?: boolean }
  | { tipo: 'cidade'; id: string; tse: string; x: number; y: number; texto: string; aria: string; selecionado?: boolean }
  | { tipo: 'exterior'; id: string; valor: string; cor: string; aria: string }
  | { tipo: 'lugar'; id: string; x: number; y: number; texto: string }
  | { tipo: 'zona'; id: string; zona: string; x: number; y: number; cor: string; aria: string; selecionado?: boolean };

export interface LinhaDica { nome: string; sigla: string; valor: string; destaque?: boolean }
export interface Dica { titulo: string; subtitulo?: string; linhas: LinhaDica[]; rodape?: string }

export interface ResultadoDesenho {
  desenho: Desenho | null;
  alvo: { caixa: Caixa; margem: number; chave: string } | null;
  legenda: Legenda | null;
  rotulos: Rotulo[];
  carregando: boolean;
  aviso?: string | null;
}
