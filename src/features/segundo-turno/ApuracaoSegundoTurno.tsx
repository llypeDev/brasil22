import { useEffect, useMemo, useState } from 'react';
import { useEstado } from '../../app/store';
import { UF_NOME, useGeoBrasil, useGeoMundo } from '../../app/dados';
import { BarraDupla } from '../../components/Barra';
import { Retrato } from '../../components/Retrato';
import { eleito, fracaoSecoes, linhas, rotuloSituacao } from '../../data/calculos';
import { horaIso, num, pctS } from '../../data/formato';
import { partido, textoSobreCor } from '../../data/partidos';
import { obterJson, urlDe } from '../../data/provedor';
import { validarDetalheSegundoTurno, validarGeracaoSegundoTurno } from '../../data/validar';
import type { Candidato, DetalheSegundoTurno, PainelSegundoTurno, Resultado } from '../../data/contratos';

const GOVERNOS = ['RJ', 'AM', 'ES', 'RN', 'DF', 'TO', 'AC'];
type Cargo = 'presidente' | 'governador';
interface Cadastro { versao: 1; turno: 2; municipios: { tse: string; zonas: number[] }[] }

export function ApuracaoSegundoTurno({ painel }: { painel: PainelSegundoTurno }) {
  const agora = painel.agora!;
  const navegar = useEstado((s) => s.navegar);
  const erro = useEstado((s) => s.erroSegundoTurno);
  const [cargo, definirCargo] = useState<Cargo>('presidente');
  const [uf, definirUf] = useState('BR');
  const [municipio, definirMunicipio] = useState('');
  const [zona, definirZona] = useState('');
  const [cadastro, definirCadastro] = useState<Cadastro | null>(null);
  const [erroCadastro, definirErroCadastro] = useState<string | null>(null);
  const [detalhe, definirDetalhe] = useState<{ chave: string; dados: DetalheSegundoTurno } | null>(null);
  const [erroDetalhe, definirErroDetalhe] = useState<string | null>(null);
  const geo = useGeoBrasil().dados;
  const mundo = useGeoMundo(uf === 'ZZ').dados;
  const chavesUf = Object.keys(UF_NOME).filter((u) => u !== 'ZZ').sort();
  const escolher = (novoCargo: Cargo, novaUf: string) => { definirCargo(novoCargo); definirUf(novaUf); definirMunicipio(''); definirZona(''); };
  const urlDetalhe = municipio ? `resultados/${cargo}/${uf.toLowerCase()}/${municipio}${zona ? `/z${zona}` : ''}.json` : null;

  useEffect(() => {
    definirCadastro(null);
    definirErroCadastro(null);
    if (uf === 'BR') return;
    const controle = new AbortController();
    let tentativa: ReturnType<typeof setTimeout> | undefined;
    async function consultar() {
      try {
        const c = await obterJson<Cadastro>(urlDe('oficial', `cadastro/${cargo}/${uf.toLowerCase()}.json`, null, 2), { signal: controle.signal });
        if (controle.signal.aborted) return;
        if (c.versao !== 1 || c.turno !== 2 || !Array.isArray(c.municipios)) throw new Error('Cadastro inválido.');
        definirCadastro(c); definirErroCadastro(null);
      } catch {
        if (controle.signal.aborted) return;
        definirErroCadastro('Cadastro municipal temporariamente indisponível. Nova tentativa em 15 segundos.');
        tentativa = setTimeout(consultar, 15_000);
      }
    }
    void consultar();
    return () => { controle.abort(); if (tentativa) clearTimeout(tentativa); };
  }, [cargo, uf, painel.manifesto.eleicao.eleicoes.presidente, painel.manifesto.eleicao.eleicoes.estaduais]);

  useEffect(() => {
    if (!urlDetalhe) { definirDetalhe(null); definirErroDetalhe(null); return; }
    const controle = new AbortController();
    definirErroDetalhe(null);
    obterJson(urlDe('oficial', urlDetalhe, null, 2), { signal: controle.signal })
      .then((d) => {
        if (controle.signal.aborted) return;
        const dados = validarDetalheSegundoTurno(d);
        // A consulta selecionada também preserva sua geração, independentemente do lote BR.
        validarGeracaoSegundoTurno(dados.resultado, detalhe?.chave === urlDetalhe ? detalhe.dados.resultado : undefined, 'Abrangência');
        definirDetalhe({ chave: urlDetalhe, dados });
      })
      .catch((e) => { if (!controle.signal.aborted) definirErroDetalhe((e as Error).message); });
    return () => controle.abort();
    // O resultado anterior serve só à validação; recebê-lo não dispara outra requisição.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlDetalhe, painel]);

  const municipios = useMemo(() => (cadastro?.municipios ?? []).map((m) => {
    const i = geo?.porTse.get(m.tse);
    return { ...m, nome: uf === 'ZZ' ? mundo?.cidadePorTse.get(m.tse)?.nome ?? m.tse : i != null ? geo!.nome[i] : m.tse };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [cadastro, geo, mundo, uf]);
  const zonas = municipios.find((m) => m.tse === municipio)?.zonas ?? [];
  const r = urlDetalhe ? detalhe?.chave === urlDetalhe ? detalhe.dados.resultado : null : cargo === 'presidente' ? uf === 'BR' ? agora.presidente.br : uf === 'ZZ' ? agora.presidente.zz : agora.presidente.uf[uf] : agora.governador.uf[uf];
  const candidatos = urlDetalhe && detalhe?.chave === urlDetalhe ? detalhe.dados.candidatos : cargo === 'presidente' ? painel.catalogo.presidente : painel.catalogo.governador[uf] ?? [];
  const tituloDetalhe = `${cargo === 'presidente' ? 'Presidente' : 'Governador'} · ${municipio ? municipios.find((m) => m.tse === municipio)?.nome ?? municipio : uf === 'BR' ? 'Brasil' : uf === 'ZZ' ? 'Exterior' : UF_NOME[uf]}${zona ? ` · Zona ${zona}` : ''}`;
  const nacional = linhas(agora.presidente.br, painel.catalogo.presidente);
  const vencedor = nacional.find((l) => eleito(l.situacao));
  const concluida = agora.presidente.br.secoes > 0 && agora.presidente.br.totalizadas === agora.presidente.br.secoes;
  const titulo = vencedor ? `${vencedor.c.nome} eleito presidente segundo o TSE` : concluida ? 'Totalização da Presidência concluída' : agora.presidente.br.totalizadas > 0 ? 'Acompanhe a apuração do 2º turno' : 'Aguardando a apuração do 2º turno';

  return <main className="p2t p2t-ao-vivo" aria-labelledby="p2t-titulo">
    <section className="p2t-abertura">
      <div className="p2t-abertura-txt">
        <p className="p2t-sobre">2º turno · 25 de outubro de 2026</p>
        <h1 id="p2t-titulo" className="p2t-titulo">{titulo}</h1>
        <p className="p2t-linha-fina">{pctS(fracaoSecoes(agora.presidente.br), 2)} das seções totalizadas para presidente. {painel.agora?.geradoNaFonte ? `Atualizado pelo TSE em ${horaIso(painel.agora.geradoNaFonte, true)}.` : ''}</p>
        <button className="btn amarelo p2t-cta" onClick={() => navegar({ turno: 1 })}>Ver como foi o 1º turno →</button>
      </div>
    </section>
    {erro && <p className="alerta-conexao" role="alert">{erro}</p>}
    <div className="p2t-linha">
      <CardResultado titulo="Presidente · Brasil" resultado={agora.presidente.br} candidatos={painel.catalogo.presidente} cargo="presidente" uf="BR" eleicao={painel.manifesto.eleicao.eleicoes.presidente} />
      <section className="card p2t-ufs" aria-labelledby="p2t-estados">
        <div className="hd"><h2 id="p2t-estados">Presidente nos estados</h2></div>
        <div className="p2t-grade" role="group" aria-label="Apuração do 2º turno nos estados">
          {chavesUf.map((u) => {
            const rr = agora.presidente.uf[u];
            const ls = linhas(rr, painel.catalogo.presidente);
            const lider = ls[0]?.votos && ls[0].votos > (ls[1]?.votos ?? 0) ? ls[0] : null;
            const cor = lider ? partido(lider.c.partido).cor : '#E4E4E1';
            return <button key={u} className="p2t-chip" style={{ background: cor, color: textoSobreCor(cor) }} onClick={() => escolher('presidente', u)} aria-label={`Ver presidente em ${UF_NOME[u]} no 2º turno`}><b>{u}</b><span>{rr ? pctS(fracaoSecoes(rr), 0) : '—'}</span></button>;
          })}
        </div>
        <button className="link p2t-exterior" onClick={() => escolher('presidente', 'ZZ')}>Ver votos do exterior no 2º turno</button>
        <p className="nota">Cor de quem lidera, sem previsão de vencedor. Número: seções totalizadas. Escolha um estado para consultar municípios e zonas.</p>
      </section>
    </div>
    <section className="p2t-secao" aria-labelledby="p2t-gov">
      <div className="p2t-secao-hd"><h2 id="p2t-gov">Governadores no 2º turno</h2><span className="aside">7 estados</span></div>
      <ul className="p2t-gov">{GOVERNOS.map((u) => <li key={u}>
        <CardResultado titulo={UF_NOME[u]} resultado={agora.governador.uf[u]} candidatos={painel.catalogo.governador[u] ?? []} cargo="governador" uf={u} eleicao={painel.manifesto.eleicao.eleicoes.estaduais} compacto />
        <button className="link p2t-detalhar" onClick={() => escolher('governador', u)}>Consultar municípios de {u}</button>
      </li>)}</ul>
    </section>
    <section className="p2t-secao" aria-labelledby="p2t-consulta">
      <div className="p2t-secao-hd"><h2 id="p2t-consulta">Consultar uma abrangência</h2></div>
      <div className="p2t-filtros">
        <label>Cargo<select value={cargo} onChange={(e) => escolher(e.target.value as Cargo, e.target.value === 'governador' ? 'RJ' : 'BR')}><option value="presidente">Presidente</option><option value="governador">Governador</option></select></label>
        <label>Estado ou exterior<select value={uf} onChange={(e) => escolher(cargo, e.target.value)}>{(cargo === 'presidente' ? ['BR', ...chavesUf, 'ZZ'] : GOVERNOS).map((u) => <option key={u} value={u}>{u === 'BR' ? 'Brasil' : u === 'ZZ' ? 'Exterior' : UF_NOME[u]}</option>)}</select></label>
        {uf !== 'BR' && <label>{uf === 'ZZ' ? 'Cidade no exterior' : 'Município'}<select value={municipio} disabled={!cadastro} onChange={(e) => { definirMunicipio(e.target.value); definirZona(''); }}><option value="">{cadastro ? 'Todos' : 'Carregando cadastro…'}</option>{municipios.map((m) => <option key={m.tse} value={m.tse}>{m.nome}</option>)}</select></label>}
        {cargo === 'presidente' && municipio && zonas.length > 0 && <label>Zona eleitoral<select value={zona} onChange={(e) => definirZona(e.target.value)}><option value="">Todas</option>{zonas.map((z) => <option key={z} value={z}>Zona {z}</option>)}</select></label>}
      </div>
      {erroCadastro && <p role="alert" className="p2t-erro-detalhe">{erroCadastro}</p>}
      {erroDetalhe && <p role="alert" className="p2t-erro-detalhe">{erroDetalhe}{r ? ' Mantido o último resultado válido desta abrangência.' : ''}</p>}
      <CardResultado titulo={tituloDetalhe} resultado={r} candidatos={candidatos} cargo={cargo} uf={uf} eleicao={painel.manifesto.eleicao.eleicoes[cargo === 'presidente' ? 'presidente' : 'estaduais']} />
    </section>
    <p className="p2t-fonte">Fonte: TSE, divulgação oficial do 2º turno. Atualização a cada 15 segundos. Percentuais sobre votos válidos, sem os anulados <i>sub judice</i>. Eleitos somente quando confirmados pelo TSE.</p>
  </main>;
}

function CardResultado({ titulo, resultado, candidatos, cargo, uf, eleicao, compacto = false }: { titulo: string; resultado?: Resultado | null; candidatos: Candidato[]; cargo: Cargo; uf: string; eleicao?: string; compacto?: boolean }) {
  const ls = linhas(resultado, candidatos);
  const validas = ls.filter((l) => !l.anulado);
  const a = validas[0], b = validas[1];
  return <section className={`card p2t-resultado ${compacto ? 'compacto' : ''}`} aria-label={titulo}>
    <div className="hd"><h2>{titulo}</h2></div>
    {!resultado || !resultado.secoes ? <p className="nota">Aguardando divulgação do TSE para esta abrangência.</p> : <>
      <p className="p2t-secoes tn">{pctS(fracaoSecoes(resultado), 2)} das seções · {num(resultado.totalizadas)} de {num(resultado.secoes)}</p>
      <ul className="p2t-resultados">{ls.map((l) => <li key={l.c.n} className="p2t-gov-linha">
        <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo={cargo} uf={uf} eleicao={eleicao} tamanho={compacto ? 36 : 56} />
        <span className="nome"><b>{l.c.nome}</b><small>{l.c.partido} {l.c.n}{l.c.vice ? ` · Vice: ${l.c.vice}` : ''}</small><small>{num(l.votos)} votos{l.anulado ? ' · Anulados' : ''}</small>{rotuloSituacao(l.situacao) && <small className="p2t-situacao">{rotuloSituacao(l.situacao)} · TSE</small>}</span>
        <b className="tn" style={{ color: partido(l.c.partido).texto }}>{pctS(l.parcela, 2)}</b>
      </li>)}</ul>
      {a && b && <BarraDupla esq={{ nome: a.c.nome, sigla: a.c.partido, parcela: a.parcela }} dir={{ nome: b.c.nome, sigla: b.c.partido, parcela: b.parcela }} altura={6} />}
      <dl className="pares"><div><dt>Votos válidos</dt><dd className="tn">{num(resultado.validos)}</dd></div><div><dt>Brancos / nulos</dt><dd className="tn">{num(resultado.brancos)} / {num(resultado.nulos)}</dd></div><div><dt>Anulados sub judice</dt><dd className="tn">{num(resultado.anuladosSJ)}</dd></div></dl>
      {resultado.geradoEm && <p className="nota">TSE · {horaIso(resultado.geradoEm, true)} (Brasília)</p>}
    </>}
  </section>;
}
