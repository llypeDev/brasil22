// Normaliza os arquivos oficiais coletados (dados-brutos/tse) e publica o feed do painel
// em dados/publicado/oficial/. A publicação é atômica: tudo é escrito num diretório
// temporário, validado, e só então substitui a versão anterior.
//
// Também gera dados/publicado/oficial/verificacao.json, comparando o snapshot da referência
// (referencia-seuimposto/feed/agora.json) com o TSE, cargo a cargo e UF a UF.

import { mkdir, readFile, rename, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARGOS, ErroDeContrato, compactar, eleito, lerResultado, minutosDaEleicao, nomeDeExibicao, situacaoDaDisputa } from '../../server/lib/tse.mjs';
import { publicarSegundoTurno } from './publicar-segundo-turno.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TURNO = Number(process.argv.find((a) => a.startsWith('--turno='))?.split('=')[1] ?? 1);
if (![1, 2].includes(TURNO)) throw new Error('Use --turno=1 ou --turno=2.');
const BRUTOS = join(RAIZ, 'dados-brutos', 'tse', 'oficial', 'ele2026');
const REFERENCIA = join(RAIZ, '..', 'referencia-seuimposto', 'feed');
const DESTINO = join(RAIZ, 'dados', 'publicado', 'oficial');
const ELE = { 1: '6257', 3: '6259', 5: '6259', 6: '6259', 7: '6259', 8: '6259' };
const REGIAO = { AC: 'Norte', AP: 'Norte', AM: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte', AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste', PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste', DF: 'Centro-Oeste', GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste', ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste', PR: 'Sul', RS: 'Sul', SC: 'Sul' };
// Grafia editorial de exibição quando o nome de urna oficial não traz acentuação.
const GRAFIA = { 'FLAVIO BOLSONARO': 'Flávio Bolsonaro', 'CLARIANA BARAO': 'Clariana Barão' };

const lerJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const pad = (n, w) => String(n).padStart(w, '0');
const arquivo = (cargo, uf, sufixo = '') => join(BRUTOS, ELE[cargo], 'dados', uf, `${uf}${sufixo}-c${pad(cargo, 4)}-e${pad(ELE[cargo], 6)}-u.json`);
const exibir = (nomeUrna) => GRAFIA[nomeUrna] ?? nomeDeExibicao(nomeUrna);
const avisos = [];
const aviso = (m) => { avisos.push(m); if (avisos.length <= 40) console.warn('  aviso:', m); };

async function ler(cargo, uf, sufixo, abrangencia) {
  const p = arquivo(cargo, uf, sufixo);
  if (!existsSync(p)) return null;
  return lerResultado(await lerJson(p), { cargo, abrangencia: abrangencia ?? (sufixo.replace(/^-?/, '').split('-')[0] || uf), eleicao: ELE[cargo] });
}

function candidatoDoCatalogo(c, extra = {}) {
  return {
    n: c.n, sq: c.sq, nome: exibir(c.nomeUrna), nomeUrna: c.nomeUrna, nomeCompleto: c.nome,
    partido: c.partido, situacao: c.situacao, situacaoTse: c.situacaoTse, destino: c.valido ? 'valido' : 'anulado',
    ...extra,
  };
}

function somar(alvo, r) {
  for (const k of ['secoes', 'totalizadas', 'eleitorado', 'eleitoradoApurado', 'comparecimento', 'abstencao', 'brancos', 'nulos', 'validos', 'anuladosSJ']) alvo[k] = (alvo[k] ?? 0) + (r[k] ?? 0);
  alvo.votos ??= {};
  for (const [n, v] of Object.entries(r.votos ?? {})) alvo.votos[n] = (alvo.votos[n] ?? 0) + v;
  return alvo;
}

function colunar(lista, candidatos) {
  // lista: [{tse, r(compactado)|null}] → colunas alinhadas, com códigos explícitos
  const col = { tse: [], secoes: [], totalizadas: [], eleitorado: [], comparecimento: [], brancos: [], nulos: [], validos: [], anuladosSJ: [], votos: candidatos.map(() => []) };
  for (const { tse, r } of lista) {
    col.tse.push(tse);
    for (const k of ['secoes', 'totalizadas', 'eleitorado', 'comparecimento', 'brancos', 'nulos', 'validos', 'anuladosSJ']) col[k].push(r ? r[k] : null);
    candidatos.forEach((n, i) => col.votos[i].push(r ? (r.votos[n] ?? r.anulados?.[n] ?? 0) : null));
  }
  return { candidatos, ...col };
}

async function main() {
  const inicio = Date.now();
  const geo = await lerJson(join(RAIZ, 'public', 'geo', 'brasil-v1.json'));
  const mundo = await lerJson(join(RAIZ, 'public', 'geo', 'mundo-v1.json'));
  const hist2022 = await lerJson(join(RAIZ, 'dados', 'historico', 'presidente-2022-1t.json'));
  const senadoMantidas = await lerJson(join(RAIZ, 'dados', 'senado', 'cadeiras-mantidas.json'));
  const ufs = geo.ufs.map((u) => u.uf.toLowerCase());
  const munsPorUf = new Map();
  geo.municipios.tse.forEach((tse, i) => {
    const uf = geo.municipios.uf[i].toLowerCase();
    if (!munsPorUf.has(uf)) munsPorUf.set(uf, []);
    munsPorUf.get(uf).push({ tse, ibge: geo.municipios.ibge[i] });
  });

  const tmp = `${DESTINO}.tmp-${process.pid}`;
  await rm(tmp, { recursive: true, force: true });
  for (const d of ['', 'uf', 'zonas', 'deputados']) await mkdir(join(tmp, d), { recursive: true });
  const gravar = (rel, obj) => writeFile(join(tmp, rel), JSON.stringify(obj));

  const catalogo = { presidente: [], governador: {}, senador: {}, partidos: {} };
  const agora = { presidente: { uf: {} }, governador: { uf: {} }, senador: { uf: {} } };
  let ultimaGeracao = null;
  const marcar = (r) => { if (r?.geradoEm && (!ultimaGeracao || r.geradoEm > ultimaGeracao)) ultimaGeracao = r.geradoEm; };
  const registrarPartidos = (r) => {
    for (const ag of r.agremiacoes) for (const p of ag.partidos) {
      catalogo.partidos[p.sigla] ??= { sigla: p.sigla, numero: p.n, federacao: p.federacao || null };
    }
  };

  // ---------- Presidente ----------
  console.log('Presidente…');
  const brP = await ler(1, 'br', '', 'br');
  marcar(brP); registrarPartidos(brP);
  catalogo.presidente = brP.candidatos.map((c) => candidatoDoCatalogo(c, { vice: c.vices.find((v) => v.tipo === 'v')?.nome ? nomeDeExibicao(c.vices.find((v) => v.tipo === 'v').nome) : null }));
  const ordemP = brP.candidatos.map((c) => c.n);
  agora.presidente.br = compactar(brP);
  const municipaisP = [];
  for (const uf of ufs) {
    const r = await ler(1, uf, '', uf);
    marcar(r);
    agora.presidente.uf[uf.toUpperCase()] = compactar(r);
    const soma = {};
    for (const m of munsPorUf.get(uf)) {
      let rm = null;
      try { rm = await ler(1, uf, m.tse, m.tse); } catch (e) { aviso(`presidente ${uf}${m.tse}: ${e.message}`); }
      if (!rm) aviso(`presidente ${uf}${m.tse}: arquivo ausente`);
      const c = rm ? compactar(rm) : null;
      if (c) somar(soma, { ...c, votos: { ...c.votos, ...c.anulados } });
      municipaisP.push({ tse: m.tse, r: c });
    }
    // Conferência: soma municipal = agregado da UF, candidato a candidato.
    for (const n of ordemP) {
      const a = agora.presidente.uf[uf.toUpperCase()].votos[n] ?? 0;
      if ((soma.votos?.[n] ?? 0) !== a) aviso(`presidente ${uf}: soma municipal ${soma.votos?.[n]} ≠ UF ${a} (cand ${n})`);
    }
  }
  const zz = await ler(1, 'zz', '', 'zz');
  agora.presidente.zz = compactar(zz);
  // Conferência Brasil = UFs + exterior
  const somaBr = {};
  for (const r of Object.values(agora.presidente.uf)) somar(somaBr, r);
  somar(somaBr, agora.presidente.zz);
  for (const n of ordemP) if ((somaBr.votos[n] ?? 0) !== agora.presidente.br.votos[n]) aviso(`presidente BR: soma ${somaBr.votos[n]} ≠ ${agora.presidente.br.votos[n]} (cand ${n})`);
  if (somaBr.secoes !== agora.presidente.br.secoes) aviso(`presidente BR: seções ${somaBr.secoes} ≠ ${agora.presidente.br.secoes}`);

  // Regiões: soma de votos / soma de válidos (nunca média de percentuais)
  const regioes = {};
  for (const [uf, r] of Object.entries(agora.presidente.uf)) somar(regioes[REGIAO[uf]] ??= {}, r);
  agora.presidente.regioes = regioes;
  await gravar('municipios-presidente.json', { versao: 1, cargo: 'presidente', ...colunar(municipaisP, ordemP) });

  // Exterior: cidades e países (país vem do cadastro geográfico, conferido na preparação)
  const cidadePais = new Map(mundo.cidades.map((c) => [c.tse, c]));
  const cidades = [];
  const paises = {};
  const catZz = (await lerJson(join(BRUTOS, '6257', 'config', 'mun-e006257-cm.json'))).abr.find((a) => a.cd.toLowerCase() === 'zz').mu;
  for (const c of catZz) {
    let r = null;
    try { r = await ler(1, 'zz', c.cd, c.cd); } catch (e) { aviso(`exterior ${c.cd}: ${e.message}`); }
    const cp = r ? compactar(r) : null;
    const g = cidadePais.get(c.cd);
    cidades.push({ tse: c.cd, r: cp });
    if (cp && g) somar(paises[g.pais] ??= {}, cp);
  }
  const somaZz = {};
  for (const p of Object.values(paises)) somar(somaZz, p);
  for (const n of ordemP) if ((somaZz.votos[n] ?? 0) !== (agora.presidente.zz.votos[n] ?? 0)) aviso(`exterior: soma das cidades ${somaZz.votos[n]} ≠ ${agora.presidente.zz.votos[n]} (cand ${n})`);
  await gravar('exterior.json', { versao: 1, cargo: 'presidente', cidades: colunar(cidades, ordemP), paises });

  // Zonas (municípios com mais de uma zona)
  console.log('Zonas…');
  const catP = await lerJson(join(BRUTOS, '6257', 'config', 'mun-e006257-cm.json'));
  let nZonas = 0; const municipiosComZonas = []; const zonasPorMunicipio = {};
  for (const a of catP.abr) {
    const uf = a.cd.toLowerCase();
    if (uf === 'zz') continue;
    for (const m of a.mu) {
      if ((m.z ?? []).length < 2) continue;
      const zonas = [];
      for (const z of m.z) {
        let r = null;
        try { r = await ler(1, uf, `${m.cd}-z${z}`, z); } catch (e) { aviso(`zona ${uf}${m.cd}-z${z}: ${e.message}`); }
        if (r) { zonas.push({ tse: z, r: compactar(r) }); nZonas++; }
      }
      if (zonas.length) {
        zonas.sort((x, y) => Number(x.tse) - Number(y.tse));
        await gravar(`zonas/${m.cd}.json`, { versao: 1, municipio: m.cd, uf: uf.toUpperCase(), cargo: 'presidente', ...colunar(zonas, ordemP) });
        municipiosComZonas.push(m.cd);
        zonasPorMunicipio[m.cd] = zonas.map((z) => Number(z.tse));
      }
    }
  }

  // ---------- Governador e Senado (UF + municípios) ----------
  for (const [chave, cargo] of [['governador', 3], ['senador', 5]]) {
    console.log(`${chave}…`);
    for (const uf of ufs) {
      const r = await ler(cargo, uf, '', uf);
      if (!r) { aviso(`${chave} ${uf}: arquivo ausente`); continue; }
      marcar(r); registrarPartidos(r);
      const UF = uf.toUpperCase();
      catalogo[chave][UF] = r.candidatos.map((c) => candidatoDoCatalogo(c, chave === 'governador'
        ? { vice: c.vices.find((v) => v.tipo === 'v')?.nome ? nomeDeExibicao(c.vices.find((v) => v.tipo === 'v').nome) : null }
        : { suplentes: c.vices.map((v) => nomeDeExibicao(v.nome)) }));
      agora[chave].uf[UF] = { ...compactar(r), vagas: r.vagas };
    }
  }
  for (const uf of ufs) {
    const UF = uf.toUpperCase();
    const saida = { versao: 1, uf: UF };
    for (const [chave, cargo] of [['governador', 3], ['senador', 5]]) {
      const ordem = (catalogo[chave][UF] ?? []).map((c) => c.n);
      const lista = [];
      for (const m of munsPorUf.get(uf)) {
        let rm = null;
        try { rm = await ler(cargo, uf, m.tse, m.tse); } catch (e) { aviso(`${chave} ${uf}${m.tse}: ${e.message}`); }
        lista.push({ tse: m.tse, r: rm ? compactar(rm) : null });
      }
      saida[chave] = colunar(lista, ordem);
    }
    await gravar(`uf/${uf}.json`, saida);
  }

  // ---------- Deputados ----------
  console.log('Deputados…');
  const busca = [];
  const resumo = { federal: { vagas: 0, eleitos: 0, partidos: {}, ranking: [] }, estadual: { vagas: 0, eleitos: 0, partidos: {}, ranking: [] }, porUf: {} };
  for (const uf of ufs) {
    const UF = uf.toUpperCase();
    const out = { versao: 1, uf: UF };
    for (const [casa, cargo] of [['federal', 6], [uf === 'df' ? 'distrital' : 'estadual', uf === 'df' ? 8 : 7]]) {
      const r = await ler(cargo, uf, '', uf);
      if (!r) { aviso(`deputados ${casa} ${uf}: ausente`); continue; }
      marcar(r); registrarPartidos(r);
      const eleitosN = r.candidatos.filter((c) => eleito(c.situacao)).length;
      if (r.andamento === 'finalizada' && eleitosN !== r.vagas) aviso(`deputados ${casa} ${uf}: ${eleitosN} eleitos para ${r.vagas} vagas`);
      const cadeiras = {};
      for (const c of r.candidatos) if (eleito(c.situacao)) cadeiras[c.partido] = (cadeiras[c.partido] ?? 0) + 1;
      const partidos = {};
      for (const ag of r.agremiacoes) for (const p of ag.partidos) partidos[p.sigla] = { n: p.n, agremiacao: ag.n, nominais: p.nominais, legenda: p.legenda, validos: p.validos, cadeiras: cadeiras[p.sigla] ?? 0 };
      const chaveResumo = casa === 'federal' ? 'federal' : 'estadual';
      const votosPartido = {};
      for (const ag of r.agremiacoes) for (const p of ag.partidos) votosPartido[p.sigla] = (votosPartido[p.sigla] ?? 0) + p.validos;
      (resumo.porUf[UF] ??= {})[chaveResumo] = { vagas: r.vagas, eleitos: eleitosN, situacao: situacaoDaDisputa(r), cadeiras, votos: votosPartido, totalizadas: r.totais.totalizadas, secoes: r.totais.secoes };
      resumo[chaveResumo].vagas += r.vagas;
      resumo[chaveResumo].eleitos += eleitosN;
      for (const [p, n] of Object.entries(cadeiras)) resumo[chaveResumo].partidos[p] = (resumo[chaveResumo].partidos[p] ?? 0) + n;
      const codCasa = casa === 'federal' ? 'f' : casa === 'distrital' ? 'd' : 'e';
      const candidatos = r.candidatos.map((c) => [c.n, exibir(c.nomeUrna), c.partido, c.votos, c.situacao, c.sq, c.valido ? 1 : 0]);
      for (const c of r.candidatos) {
        busca.push([c.n, exibir(c.nomeUrna), c.partido, UF, codCasa, c.votos, eleito(c.situacao) ? 1 : 0, c.sq]);
        resumo[chaveResumo].ranking.push([c.n, exibir(c.nomeUrna), c.partido, UF, codCasa, c.votos, c.situacao, c.sq]);
      }
      out[casa] = {
        cargo, vagas: r.vagas, eleitos: eleitosN, situacao: situacaoDaDisputa(r),
        totais: r.totais, totalizadoEm: r.totalizadoEm,
        agremiacoes: r.agremiacoes.map((a) => ({ n: a.n, nome: a.nome, tipo: a.tipo, composicao: a.composicao, vagas: a.vagas })),
        partidos,
        campos: ['numero', 'nome', 'partido', 'votos', 'situacao', 'sq', 'valido'],
        candidatos,
      };
    }
    await gravar(`deputados/${uf}.json`, out);
  }
  for (const k of ['federal', 'estadual']) {
    resumo[k].ranking.sort((a, b) => b[5] - a[5]);
    resumo[k].totalCandidatos = resumo[k].ranking.length;
    resumo[k].ranking = resumo[k].ranking.slice(0, 120);
  }
  await gravar('deputados/br.json', { versao: 1, campos: ['numero', 'nome', 'partido', 'uf', 'casa', 'votos', 'situacao', 'sq'], ...resumo });
  await gravar('deputados/busca.json', { versao: 1, campos: ['numero', 'nome', 'partido', 'uf', 'casa', 'votos', 'eleito', 'sq'], itens: busca });

  // ---------- Referência histórica e composição do Senado ----------
  await gravar('presidente-2022.json', hist2022);
  await gravar('senado-mantidas.json', senadoMantidas);

  // ---------- Série histórica e eventos (registro da referência; TSE não publica série) ----------
  const tFinal = minutosDaEleicao(agora.presidente.br.totalizadoEm);
  let historico = { versao: 1, origem: 'indisponivel', pontos: [] };
  const eventos = [];
  if (existsSync(join(REFERENCIA, 'historico.json'))) {
    const h = await lerJson(join(REFERENCIA, 'historico.json'));
    const pontos = h.pontos.filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
    const final = pontos.at(-1);
    const confere = final && ordemP.every((n) => (final.votos[n] ?? 0) === agora.presidente.br.votos[n]) && final.totalizadas === agora.presidente.br.totalizadas;
    historico = {
      versao: 1,
      origem: 'referencia',
      descricao: 'Série nacional para presidente registrada por seuimposto.com durante a apuração de 04/10/2026. Não auditada; o TSE não publica série histórica. O último ponto foi conferido com o arquivo oficial.',
      ultimoPontoConfereComTse: !!confere,
      pontos: pontos.map((p) => ({ t: p.t, totalizadas: p.totalizadas, secoes: p.secoes, votos: p.votos, situacao: p.situacao })),
    };
    let anterior = null;
    for (const p of pontos) {
      if (anterior && p.totalizadas > anterior.totalizadas) eventos.push({ id: `pres-br-${p.t}`, tipo: 'secoes', t: p.t, cargo: 'presidente', uf: 'BR', secoes: p.totalizadas - anterior.totalizadas, totalizadas: p.totalizadas, totalSecoes: p.secoes, validos: Object.values(p.votos).reduce((x, y) => x + y, 0), votos: Object.fromEntries(ordemP.slice(0, 2).map((n) => [n, p.votos[n]])), origemHorario: 'referencia' });
      if (anterior && anterior.situacao !== 'segundo-turno' && p.situacao === 'segundo-turno') eventos.push({ id: `pres-br-def`, tipo: 'definicao', t: p.t, cargo: 'presidente', uf: 'BR', situacao: 'segundo-turno', candidatos: ordemP.slice(0, 2), origemHorario: 'referencia' });
      anterior = p;
    }
  }
  if (existsSync(join(REFERENCIA, 'agora.json'))) {
    const ref = await lerJson(join(REFERENCIA, 'agora.json'));
    for (const [chave, refChave] of [['governador', 'governador'], ['senador', 'senado']]) {
      for (const [UF, r] of Object.entries(agora[chave].uf)) {
        const def = ref[refChave]?.uf?.[UF]?.definido;
        const cands = (catalogo[chave][UF] ?? []).filter((c) => eleito(c.situacao) || c.situacao === 'segundo-turno').map((c) => c.n);
        if (!cands.length) continue;
        eventos.push({ id: `${chave}-${UF}-def`, tipo: 'definicao', t: def ?? minutosDaEleicao(r.totalizadoEm), cargo: chave, uf: UF, situacao: r.situacao, candidatos: cands, origemHorario: def != null ? 'referencia' : 'tse-totalizacao' });
      }
    }
  }
  eventos.sort((a, b) => b.t - a.t || a.id.localeCompare(b.id));
  await gravar('historico.json', historico);
  await gravar('eventos.json', { versao: 1, eventos });
  await gravar('arquivo-indice.json', { versao: 1, origem: 'oficial', descricao: 'No modo oficial só existe o snapshot final do TSE. Instantes anteriores têm apenas o agregado nacional da série de referência.', snapshots: [tFinal], agregados: historico.pontos.map((p) => p.t) });

  // ---------- Catálogo, agora e manifesto ----------
  for (const p of Object.values(catalogo.partidos)) p.nome = p.sigla;
  await gravar('catalogo.json', { versao: 1, ...catalogo });
  const seq = Date.parse(ultimaGeracao);
  await gravar('agora.json', { versao: 1, seq, t: tFinal, turno: 1, geradoNaFonte: ultimaGeracao, ...agora });
  const manifesto = {
    versao: 1,
    modo: 'oficial',
    origem: 'TSE — resultados.tse.jus.br (arquivos públicos de divulgação)',
    eleicao: { ano: 2026, turno: 1, data: '2026-10-04', segundoTurno: '2026-10-25', eleicoes: { presidente: ELE[1], estaduais: ELE[3] } },
    seq,
    t: tFinal,
    geradoNaFonte: ultimaGeracao,
    publicadoEm: new Date().toISOString(),
    recarregarSegundos: 15,
    municipiosComZonas,
    zonasPorMunicipio,
    contagens: { municipios: municipaisP.length, cidadesExterior: cidades.length, zonas: nZonas, candidatosDeputados: busca.length },
    avisos: avisos.slice(0, 200),
  };
  await gravar('manifesto.json', manifesto);

  // ---------- Verificação contra a referência ----------
  if (existsSync(join(REFERENCIA, 'agora.json'))) {
    const ref = await lerJson(join(REFERENCIA, 'agora.json'));
    const resultado = { geradoEm: new Date().toISOString(), comparacoes: [] };
    const comparar = (rotulo, a, b) => {
      if (!a || !b) { resultado.comparacoes.push({ rotulo, ok: false, motivo: 'ausente' }); return; }
      const difs = [];
      for (const [n, v] of Object.entries(b.votos ?? {})) if ((a.votos[n] ?? a.anulados?.[n] ?? 0) !== v) difs.push(`${n}: ref ${v} · tse ${a.votos[n] ?? a.anulados?.[n] ?? 0}`);
      for (const k of ['secoes', 'totalizadas', 'comparecimento', 'brancos', 'nulos']) if (b[k] != null && a[k] !== b[k]) difs.push(`${k}: ref ${b[k]} · tse ${a[k]}`);
      const sitRef = b.situacao; const sitTse = a.situacao;
      if (sitRef && sitRef !== sitTse) difs.push(`situação: ref ${sitRef} · tse ${sitTse}`);
      resultado.comparacoes.push({ rotulo, ok: difs.length === 0, diferencas: difs });
    };
    comparar('presidente BR', agora.presidente.br, ref.presidente.br);
    for (const UF of Object.keys(agora.presidente.uf)) comparar(`presidente ${UF}`, agora.presidente.uf[UF], ref.presidente.uf[UF]);
    comparar('presidente exterior', agora.presidente.zz, ref.presidente.uf.ZZ);
    for (const UF of Object.keys(agora.governador.uf)) comparar(`governador ${UF}`, agora.governador.uf[UF], ref.governador.uf[UF]);
    for (const UF of Object.keys(agora.senador.uf)) comparar(`senado ${UF}`, agora.senador.uf[UF], ref.senado.uf[UF]);
    resultado.total = resultado.comparacoes.length;
    resultado.conferem = resultado.comparacoes.filter((c) => c.ok).length;
    await gravar('verificacao.json', resultado);
    console.log(`Verificação contra a referência: ${resultado.conferem}/${resultado.total} abrangências idênticas.`);
  }

  // Publicação atômica
  const antigo = `${DESTINO}.antigo-${process.pid}`;
  if (existsSync(DESTINO)) await rename(DESTINO, antigo);
  await rename(tmp, DESTINO);
  await rm(antigo, { recursive: true, force: true });
  console.log(`Publicado em ${DESTINO} (${((Date.now() - inicio) / 1000).toFixed(1)}s) · ${avisos.length} avisos · zonas ${nZonas} em ${municipiosComZonas.length} municípios`);
}

(TURNO === 2 ? publicarSegundoTurno(RAIZ) : main()).catch((e) => { console.error(e instanceof ErroDeContrato ? `Contrato: ${e.message}` : e); process.exit(1); });
