// Índice da busca unificada. Normaliza Unicode, caixa, acentos e espaços; prioriza
// correspondência exata, depois prefixo, prefixo de palavra e trecho; desempata pelo porte.

import { normalizar, tituloLugar } from '../../data/formato';
import { UF_NOME } from '../../app/dados';
import type { GeoBrasil, GeoMundo } from '../../map/geo';
import type { BuscaDeputados, Catalogo, MunicipiosPresidente } from '../../data/contratos';

export type Grupo = 'Estados' | 'Municípios' | 'Zonas' | 'Exterior' | 'Candidaturas' | 'Deputados';
export interface Item {
  id: string;
  grupo: Grupo;
  titulo: string;
  detalhe: string;
  selo: string;
  chave: string;
  palavras: string[];
  peso: number;
  acao:
    | { tipo: 'uf'; uf: string }
    | { tipo: 'mun'; uf: string; ibge: string }
    | { tipo: 'zona'; uf: string; ibge: string; zona: string }
    | { tipo: 'pais'; iso: string }
    | { tipo: 'cidade'; tse: string; pais: string }
    | { tipo: 'cand'; cargo: 'presidente' | 'governador' | 'senador'; uf: string | null; n: string; sq: string; partido: string }
    | { tipo: 'dep'; uf: string; casa: 'f' | 'e' | 'd'; n: string; sq: string; partido: string };
}

const compactoEl = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${n >= 2e6 ? 'milhões' : 'milhão'} de eleitores` : n >= 1e3 ? `${Math.round(n / 1e3)} mil eleitores` : `${n} eleitores`);

function item(p: Omit<Item, 'chave' | 'palavras'> & { busca: string }): Item {
  const chave = normalizar(p.busca);
  return { ...p, chave, palavras: chave.split(' ') };
}

export function construirIndice(geo: GeoBrasil, mundo: GeoMundo | null, cat: Catalogo, mun: MunicipiosPresidente | null, zonas: Record<string, number[]> | undefined, dep: BuscaDeputados | null): Item[] {
  const itens: Item[] = [];
  for (const u of geo.ufs) itens.push(item({ id: `uf-${u.uf}`, grupo: 'Estados', titulo: u.nome, detalhe: `Estado · ${u.regiao}`, selo: u.uf, busca: `${u.nome} ${u.uf}`, peso: 1e9, acao: { tipo: 'uf', uf: u.uf } }));
  const eleitorado = new Map<string, number>();
  if (mun) mun.tse.forEach((t, i) => eleitorado.set(t, mun.eleitorado[i] ?? 0));
  for (let i = 0; i < geo.n; i++) {
    const el = eleitorado.get(geo.tse[i]) ?? 0;
    itens.push(item({ id: `m-${geo.ibge[i]}`, grupo: 'Municípios', titulo: geo.nome[i], detalhe: `Município · ${el ? compactoEl(el) : UF_NOME[geo.uf[i]]}`, selo: geo.uf[i], busca: geo.nome[i], peso: el, acao: { tipo: 'mun', uf: geo.uf[i], ibge: geo.ibge[i] } }));
  }
  for (const [tse, zs] of Object.entries(zonas ?? {})) {
    const i = geo.porTse.get(tse);
    if (i == null) continue;
    for (const z of zs) itens.push(item({ id: `z-${tse}-${z}`, grupo: 'Zonas', titulo: `${z}ª zona · ${geo.nome[i]}`, detalhe: `Zona eleitoral · ${geo.uf[i]}`, selo: 'Z', busca: `zona ${z} ${geo.nome[i]}`, peso: (eleitorado.get(tse) ?? 0) / zs.length, acao: { tipo: 'zona', uf: geo.uf[i], ibge: geo.ibge[i], zona: String(z) } }));
  }
  if (mundo) {
    const paises = new Map<string, number>();
    for (const c of mundo.cidades) paises.set(c.pais, (paises.get(c.pais) ?? 0) + 1);
    for (const [iso, n] of paises) {
      const nome = mundo.porIso.get(iso)?.nome ?? (iso === 'GF' ? 'Guiana Francesa' : iso);
      itens.push(item({ id: `p-${iso}`, grupo: 'Exterior', titulo: nome, detalhe: `País · ${n} ${n === 1 ? 'cidade' : 'cidades'}`, selo: iso, busca: `${nome} ${iso}`, peso: 1e8 + n, acao: { tipo: 'pais', iso } }));
    }
    for (const c of mundo.cidades) {
      const nome = tituloLugar(c.nome);
      itens.push(item({ id: `c-${c.tse}`, grupo: 'Exterior', titulo: nome, detalhe: `Cidade · ${mundo.porIso.get(c.pais)?.nome ?? c.paisNome}`, selo: c.pais, busca: `${nome} ${(c as { nomeNE?: string }).nomeNE ?? ''}`, peso: 1e7, acao: { tipo: 'cidade', tse: c.tse, pais: c.pais } }));
    }
  }
  const cand = (cargo: 'presidente' | 'governador' | 'senador', uf: string | null, lista: Catalogo['presidente']) => {
    for (const c of lista) itens.push(item({
      id: `k-${cargo}-${uf ?? 'br'}-${c.n}`, grupo: 'Candidaturas', titulo: c.nome,
      detalhe: `${cargo === 'presidente' ? 'Presidente' : cargo === 'governador' ? `Governador · ${uf}` : `Senado · ${uf}`} · ${c.partido} ${c.n}`,
      selo: c.n, busca: `${c.nome} ${c.nomeCompleto} ${c.n} ${c.partido}`, peso: cargo === 'presidente' ? 3e9 : 2e9, acao: { tipo: 'cand', cargo, uf, n: c.n, sq: c.sq, partido: c.partido },
    }));
  };
  cand('presidente', null, cat.presidente);
  for (const [uf, l] of Object.entries(cat.governador)) cand('governador', uf, l);
  for (const [uf, l] of Object.entries(cat.senador)) cand('senador', uf, l);
  if (dep) {
    for (const [n, nome, partido, uf, casa, votos, , sq] of dep.itens) {
      itens.push(item({ id: `d-${uf}-${casa}-${n}-${sq}`, grupo: 'Deputados', titulo: nome, detalhe: `${casa === 'f' ? 'Deputado(a) federal' : casa === 'd' ? 'Deputado(a) distrital' : 'Deputado(a) estadual'} · ${uf} · ${partido} ${n}`, selo: n, busca: `${nome} ${n} ${partido}`, peso: votos, acao: { tipo: 'dep', uf, casa, n, sq, partido } }));
    }
  }
  return itens;
}

const LIMITES: Record<Grupo, number> = { Estados: 4, Municípios: 7, Zonas: 4, Exterior: 4, Candidaturas: 6, Deputados: 6 };

export function buscar(itens: Item[], consulta: string, ufContexto: string | null): { grupo: Grupo; itens: Item[] }[] {
  const q = normalizar(consulta);
  if (!q) return [];
  const termos = q.split(' ');
  const numero = /^\d{2,5}$/.test(q) ? q : null;
  const pontuados: { it: Item; s: number }[] = [];
  for (const it of itens) {
    let s = 0;
    if (numero && (it.grupo === 'Candidaturas' || it.grupo === 'Deputados') && it.selo === numero) s = 900;
    else if (it.chave === q) s = 1000;
    else if (it.chave.startsWith(q)) s = 800;
    else if (termos.every((t) => it.palavras.some((p) => p.startsWith(t)))) s = 600;
    else if (q.length >= 3 && it.chave.includes(q)) s = 300;
    if (!s) continue;
    if (ufContexto && 'uf' in it.acao && it.acao.uf === ufContexto) s += 120;
    pontuados.push({ it, s: s + Math.log10(1 + it.peso) });
  }
  pontuados.sort((a, b) => b.s - a.s);
  const porGrupo = new Map<Grupo, Item[]>();
  const vistos = new Set<string>();
  for (const { it } of pontuados) {
    if (vistos.has(it.id)) continue;
    vistos.add(it.id);
    const l = porGrupo.get(it.grupo) ?? [];
    if (l.length >= LIMITES[it.grupo]) continue;
    l.push(it);
    porGrupo.set(it.grupo, l);
  }
  const ordem: Grupo[] = q.startsWith('zona') ? ['Zonas', 'Municípios', 'Estados', 'Exterior', 'Candidaturas', 'Deputados'] : ['Estados', 'Municípios', 'Candidaturas', 'Exterior', 'Zonas', 'Deputados'];
  // a ordem dos grupos segue a melhor pontuação de cada um, com a ordem fixa como desempate
  const melhor = (g: Grupo) => pontuados.find((p) => p.it.grupo === g)?.s ?? -1;
  return ordem.filter((g) => porGrupo.has(g)).sort((a, b) => Math.floor(melhor(b) / 100) - Math.floor(melhor(a) / 100) || ordem.indexOf(a) - ordem.indexOf(b)).map((g) => ({ grupo: g, itens: porGrupo.get(g)! }));
}

export function sugestoes(itens: Item[], uf: string | null): { grupo: string; itens: Item[] } {
  const muns = itens.filter((i) => i.grupo === 'Municípios' && (!uf || (i.acao.tipo === 'mun' && i.acao.uf === uf))).sort((a, b) => b.peso - a.peso).slice(0, 6);
  return { grupo: uf ? `Maiores cidades de ${UF_NOME[uf]}` : 'Maiores cidades do Brasil', itens: muns };
}
