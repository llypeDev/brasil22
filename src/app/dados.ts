// Acesso aos dados derivados usados pelas telas.

import { useEffect, useMemo, useState } from 'react';
import { carregarBrasil, carregarMundo, carregarZonasGeo, type GeoBrasil, type GeoMundo, type ZonasGeo } from '../map/geo';
import { useEstado } from './store';
import { useFeed } from '../data/useFeed';
import { validarColunar } from '../data/validar';
import type {
  Agora, BuscaDeputados, Candidato, DeputadosBr, DeputadosUf, Evento, Exterior, Historico, IndiceArquivo, MunicipiosPresidente, Presidente2022,
  Resultado, SenadoMantidas, UfMunicipal, Zonas,
} from '../data/contratos';
import type { Cargo } from './hash';

let promessaBrasil: Promise<GeoBrasil> | null = null;
let promessaMundo: Promise<GeoMundo> | null = null;

function usePromessa<T>(fabrica: () => Promise<T>, ativo = true) {
  const [v, setV] = useState<{ dados: T | null; erro: Error | null }>({ dados: null, erro: null });
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    fabrica().then((d) => vivo && setV({ dados: d, erro: null })).catch((e) => vivo && setV({ dados: null, erro: e as Error }));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);
  return v;
}

export const obterGeoBrasil = () => (promessaBrasil ??= carregarBrasil().catch((e) => { promessaBrasil = null; throw e; }));
export const obterGeoMundo = () => (promessaMundo ??= carregarMundo().catch((e) => { promessaMundo = null; throw e; }));
export const useGeoBrasil = () => usePromessa(obterGeoBrasil);
export const useGeoMundo = (ativo: boolean) => usePromessa(obterGeoMundo, ativo);

/** Áreas aproximadas das zonas de um município (código TSE), quando existem. */
export function useZonasGeo(tse: string | null) {
  const [v, setV] = useState<{ tse: string | null; dados: ZonasGeo | null }>({ tse: null, dados: null });
  useEffect(() => {
    if (!tse) { setV({ tse: null, dados: null }); return; }
    let vivo = true;
    carregarZonasGeo(tse).then((d) => { if (vivo) setV({ tse, dados: d }); });
    return () => { vivo = false; };
  }, [tse]);
  return v.tse === tse ? v.dados : null;
}

export const cargoInterno = (c: Cargo) => (c === 'governadores' ? 'governador' : c === 'senado' ? 'senador' : c === 'deputados' ? 'deputado' : 'presidente');

export function candidatosDe(cat: ReturnType<typeof useEstado.getState>['catalogo'], cargo: 'presidente' | 'governador' | 'senador', uf: string | null): Candidato[] {
  if (!cat) return [];
  if (cargo === 'presidente') return cat.presidente;
  return uf ? cat[cargo][uf] ?? [] : [];
}

export function resultadoDe(agora: Agora | null | undefined, cargo: 'presidente' | 'governador' | 'senador', uf: string | null, zz = false): Resultado | null {
  if (!agora) return null;
  if (cargo === 'presidente') return zz ? agora.presidente.zz : uf ? agora.presidente.uf[uf] ?? null : agora.presidente.br;
  return uf ? agora[cargo].uf[uf] ?? null : null;
}

const validarMun = (x: unknown) => validarColunar<MunicipiosPresidente>(x, 'municípios');
export const useMunicipios = () => useFeed<MunicipiosPresidente>('municipios-presidente.json', { validar: validarMun });
export const useUfMunicipal = (uf: string | null) => useFeed<UfMunicipal>(uf ? `uf/${uf.toLowerCase()}.json` : null);
export const useExterior = (ativo: boolean) => useFeed<Exterior>(ativo ? 'exterior.json' : null);
export const useZonas = (tse: string | null) => useFeed<Zonas>(tse ? `zonas/${tse}.json` : null);
export const useEventos = () => useFeed<{ eventos: Evento[] }>('eventos.json');
export const useHistoricoSerie = () => useFeed<Historico>('historico.json', { vivo: true });
export const useIndice = () => useFeed<IndiceArquivo>('arquivo-indice.json', { vivo: true });
export const usePresidente2022 = () => useFeed<Presidente2022>('presidente-2022.json', { vivo: true });
export const useSenadoMantidas = () => useFeed<SenadoMantidas>('senado-mantidas.json', { vivo: true });
export const useDeputadosUf = (uf: string | null) => useFeed<DeputadosUf>(uf ? `deputados/${uf.toLowerCase()}.json` : null);
export const useDeputadosBr = (ativo = true) => useFeed<DeputadosBr>(ativo ? 'deputados/br.json' : null);
export const useBuscaDeputados = (ativo: boolean) => useFeed<BuscaDeputados>(ativo ? 'deputados/busca.json' : null, { vivo: true });

/** Mapeia o índice da coleção colunar para o índice da geometria (por código TSE explícito). */
export function useIndiceGeo(geo: GeoBrasil | null, tse: string[] | undefined) {
  return useMemo(() => {
    if (!geo || !tse) return null;
    const out = new Int32Array(tse.length).fill(-1);
    tse.forEach((c, i) => { out[i] = geo.porTse.get(c) ?? -1; });
    return out;
  }, [geo, tse]);
}

/** Inverso: geometria → coleção. */
export function inverso(mapa: Int32Array | null, n: number) {
  if (!mapa) return null;
  const out = new Int32Array(n).fill(-1);
  mapa.forEach((g, i) => { if (g >= 0) out[g] = i; });
  return out;
}

export const UF_NOME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco',
  PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};
export const UF_ORDEM = Object.keys(UF_NOME);
/** Ordem do eleitorado (maiores primeiro), usada nas grades de UFs. */
export const UF_POR_ELEITORADO = ['SP', 'MG', 'RJ', 'BA', 'PR', 'RS', 'PE', 'CE', 'PA', 'SC', 'MA', 'GO', 'PB', 'AM', 'ES', 'PI', 'RN', 'MT', 'AL', 'DF', 'MS', 'SE', 'RO', 'TO', 'AC', 'AP', 'RR'];
