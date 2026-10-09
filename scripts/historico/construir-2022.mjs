// Referência histórica de 2022 (presidente, 1º turno) a partir dos dados abertos do TSE.
//
// Fonte: https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_partido_munzona/votacao_partido_munzona_2022.zip
// (arquivo votacao_partido_munzona_2022_BR.csv, abrangência federal). Para presidente,
// cada partido tem uma única candidatura; QT_VOTOS_NOMINAIS_VALIDOS por partido é a votação
// nominal válida da candidatura. Agregamos zona → município → UF → região/Brasil e exterior.
//
// Saída: dados/historico/presidente-2022-1t.json

import { createInterface } from 'node:readline';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yauzl from 'yauzl';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ZIP = join(RAIZ, 'dados-brutos', 'tse-2022', 'votacao_partido_munzona_2022.zip');
const SAIDA = join(RAIZ, 'dados', 'historico', 'presidente-2022-1t.json');
const REGIAO = { AC: 'N', AP: 'N', AM: 'N', PA: 'N', RO: 'N', RR: 'N', TO: 'N', AL: 'NE', BA: 'NE', CE: 'NE', MA: 'NE', PB: 'NE', PE: 'NE', PI: 'NE', RN: 'NE', SE: 'NE', DF: 'CO', GO: 'CO', MT: 'CO', MS: 'CO', ES: 'SE', MG: 'SE', RJ: 'SE', SP: 'SE', PR: 'S', RS: 'S', SC: 'S', ZZ: 'ZZ' };

function linhaCsv(l) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ';') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur.replace(/\r$/, ''));
  return out;
}

function abrirEntrada(zip, nome) {
  return new Promise((resolve, reject) => {
    yauzl.open(zip, { lazyEntries: true }, (e, z) => {
      if (e) return reject(e);
      z.on('entry', (en) => {
        if (en.fileName !== nome) return z.readEntry();
        z.openReadStream(en, (e2, s) => (e2 ? reject(e2) : resolve(s)));
      });
      z.on('end', () => reject(new Error(`${nome} não encontrado no ZIP`)));
      z.readEntry();
    });
  });
}

const soma = (alvo, partido, v) => { alvo.validos += v; alvo.votos[partido] = (alvo.votos[partido] ?? 0) + v; };
const novo = () => ({ validos: 0, votos: {} });

async function main() {
  const fluxo = await abrirEntrada(ZIP, 'votacao_partido_munzona_2022_BR.csv');
  fluxo.setEncoding('latin1');
  const rl = createInterface({ input: fluxo, crlfDelay: Infinity });
  let cab = null; let idx = {};
  const br = novo(); const ufs = {}; const regioes = {}; const muns = new Map();
  let geradoEm = null; let linhas = 0;
  for await (const l of rl) {
    if (!cab) { cab = linhaCsv(l); cab.forEach((c, i) => { idx[c] = i; }); continue; }
    const c = linhaCsv(l);
    if (c[idx.NR_TURNO] !== '1' || c[idx.CD_CARGO] !== '1') continue;
    linhas++;
    geradoEm ??= `${c[idx.DT_GERACAO]} ${c[idx.HH_GERACAO]}`;
    const uf = c[idx.SG_UF]; const mun = c[idx.CD_MUNICIPIO].padStart(5, '0');
    const partido = c[idx.NR_PARTIDO]; const v = Number(c[idx.QT_VOTOS_NOMINAIS_VALIDOS]);
    if (!Number.isSafeInteger(v) || v < 0) throw new Error(`Contagem inválida na linha ${linhas}`);
    if (uf !== 'ZZ') soma(br, partido, v);
    soma(ufs[uf] ??= novo(), partido, v);
    if (uf !== 'ZZ') soma(regioes[REGIAO[uf]] ??= novo(), partido, v);
    if (!muns.has(mun)) muns.set(mun, { uf, ...novo() });
    soma(muns.get(mun), partido, v);
  }
  // Brasil em 2022, no recorte do TSE, inclui o exterior no total nacional de presidente.
  const brComExterior = novo();
  for (const [uf, r] of Object.entries(ufs)) for (const [p, v] of Object.entries(r.votos)) soma(brComExterior, p, v);

  const codigos = [...muns.keys()].sort();
  const saida = {
    versao: 1,
    fonte: 'TSE — votacao_partido_munzona_2022 (arquivo _BR.csv), presidente 1º turno, votos nominais válidos',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_partido_munzona/votacao_partido_munzona_2022.zip',
    geradoNaFonte: geradoEm,
    // Correspondência editorial explícita usada nas comparações (não inferida pelo partido).
    candidatos: {
      13: { nome: 'Lula', partido: 'PT' },
      22: { nome: 'Jair Bolsonaro', partido: 'PL' },
    },
    brasil: brComExterior,
    brasilSemExterior: br,
    ufs,
    regioes,
    municipios: {
      tse: codigos,
      uf: codigos.map((k) => muns.get(k).uf),
      validos: codigos.map((k) => muns.get(k).validos),
      v13: codigos.map((k) => muns.get(k).votos['13'] ?? 0),
      v22: codigos.map((k) => muns.get(k).votos['22'] ?? 0),
    },
  };
  await mkdir(dirname(SAIDA), { recursive: true });
  await writeFile(SAIDA, JSON.stringify(saida));
  const pct = (r, p) => (100 * (r.votos[p] ?? 0) / r.validos).toFixed(2);
  console.log(`${linhas} linhas · ${codigos.length} localidades · Lula ${pct(brComExterior, '13')}% · Bolsonaro ${pct(brComExterior, '22')}% (válidos ${brComExterior.validos})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
