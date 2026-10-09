// Publicação em disco opcional; compartilha a normalização com a função da Vercel.
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { criarFeedSegundoTurno } from '../../server/segundo-turno.mjs';

export async function publicarSegundoTurno(raiz) {
  const brutos = join(raiz, 'dados-brutos', 'tse');
  const destino = join(raiz, 'dados', 'publicado', 'oficial-2t');
  const ler = async (rel) => {
    try { return JSON.parse(await readFile(join(brutos, rel), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  };
  const feed = criarFeedSegundoTurno({ ler });
  const painel = await feed.painel();
  if (!painel.agora) throw new Error('Ainda não há divulgação do 2º turno; publicação anterior preservada.');
  const tmp = `${destino}.tmp-${process.pid}`;
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  const gravar = async (rel, obj) => {
    await mkdir(dirname(join(tmp, rel)), { recursive: true });
    await writeFile(join(tmp, rel), JSON.stringify(obj));
  };
  try {
    await gravar('painel.json', painel);
    for (const chave of ['agora', 'manifesto', 'catalogo']) await gravar(`${chave}.json`, painel[chave]);
    for (const [nome, cargo, codigo] of [['presidente', '0001', painel.manifesto.eleicao.eleicoes.presidente], ['governador', '0003', painel.manifesto.eleicao.eleicoes.estaduais]]) {
      const dados = join(brutos, 'oficial', 'ele2026', codigo, 'dados');
      for (const uf of await readdir(dados)) {
        for (const arquivo of await readdir(join(dados, uf))) {
          const m = new RegExp(`^${uf}(\\d{5})?(?:-z(\\d{1,4}))?-c${cargo}-e\\d{6}-u\\.json$`).exec(arquivo);
          if (!m) continue;
          const rel = `resultados/${nome}/${uf}${m[1] ? `/${m[1]}` : ''}${m[2] ? `/z${m[2]}` : ''}.json`;
          const detalhe = await feed.detalhe(rel);
          if (detalhe) await gravar(rel, detalhe);
        }
      }
    }
    const antigo = `${destino}.antigo-${process.pid}`;
    if (existsSync(destino)) await rename(destino, antigo);
    try { await rename(tmp, destino); }
    catch (e) { if (existsSync(antigo)) await rename(antigo, destino); throw e; }
    await rm(antigo, { recursive: true, force: true });
    console.log(`2º turno publicado em ${destino}`);
  } finally { await rm(tmp, { recursive: true, force: true }); }
}
