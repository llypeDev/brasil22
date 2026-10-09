// Monta o que o mapa desenha em cada contexto (cargo × escopo × camada).

import { useCallback, useMemo } from 'react';
import { useEstado } from '../app/store';
import { useAgora } from '../data/useFeed';
import { useDeputadosBr, useExterior, useGeoBrasil, useGeoMundo, useIndiceGeo, useMunicipios, useUfMunicipal, useZonas, useZonasGeo, UF_NOME, candidatosDe, inverso } from '../app/dados';
import { indicadores, limitesCandidato, linhas, parcelaColunar, resultadoDoItem, fracaoSecoes, vantagem, somarItens, type Indicadores } from '../data/calculos';
import { partido, siglaExibicao, COR_SEM_DADOS } from '../data/partidos';
import { compacto, num, pctS, tituloLugar } from '../data/formato';
import { alturaPico, corApurado, corDisputa, corPorLimites, corVantagem, rampaCandidato, tonsVantagem, RAMPA_APURADO, misturar } from './cores';
import type { Alvo, CorUf, Pico } from './motor';
import type { Caixa } from './camera';
import type { Dica, Legenda, ResultadoDesenho, Rotulo } from './especificacao';
import type { Candidato, Colunar, Resultado } from '../data/contratos';

export const CHAMADAS = ['RN', 'PB', 'PE', 'AL', 'SE', 'ES', 'RJ'];
const NEUTRO_PICOS = '#E7E7E4';

function caixaMin(c: Caixa, min: number): Caixa {
  const w = c[2] - c[0], h = c[3] - c[1];
  const cx = (c[0] + c[2]) / 2, cy = (c[1] + c[3]) / 2;
  const W = Math.max(w, min), H = Math.max(h, min);
  return [cx - W / 2, cy - H / 2, cx + W / 2, cy + H / 2];
}

function contarLideres(ind: Indicadores, cands: string[], partidoDe: (n: string) => string) {
  const cont = new Map<string, number>();
  for (let i = 0; i < ind.n; i++) if (ind.lider[i] >= 0) { const p = partidoDe(cands[ind.lider[i]]); cont.set(p, (cont.get(p) ?? 0) + 1); }
  return [...cont.entries()].sort((a, b) => b[1] - a[1]);
}

function itensLegenda(contagem: [string, number][], max = 4) {
  const itens = contagem.slice(0, max).map(([p, n]) => ({ cor: partido(p).cor, rotulo: siglaExibicao(p), valor: num(n) }));
  const outros = contagem.slice(max).reduce((s, [, n]) => s + n, 0);
  if (outros) itens.push({ cor: '', rotulo: 'Outros', valor: num(outros) });
  return itens;
}

const legVantagem = (sigla: string) => ({ cores: tonsVantagem(sigla), texto: 'até 10 · 25 · 45 · mais pontos', titulo: 'Vantagem do líder, em pontos' });

export function useDesenho(escalaPicos = 100) {
  const nav = useEstado((s) => s.nav);
  const catalogo = useEstado((s) => s.catalogo);
  const casa = useEstado((s) => s.casa);
  const { agora, semRegistro } = useAgora();
  const geo = useGeoBrasil().dados;
  const mundo = useGeoMundo(nav.zz).dados;
  const presMun = useMunicipios();
  const cargoUf = nav.cargo === 'governadores' ? 'governador' : nav.cargo === 'senado' ? 'senador' : null;
  const ufMun = useUfMunicipal(cargoUf && nav.uf ? nav.uf : null);
  const ext = useExterior(nav.zz);
  const comZonas = useEstado((s) => s.manifesto?.municipiosComZonas);
  const tseMun = geo && nav.mun ? geo.tse[geo.porIbge.get(nav.mun) ?? -1] ?? null : null;
  const tseZonas = nav.cargo === 'presidente' && tseMun && (comZonas ?? []).includes(tseMun) ? tseMun : null;
  const zonasGeo = useZonasGeo(tseZonas);
  const zonasRes = useZonas(tseZonas);
  const dep = useDeputadosBr(nav.cargo === 'deputados');
  const mapaPres = useIndiceGeo(geo, presMun.dados?.tse);
  const colUf: Colunar | null = cargoUf && ufMun.dados ? ufMun.dados[cargoUf] : null;
  const mapaUf = useIndiceGeo(geo, colUf?.tse);

  const validoPres = useMemo(() => presMun.dados?.candidatos.map((n) => catalogo?.presidente.find((c) => c.n === n)?.destino !== 'anulado') ?? [], [presMun.dados, catalogo]);
  const indPres = useMemo(() => (presMun.dados ? indicadores(presMun.dados, validoPres) : null), [presMun.dados, validoPres]);
  const candsUf = useMemo(() => (cargoUf && nav.uf ? candidatosDe(catalogo, cargoUf, nav.uf) : []), [catalogo, cargoUf, nav.uf]);
  const validoUf = useMemo(() => colUf?.candidatos.map((n) => candsUf.find((c) => c.n === n)?.destino !== 'anulado') ?? [], [colUf, candsUf]);
  const indUf = useMemo(() => (colUf ? indicadores(colUf, validoUf) : null), [colUf, validoUf]);

  const partidoPres = useCallback((n: string) => catalogo?.presidente.find((c) => c.n === n)?.partido ?? '', [catalogo]);

  const res = useMemo((): ResultadoDesenho => {
    const vazio: ResultadoDesenho = { desenho: null, alvo: null, legenda: null, rotulos: [], carregando: true };
    if (!geo || !catalogo) return vazio;
    const ufIdx = nav.uf ? geo.ufIndice.get(nav.uf) ?? -1 : -1;
    const munIdx = nav.mun ? geo.porIbge.get(nav.mun) ?? -1 : -1;
    const alvoBr = { caixa: geo.caixaContinental, margem: 0.035, chave: 'br' };
    const alvoEscopo = munIdx >= 0
      ? { caixa: caixaMin([geo.caixa[munIdx * 4], geo.caixa[munIdx * 4 + 1], geo.caixa[munIdx * 4 + 2], geo.caixa[munIdx * 4 + 3]], 45), margem: 0.08, chave: `mun-${nav.mun}` }
      : ufIdx >= 0 ? { caixa: caixaMin(geo.ufs[ufIdx].caixa, 160), margem: 0.06, chave: `uf-${nav.uf}` } : alvoBr;

    // ---------- Exterior ----------
    if (nav.zz && nav.cargo === 'presidente') {
      if (!mundo) return { ...vazio, alvo: null };
      const col = ext.dados?.cidades ?? null;
      const ind = col ? indicadores(col, col.candidatos.map((n) => catalogo.presidente.find((c) => c.n === n)?.destino !== 'anulado')) : null;
      const maxEl = col ? Math.max(1, ...col.eleitorado.map((v) => v ?? 0)) : 1;
      const cidades = mundo.cidades.map((c) => {
        const i = col ? col.tse.indexOf(c.tse) : -1;
        const el = i >= 0 ? col!.eleitorado[i] ?? 0 : 0;
        const lider = i >= 0 && ind && ind.lider[i] >= 0 ? partidoPres(col!.candidatos[ind.lider[i]]) : null;
        return { tse: c.tse, x: c.x, y: c.y, r: 1.6 + 8.5 * Math.sqrt(el / maxEl), cor: lider ? corVantagem(lider, ind!.margem[i]) : '#BDBDBA' };
      });
      const coresUf = geo.ufs.map((u) => {
        const r = agora?.presidente.uf[u.uf];
        const v = r ? vantagem(linhas(r, catalogo.presidente)) : null;
        return v ? corVantagem(v.lider.c.partido, v.pontos ?? 0) : null;
      });
      const ordemUfMundo = mundo.brasilUfs.map((u) => coresUf[geo.ufIndice.get(u.uf) ?? -1] ?? null);
      const cont = ind && col ? contarLideres(ind, col.candidatos, partidoPres) : [];
      let alvo = { caixa: mundo.caixaTotal as Caixa, margem: 0.02, chave: 'zz' };
      if (nav.cidade) {
        const c = mundo.cidadePorTse.get(nav.cidade);
        if (c) alvo = { caixa: [c.x - 160, c.y - 110, c.x + 160, c.y + 110], margem: 0.05, chave: `cidade-${nav.cidade}` };
      } else if (nav.pais) {
        const cs = mundo.cidades.filter((c) => c.pais === nav.pais);
        if (cs.length) {
          const cx: Caixa = [Math.min(...cs.map((c) => c.x)), Math.min(...cs.map((c) => c.y)), Math.max(...cs.map((c) => c.x)), Math.max(...cs.map((c) => c.y))];
          alvo = { caixa: caixaMin(cx, 320), margem: 0.14, chave: `pais-${nav.pais}` };
        }
      }
      const top = col ? [...mundo.cidades].map((c) => ({ c, el: col.eleitorado[col.tse.indexOf(c.tse)] ?? 0 })).sort((a, b) => b.el - a.el) : [];
      const visiveis = nav.pais ? top.filter((x) => x.c.pais === nav.pais) : top.slice(0, 6);
      const rotulos: Rotulo[] = visiveis.slice(0, nav.pais ? 12 : 6).map(({ c }) => ({ tipo: 'cidade', id: `c${c.tse}`, tse: c.tse, x: c.x, y: c.y, texto: tituloLugar(c.nome), aria: tituloLugar(c.nome), selecionado: c.tse === nav.cidade }));
      const lid = cont[0]?.[0];
      return {
        desenho: { tipo: 'mundo', geo: mundo, coresUf: ordemUfMundo, cidades, paisFoco: nav.pais, cidadeSelecionada: nav.cidade },
        alvo, rotulos, carregando: ext.carregando || !col,
        legenda: { itens: itensLegenda(cont, 3), sufixo: 'cidades', rampa: lid ? legVantagem(lid) : undefined },
      };
    }

    // ---------- Presidente no Brasil / UF / município ----------
    if (nav.cargo === 'presidente') {
      const col = presMun.dados;
      const ind = indPres;
      const camada = nav.camada;
      const ufFoco = nav.uf;
      const coresMun: (string | null)[] = new Array(geo.n).fill(null);
      let picos: Pico[] | null = null;
      let legenda: Legenda | null = null;
      let modo: 'municipios' | 'ufs' = 'municipios';
      let coresUf: CorUf[] | null = null;
      const semMapa = semRegistro;
      if (col && ind && mapaPres && !semMapa) {
        const cont = contarLideres(ind, col.candidatos, partidoPres);
        if (camada === 'mun' || (camada === 'uf' && ufFoco)) {
          for (let i = 0; i < col.tse.length; i++) { const g = mapaPres[i]; if (g < 0 || ind.lider[i] < 0) continue; coresMun[g] = corVantagem(partidoPres(col.candidatos[ind.lider[i]]), ind.margem[i]); }
          const contF = ufFoco ? contarLideres({ ...ind, lider: ind.lider.map((l, i) => (geo.uf[mapaPres[i]] === ufFoco ? l : -1)) as Int16Array }, col.candidatos, partidoPres) : cont;
          legenda = { itens: itensLegenda(contF, 2), sufixo: 'municípios', rampa: contF[0] ? legVantagem(contF[0][0]) : undefined };
        } else if (camada === 'uf') {
          modo = 'ufs';
          const c2 = new Map<string, number>();
          coresUf = geo.ufs.map((u) => {
            const r = agora?.presidente.uf[u.uf];
            const v = r ? vantagem(linhas(r, catalogo.presidente)) : null;
            if (!v) return null;
            c2.set(v.lider.c.partido, (c2.get(v.lider.c.partido) ?? 0) + 1);
            return corVantagem(v.lider.c.partido, v.pontos ?? 0);
          });
          const contU = [...c2.entries()].sort((a, b) => b[1] - a[1]);
          legenda = { itens: itensLegenda(contU, 2), sufixo: 'estados', rampa: contU[0] ? legVantagem(contU[0][0]) : undefined };
        } else if (camada === 'votes') {
          picos = [];
          const soma = new Map<string, number>();
          for (let i = 0; i < col.tse.length; i++) {
            const g = mapaPres[i]; if (g < 0) continue;
            coresMun[g] = (col.validos[i] ?? 0) > 0 ? NEUTRO_PICOS : null;
            if (ind.lider[i] < 0 || ind.margemVotos[i] <= 0) continue;
            if (ufFoco && geo.uf[g] !== ufFoco) continue;
            const p = partidoPres(col.candidatos[ind.lider[i]]);
            soma.set(p, (soma.get(p) ?? 0) + ind.margemVotos[i]);
            picos.push({ i: g, h: alturaPico(ind.margemVotos[i], escalaPicos * (ufFoco ? 1.6 : 1)), cor: partido(p).cor });
          }
          const ss = [...soma.entries()].sort((a, b) => b[1] - a[1]);
          legenda = { itens: ss.slice(0, 2).map(([p, v]) => ({ cor: partido(p).cor, rotulo: siglaExibicao(p), valor: `+${compacto(v).replace(' milhões', ' mi').replace(' milhão', ' mi')}` })), picos: true };
        } else if (camada === 'apur') {
          for (let i = 0; i < col.tse.length; i++) { const g = mapaPres[i]; if (g < 0 || col.secoes[i] == null) continue; coresMun[g] = corApurado(ind.fracao[i]); }
          legenda = { itens: [], rampa: { cores: RAMPA_APURADO, texto: 'até 25 · 50 · 75 · 99 · 100% das seções', titulo: 'Seções totalizadas' } };
        } else if (camada === 'cand' && nav.cand) {
          const idx = col.candidatos.indexOf(nav.cand);
          const parc = parcelaColunar(col, idx);
          const lim = limitesCandidato(parc, col.validos, 6);
          const sigla = partidoPres(nav.cand);
          const rampa = rampaCandidato(sigla, lim.length + 1);
          for (let i = 0; i < col.tse.length; i++) { const g = mapaPres[i]; if (g < 0) continue; coresMun[g] = Number.isNaN(parc[i]) ? null : corPorLimites(parc[i], lim, rampa); }
          const c = catalogo.presidente.find((x) => x.n === nav.cand);
          legenda = { itens: c ? [{ cor: partido(sigla).cor, rotulo: c.nome, valor: '' }] : [], rampa: { cores: rampa, texto: `${lim.map((v) => Math.round(v * 100)).join(' · ')}%`, titulo: `Participação de ${c?.nome ?? 'candidatura'}` } };
        }
      }
      // rótulos de UF (somente na vista nacional)
      const rotulos: Rotulo[] = [];
      if (!ufFoco && agora) {
        for (const u of geo.ufs) {
          const r = agora.presidente.uf[u.uf];
          const ls = linhas(r, catalogo.presidente);
          const v = vantagem(ls);
          let valor = v?.lider.parcela != null ? `${Math.round(v.lider.parcela * 100)}%` : '';
          let cor = v ? partido(v.lider.c.partido).cor : undefined;
          let corTexto = v ? partido(v.lider.c.partido).texto : undefined;
          if (camada === 'apur') { valor = `${Math.floor(fracaoSecoes(r) * 100)}%`; cor = '#3C3F40'; corTexto = '#3C3F40'; }
          if (camada === 'cand' && nav.cand) { const l = ls.find((x) => x.c.n === nav.cand); valor = l?.parcela != null ? `${Math.round(l.parcela * 100)}%` : ''; cor = partido(partidoPres(nav.cand)).cor; corTexto = partido(partidoPres(nav.cand)).texto; }
          rotulos.push({ tipo: 'uf', id: u.uf, uf: u.uf, x: u.rotulo[0], y: u.rotulo[1], texto: u.uf, valor, cor, corTexto, chamada: CHAMADAS.includes(u.uf), aria: `${u.nome}${v ? `, ${v.lider.c.nome} ${pctS(v.lider.parcela, 1)}` : ''}` });
        }
        const zz = agora.presidente.zz;
        const vz = vantagem(linhas(zz, catalogo.presidente));
        if (vz) rotulos.push({ tipo: 'exterior', id: 'zz', valor: `${Math.round((vz.lider.parcela ?? 0) * 100)}%`, cor: partido(vz.lider.c.partido).cor, aria: `Exterior, ${vz.lider.c.nome} ${pctS(vz.lider.parcela, 1)}` });
      }
      // zonas eleitorais (áreas aproximadas) do município selecionado
      let zonas: { geo: NonNullable<typeof zonasGeo>; cores: Record<string, string | null> } | null = null;
      if (zonasGeo && zonasRes.dados && munIdx >= 0 && !semMapa) {
        const zc = zonasRes.dados;
        const indZ = indicadores(zc, zc.candidatos.map((n) => catalogo.presidente.find((c) => c.n === n)?.destino !== 'anulado'));
        const parcZ = camada === 'cand' && nav.cand ? parcelaColunar(zc, zc.candidatos.indexOf(nav.cand)) : null;
        const limZ = parcZ ? limitesCandidato(parcZ, zc.validos, 6) : [];
        const rampaZ = parcZ ? rampaCandidato(partidoPres(nav.cand!), limZ.length + 1) : [];
        const cores: Record<string, string | null> = {};
        const contZ = new Map<string, number>();
        zc.tse.forEach((z, k) => {
          const chave = String(Number(z));
          if (camada === 'apur') cores[chave] = corApurado(indZ.fracao[k]);
          else if (parcZ) cores[chave] = Number.isNaN(parcZ[k]) ? null : corPorLimites(parcZ[k], limZ, rampaZ);
          else cores[chave] = indZ.lider[k] >= 0 ? corVantagem(partidoPres(zc.candidatos[indZ.lider[k]]), indZ.margem[k]) : null;
          if (indZ.lider[k] >= 0) { const p = partidoPres(zc.candidatos[indZ.lider[k]]); contZ.set(p, (contZ.get(p) ?? 0) + 1); }
        });
        zonas = { geo: zonasGeo, cores };
        for (const z of zonasGeo.zonas) {
          if (!z.rotulo) continue;
          rotulos.push({ tipo: 'zona', id: `z${z.zona}`, zona: z.zona, x: z.rotulo[0], y: z.rotulo[1], cor: cores[z.zona] ?? '#999', aria: `Zona ${z.zona} (área aproximada)`, selecionado: z.zona === nav.zona });
        }
        if (camada !== 'apur' && !parcZ) {
          const cz = [...contZ.entries()].sort((a, b) => b[1] - a[1]);
          legenda = { itens: itensLegenda(cz, 2), sufixo: 'zonas', rampa: cz[0] ? legVantagem(cz[0][0]) : undefined };
        }
      }
      return {
        desenho: { tipo: 'brasil', geo, modo, coresMun: modo === 'municipios' ? coresMun : null, coresUf, ufFoco, picos, selecionado: munIdx >= 0 ? munIdx : null, ufSelecionada: ufFoco, zonas, zonaSelecionada: nav.zona },
        alvo: alvoEscopo, legenda, rotulos, carregando: presMun.carregando || !col,
        aviso: semMapa ? 'Sem registro do mapa neste instante: o TSE não publica série histórica. Volte ao atual para ver o mapa.' : null,
      };
    }

    // ---------- Governador / Senado ----------
    if (cargoUf) {
      const senado = cargoUf === 'senador';
      if (!nav.uf) {
        const cont = new Map<string, number>();
        const rotulos: Rotulo[] = [];
        const coresUf: CorUf[] = geo.ufs.map((u) => {
          const r = agora?.[cargoUf].uf[u.uf];
          const cands = candidatosDe(catalogo, cargoUf, u.uf);
          const ls = linhas(r, cands).filter((l) => !l.anulado);
          if (!r || !ls.length || !ls[0].votos) {
            rotulos.push({ tipo: 'uf', id: u.uf, uf: u.uf, x: u.rotulo[0], y: u.rotulo[1], texto: u.uf, chamada: CHAMADAS.includes(u.uf), aria: `${u.nome}, aguardando` });
            return null;
          }
          const definida = senado ? r.situacao === 'eleitos' : r.situacao === 'eleito' || r.situacao === 'segundo-turno';
          const relevantes = senado ? ls.slice(0, 2) : r.situacao === 'segundo-turno' ? ls.filter((l) => l.situacao === 'segundo-turno').slice(0, 2) : r.situacao === 'eleito' ? ls.filter((l) => l.situacao === 'eleito').slice(0, 1) : ls.slice(0, 1);
          for (const l of senado ? relevantes : relevantes.slice(0, 1)) cont.set(l.c.partido, (cont.get(l.c.partido) ?? 0) + 1);
          rotulos.push({
            tipo: 'uf', id: u.uf, uf: u.uf, x: u.rotulo[0], y: u.rotulo[1], texto: u.uf,
            valor: senado ? '' : r.situacao === 'segundo-turno' ? '2T' : `${Math.round((ls[0].parcela ?? 0) * 100)}%`,
            cor: partido(ls[0].c.partido).cor, chamada: CHAMADAS.includes(u.uf),
            fotos: relevantes.map((l) => ({ nome: l.c.nome, sigla: l.c.partido, sq: l.c.sq, cargo: cargoUf, uf: u.uf })),
            aria: `${u.nome}, ${relevantes.map((l) => `${l.c.nome} ${pctS(l.parcela, 1)}`).join(', ')}`,
          });
          if (senado) {
            const a = relevantes[0], b = relevantes[1] ?? relevantes[0];
            return [corDisputa(a.c.partido, definida), corDisputa(b.c.partido, definida)] as [string, string];
          }
          return corDisputa(ls[0].c.partido, definida);
        });
        const contagem = [...cont.entries()].sort((a, b) => b[1] - a[1]);
        const lid = contagem[0]?.[0] ?? 'PL';
        return {
          desenho: { tipo: 'brasil', geo, modo: 'ufs', coresUf, ufFoco: null, selecionado: null, ufSelecionada: null },
          alvo: alvoBr, rotulos, carregando: !agora,
          legenda: { itens: itensLegenda(contagem, 4), sufixo: senado ? 'vagas' : 'estados', rampa: { cores: [misturar(partido(lid).cor, '#FFFFFF', 0.5), partido(lid).cor], texto: senado ? 'claro: apurando · forte: eleitos' : 'claro: apurando · forte: definido', titulo: 'O tom diz o andamento da disputa' } },
        };
      }
      // UF selecionada: municípios pela candidatura líder no cargo
      const coresMun: (string | null)[] = new Array(geo.n).fill(null);
      let legenda: Legenda | null = null;
      let picos: Pico[] | null = null;
      // fora da UF: tom do líder da UF no mesmo cargo (esmaecido pelo motor)
      for (const u of geo.ufs) {
        if (u.uf === nav.uf) continue;
        const ls = linhas(agora?.[cargoUf].uf[u.uf], candidatosDe(catalogo, cargoUf, u.uf)).filter((l) => !l.anulado);
        const cor = ls[0]?.votos ? misturar(partido(ls[0].c.partido).cor, '#FFFFFF', 0.35) : COR_SEM_DADOS;
        for (const g of geo.municipiosDaUf.get(u.uf) ?? []) coresMun[g] = cor;
      }
      if (colUf && indUf && mapaUf && !semRegistro) {
        const partidoDe = (n: string) => candsUf.find((c) => c.n === n)?.partido ?? '';
        const camada = nav.camada === 'uf' ? 'mun' : nav.camada;
        if (camada === 'mun') {
          for (let i = 0; i < colUf.tse.length; i++) { const g = mapaUf[i]; if (g < 0) continue; coresMun[g] = indUf.lider[i] >= 0 ? corVantagem(partidoDe(colUf.candidatos[indUf.lider[i]]), indUf.margem[i]) : null; }
          const cont = contarLideres(indUf, colUf.candidatos, partidoDe);
          legenda = { itens: itensLegenda(cont, 2), sufixo: 'municípios', rampa: cont[0] ? legVantagem(cont[0][0]) : undefined };
        } else if (camada === 'apur') {
          for (let i = 0; i < colUf.tse.length; i++) { const g = mapaUf[i]; if (g >= 0) coresMun[g] = corApurado(indUf.fracao[i]); }
          legenda = { itens: [], rampa: { cores: RAMPA_APURADO, texto: 'até 25 · 50 · 75 · 99 · 100% das seções', titulo: 'Seções totalizadas' } };
        } else if (camada === 'votes') {
          picos = [];
          const soma = new Map<string, number>();
          for (let i = 0; i < colUf.tse.length; i++) {
            const g = mapaUf[i]; if (g < 0) continue;
            coresMun[g] = NEUTRO_PICOS;
            if (indUf.lider[i] < 0 || indUf.margemVotos[i] <= 0) continue;
            const p = partidoDe(colUf.candidatos[indUf.lider[i]]);
            soma.set(p, (soma.get(p) ?? 0) + indUf.margemVotos[i]);
            picos.push({ i: g, h: alturaPico(indUf.margemVotos[i], escalaPicos * 1.8), cor: partido(p).cor });
          }
          const ss = [...soma.entries()].sort((a, b) => b[1] - a[1]);
          legenda = { itens: ss.slice(0, 2).map(([p, v]) => ({ cor: partido(p).cor, rotulo: siglaExibicao(p), valor: `+${compacto(v).replace(' milhões', ' mi').replace(' milhão', ' mi')}` })), picos: true };
        } else if (camada === 'cand' && nav.cand) {
          const idx = colUf.candidatos.indexOf(nav.cand);
          const parc = parcelaColunar(colUf, idx);
          const lim = limitesCandidato(parc, colUf.validos, 6);
          const sigla = partidoDe(nav.cand);
          const rampa = rampaCandidato(sigla, lim.length + 1);
          for (let i = 0; i < colUf.tse.length; i++) { const g = mapaUf[i]; if (g >= 0) coresMun[g] = Number.isNaN(parc[i]) ? null : corPorLimites(parc[i], lim, rampa); }
          const c = candsUf.find((x) => x.n === nav.cand);
          legenda = { itens: c ? [{ cor: partido(sigla).cor, rotulo: c.nome, valor: '' }] : [], rampa: { cores: rampa, texto: `${lim.map((v) => Math.round(v * 100)).join(' · ')}%`, titulo: `Participação de ${c?.nome ?? 'candidatura'}` } };
        }
      }
      return {
        desenho: { tipo: 'brasil', geo, modo: 'municipios', coresMun, ufFoco: nav.uf, picos, selecionado: munIdx >= 0 ? munIdx : null, ufSelecionada: nav.uf },
        alvo: alvoEscopo, legenda, rotulos: [], carregando: ufMun.carregando || !colUf,
        aviso: semRegistro ? 'Sem registro deste instante no modo oficial.' : null,
      };
    }

    // ---------- Deputados ----------
    const chave = casa === 'f' ? 'federal' : 'estadual';
    const cont = new Map<string, number>();
    const rotulos: Rotulo[] = [];
    const coresUf: CorUf[] = geo.ufs.map((u) => {
      const c = dep.dados?.porUf[u.uf]?.[chave];
      rotulos.push({ tipo: 'uf', id: u.uf, uf: u.uf, x: u.rotulo[0], y: u.rotulo[1], texto: u.uf, chamada: CHAMADAS.includes(u.uf), aria: u.nome, selecionado: u.uf === nav.uf });
      if (!c) return null;
      const definida = c.eleitos >= c.vagas && c.vagas > 0;
      // partido com mais cadeiras; empate decidido pelos votos válidos do partido na UF.
      // Antes da distribuição de cadeiras, o partido com mais votos (tom claro).
      const base = definida ? c.cadeiras : c.votos;
      const lider = Object.keys(base).sort((a, b) => (base[b] - base[a]) || ((c.votos[b] ?? 0) - (c.votos[a] ?? 0)))[0];
      if (!lider || !(base[lider] > 0)) return null;
      cont.set(lider, (cont.get(lider) ?? 0) + 1);
      return corDisputa(lider, definida);
    });
    const contagem = [...cont.entries()].sort((a, b) => b[1] - a[1]);
    return {
      desenho: { tipo: 'brasil', geo, modo: 'ufs', coresUf, ufFoco: nav.uf, selecionado: null, ufSelecionada: nav.uf },
      alvo: nav.uf && ufIdx >= 0 ? { caixa: caixaMin(geo.ufs[ufIdx].caixa, 160), margem: 0.08, chave: `uf-${nav.uf}` } : alvoBr,
      rotulos: nav.uf ? [] : rotulos, carregando: dep.carregando,
      legenda: { itens: itensLegenda(contagem, 4), sufixo: 'estados', nota: casa === 'f' ? 'Partido com mais cadeiras na Câmara, por UF (empate: mais votos)' : 'Partido com mais cadeiras na Assembleia, por UF (empate: mais votos)' },
    };
  }, [geo, mundo, catalogo, agora, semRegistro, nav, casa, presMun.dados, presMun.carregando, indPres, mapaPres, partidoPres, ext.dados, ext.carregando, colUf, indUf, mapaUf, candsUf, ufMun.carregando, dep.dados, dep.carregando, escalaPicos, zonasGeo, zonasRes.dados]);

  // ---------- dica (tooltip) ----------
  const dica = useCallback((a: Alvo | null): Dica | null => {
    if (!a || !geo || !catalogo) return null;
    const topo = (r: Resultado | null, cands: Candidato[]) => linhas(r, cands).filter((l) => !l.anulado).slice(0, 2).map((l, k) => ({ nome: l.c.nome, sigla: l.c.partido, valor: pctS(l.parcela, 1), destaque: k === 0 }));
    if (a.tipo === 'mun') {
      const nome = `${geo.nome[a.i]} – ${geo.uf[a.i]}`;
      if (nav.cargo === 'presidente' && presMun.dados && mapaPres) {
        const inv = inverso(mapaPres, geo.n);
        const i = inv?.[a.i] ?? -1;
        const r = resultadoDoItem(presMun.dados, i, catalogo.presidente);
        return { titulo: nome, linhas: r ? topo(r, catalogo.presidente) : [], rodape: r ? `${pctS(fracaoSecoes(r), 0)} das seções · ${compacto(r.eleitorado)} eleitores` : 'Sem dados' };
      }
      if (cargoUf && colUf && mapaUf && geo.uf[a.i] === nav.uf) {
        const inv = inverso(mapaUf, geo.n);
        const r = resultadoDoItem(colUf, inv?.[a.i] ?? -1, candsUf);
        return { titulo: nome, subtitulo: cargoUf === 'governador' ? 'Governador' : 'Senado', linhas: r ? topo(r, candsUf) : [], rodape: r ? `${pctS(fracaoSecoes(r), 0)} das seções` : 'Sem dados' };
      }
      return { titulo: UF_NOME[geo.uf[a.i]] ?? geo.uf[a.i], linhas: [], rodape: 'Clique para ver o estado' };
    }
    if (a.tipo === 'zona' && zonasRes.dados) {
      const zc = zonasRes.dados;
      const k = zc.tse.findIndex((z) => Number(z) === Number(a.zona));
      const r = resultadoDoItem(zc, k, catalogo.presidente);
      return { titulo: `${a.zona}ª zona`, subtitulo: `${tseMun ? geo.nome[geo.porTse.get(tseMun) ?? 0] : ''} · área aproximada`, linhas: r ? topo(r, catalogo.presidente) : [], rodape: r ? `${pctS(fracaoSecoes(r), 0)} das seções · ${compacto(r.eleitorado)} eleitores` : '' };
    }
    if (a.tipo === 'uf') {
      const u = geo.ufs[a.k];
      if (nav.cargo === 'deputados') {
        const c = dep.dados?.porUf[u.uf]?.[casa === 'f' ? 'federal' : 'estadual'];
        const ls = c ? Object.entries(c.eleitos >= c.vagas ? c.cadeiras : c.votos).sort((x, y) => y[1] - x[1]).slice(0, 3) : [];
        return { titulo: u.nome, subtitulo: casa === 'f' ? `Câmara · ${c?.vagas ?? '—'} vagas` : `${u.uf === 'DF' ? 'Câmara Legislativa' : 'Assembleia'} · ${c?.vagas ?? '—'} vagas`, linhas: ls.map(([p, n]) => ({ nome: siglaExibicao(p), sigla: p, valor: c && c.eleitos >= c.vagas ? `${n} ${n === 1 ? 'cadeira' : 'cadeiras'}` : compacto(n) })), rodape: c && c.eleitos >= c.vagas ? `${c.eleitos} eleitos` : 'Cadeiras ainda não distribuídas' };
      }
      const cargo = nav.cargo === 'presidente' ? 'presidente' : cargoUf ?? 'presidente';
      const r = agora?.[cargo === 'presidente' ? 'presidente' : cargo].uf[u.uf] ?? null;
      const cands = candidatosDe(catalogo, cargo as 'presidente' | 'governador' | 'senador', u.uf);
      return { titulo: u.nome, linhas: topo(r, cands), rodape: r ? `${pctS(fracaoSecoes(r), 0)} das seções` : '' };
    }
    if (a.tipo === 'cidade' && mundo) {
      const c = mundo.cidadePorTse.get(a.tse);
      const col = ext.dados?.cidades;
      const i = col ? col.tse.indexOf(a.tse) : -1;
      const r = col ? resultadoDoItem(col, i, catalogo.presidente) : null;
      return { titulo: c ? tituloLugar(c.nome) : a.tse, subtitulo: c ? mundo.porIso.get(c.pais)?.nome ?? c.paisNome : '', linhas: r ? topo(r, catalogo.presidente) : [], rodape: r ? `${compacto(r.eleitorado)} eleitores · ${pctS(fracaoSecoes(r), 0)} das seções` : '' };
    }
    if (a.tipo === 'pais' && mundo) {
      const p = mundo.porIso.get(a.iso);
      const col = ext.dados?.cidades;
      const idx = col ? mundo.cidades.filter((c) => c.pais === a.iso).map((c) => col.tse.indexOf(c.tse)).filter((i) => i >= 0) : [];
      const r = col && idx.length ? somarItens(col, idx, catalogo.presidente) : null;
      return { titulo: p?.nome ?? a.iso, linhas: r ? topo(r, catalogo.presidente) : [], rodape: idx.length ? `${idx.length} ${idx.length === 1 ? 'cidade' : 'cidades'} com votação` : 'Sem votação de brasileiros' };
    }
    if (a.tipo === 'brasil') return { titulo: 'Brasil', linhas: [], rodape: 'Voltar ao mapa do Brasil' };
    return null;
  }, [geo, catalogo, nav.cargo, nav.uf, presMun.dados, mapaPres, cargoUf, colUf, mapaUf, candsUf, agora, mundo, ext.dados, dep.dados, casa, zonasRes.dados, tseMun]);

  // ---------- clique ----------
  const clicar = useCallback((a: Alvo | null) => {
    if (!a || !geo) return;
    const st = useEstado.getState();
    if (a.tipo === 'zona') { st.navegar({ zona: st.nav.zona === a.zona ? null : a.zona }); return; }
    if (a.tipo === 'mun') {
      const uf = geo.uf[a.i];
      if (st.nav.uf === uf && st.nav.cargo !== 'deputados') st.navegar({ mun: geo.ibge[a.i], zona: null });
      else st.navegar({ uf, zz: false, mun: null, zona: null });
    } else if (a.tipo === 'uf') st.navegar({ uf: geo.ufs[a.k].uf, zz: false, mun: null });
    else if (a.tipo === 'cidade') {
      const c = mundo?.cidadePorTse.get(a.tse);
      st.navegar({ zz: true, cidade: a.tse, pais: c?.pais ?? null });
    } else if (a.tipo === 'pais') st.navegar({ zz: true, pais: a.iso, cidade: null });
    else if (a.tipo === 'brasil') st.navegar({ zz: false, uf: null });
  }, [geo, mundo]);

  return { ...res, dica, clicar, geo, mundo };
}

export type ResultadoUseDesenho = ReturnType<typeof useDesenho>;
