import bruto from '../../config/marca.json';

export interface Campanha {
  id: string;
  ativa: boolean;
  demonstracao?: boolean;
  marca: string;
  faixa: { titulo: string; texto: string; detalhe: string; acao: string };
  card: { titulo: string; detalhe: string; acao: string };
  modal: { titulo: string; texto: string; acao: string };
  destino: string | null;
  abre?: 'anuncio' | 'acesso';
  cores: { fundo: string; texto: string; destaque: string };
  vigencia?: { inicio: string; fim: string };
}

export interface Marca {
  titulo: string;
  autoria: { rotulo: string; nome: string; url: string | null };
  redes: { rede: 'x' | 'instagram'; rotulo: string; url: string }[];
  dominio: string;
  faixaInstitucional: { ativa: boolean; texto: string; acao: string; abre: 'acesso' | 'anuncio' };
  convite: { titulo: string; texto: string; rodape: string };
  anuncieAqui: { titulo: string; texto: string; rodape: string };
  campanhas: Campanha[];
}

export const MARCA = bruto as unknown as Marca;

/** Campanha vigente (ativa e dentro da vigência). */
export function campanhaAtiva(agora = new Date()): Campanha | null {
  for (const c of MARCA.campanhas) {
    if (!c.ativa) continue;
    if (c.vigencia) {
      const ini = Date.parse(`${c.vigencia.inicio}T00:00:00-03:00`), fim = Date.parse(`${c.vigencia.fim}T23:59:59-03:00`);
      if (agora.getTime() < ini || agora.getTime() > fim) continue;
    }
    return c;
  }
  return null;
}
