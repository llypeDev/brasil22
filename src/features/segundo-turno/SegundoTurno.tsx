// Página do 2º turno (25 de outubro): a disputa de presidente e as de governador, com o
// resultado final do 1º turno como referência, e o caminho de volta para o painel completo do
// 1º turno. Os resultados do 2º turno ainda não são coletados (docs/CONTINUIDADE.md).

import { useMemo } from 'react';
import { useEstado } from '../../app/store';
import { UF_NOME, useDeputadosBr } from '../../app/dados';
import { Cabecalho } from '../../components/Cabecalho';
import { CabecalhoCelular } from '../../app/telas/Celular';
import { SeloModo } from '../../app/SeloModo';
import { Retrato } from '../../components/Retrato';
import { BarraDupla } from '../../components/Barra';
import { brancosNulosPct, comparecimentoPct, type Linha } from '../../data/calculos';
import { compacto, horaIso, num, pct, pctS, plural } from '../../data/formato';
import { partido, siglaExibicao, textoSobreCor } from '../../data/partidos';
import type { Cargo, EstadoUrl } from '../../app/hash';
import type { DeputadosBr } from '../../data/contratos';
import type { Layout } from '../../app/layout';
import {
  contagemRegressiva, diasAte, governadoresNoSegundoTurno, presidenteNoSegundoTurno, resumoPrimeiroTurno,
  type DisputaGovernador, type Dupla, type ResumoPrimeiroTurno, type SegundoTurnoPresidente,
} from './resumo';

const FUSO = 'America/Sao_Paulo';
/** "2026-10-25" → "domingo, 25 de outubro" (ou "25 de outubro") */
function dataPorExtenso(data: string, diaDaSemana = false) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: 'numeric', month: 'long', ...(diaDaSemana ? { weekday: 'long' } : {}) }).format(new Date(`${data}T12:00:00-03:00`));
}

const porVotos = ([a, b]: Dupla): Dupla => (b.votos > a.votos ? [b, a] : [a, b]);
const barra = ([a, b]: Dupla) => ({ esq: { nome: a.c.nome, sigla: a.c.partido, parcela: a.parcela }, dir: { nome: b.c.nome, sigla: b.c.partido, parcela: b.parcela } });

export function PaginaSegundoTurno({ layout, topo }: { layout: Layout; topo: number }) {
  if (layout.variante === 'celular') {
    return (
      <div className="painel fluxo pagina-2t">
        <CabecalhoCelular />
        <SegundoTurno />
        <SeloModo variante="celular" />
      </div>
    );
  }
  const desktop = layout.variante === 'desktop';
  return (
    <div className={`painel pagina-2t rola v2t-${layout.variante}`} style={{ top: topo, height: layout.h }}>
      <div className="p2t-escala" style={desktop ? { zoom: layout.escala } : undefined}>
        {desktop ? <Cabecalho /> : <CabecalhoCelular />}
        <SegundoTurno />
        {!desktop && <SeloModo variante={layout.variante} />}
      </div>
    </div>
  );
}

export function SegundoTurno() {
  const agora = useEstado((s) => s.agoraVivo);
  const cat = useEstado((s) => s.catalogo);
  const manifesto = useEstado((s) => s.manifesto);
  const modo = useEstado((s) => s.modo);
  const navegar = useEstado((s) => s.navegar);
  const dep = useDeputadosBr();
  const pres = useMemo(() => (agora && cat ? presidenteNoSegundoTurno(agora, cat) : null), [agora, cat]);
  const govs = useMemo(() => (agora && cat ? governadoresNoSegundoTurno(agora, cat) : []), [agora, cat]);
  const resumo = useMemo(() => (agora && cat ? resumoPrimeiroTurno(agora, cat) : null), [agora, cat]);
  const irAoPrimeiro = (p: Partial<EstadoUrl>) => navegar({ ...p, turno: 1 });

  if (!resumo) return <main className="p2t"><p className="p2t-carregando" role="status">Carregando o resultado do 1º turno…</p></main>;

  const data = manifesto?.eleicao?.segundoTurno ?? null;
  const contagem = data ? contagemRegressiva(diasAte(data)) : null;
  const [lider, outro] = pres ? porVotos(pres.dupla) : [null, null];
  const titulo = lider && outro ? `${lider.c.nome} e ${outro.c.nome} disputam a Presidência`
    : resumo.presidenteEleito ? `${resumo.presidenteEleito.c.nome} venceu no 1º turno`
    : 'O 2º turno ainda não está definido';
  const linhaFina = [
    lider && outro ? `No 1º turno, ${lider.c.nome} teve ${pctS(lider.parcela, 2)} dos votos válidos, e ${outro.c.nome}, ${pctS(outro.parcela, 2)}.` : null,
    govs.length ? `Em ${plural(govs.length, 'estado', 'estados')}, o governo também será decidido no 2º turno.` : null,
    !pres && !resumo.presidenteEleito ? 'A apuração do 1º turno ainda não terminou.' : null,
  ].filter(Boolean).join(' ');

  return (
    <main className="p2t" aria-labelledby="p2t-titulo">
      <section className="p2t-abertura">
        <div className="p2t-abertura-txt">
          <p className="p2t-sobre">2º turno{data ? ` · ${dataPorExtenso(data, true)}` : ''}</p>
          <h1 id="p2t-titulo" className="p2t-titulo">{titulo}</h1>
          {linhaFina && <p className="p2t-linha-fina">{linhaFina}</p>}
          <button className="btn amarelo p2t-cta" onClick={() => irAoPrimeiro({ cargo: 'presidente', uf: null, zz: false })}>Ver como foi o 1º turno <span aria-hidden="true">→</span></button>
          {contagem?.encerrada && <p className="p2t-aviso">Os resultados do 2º turno ainda não estão neste painel; os números abaixo são do 1º turno.</p>}
        </div>
        {contagem && !contagem.encerrada && (
          <p className="p2t-losango">
            <span className="sr">{contagem.rotulo}</span>
            <b className="tn" aria-hidden="true">{contagem.grande}</b><span aria-hidden="true">{contagem.texto}</span>
          </p>
        )}
      </section>

      {pres && (
        <div className="p2t-linha">
          <DueloPresidente pres={pres} aoVerMapa={(n) => irAoPrimeiro({ cargo: 'presidente', uf: null, zz: false, camada: 'cand', cand: n })} />
          <OndeVenceu pres={pres} aoEscolher={(uf) => irAoPrimeiro(uf === 'ZZ' ? { cargo: 'presidente', zz: true } : { cargo: 'presidente', uf, zz: false })} />
        </div>
      )}

      {govs.length > 0 && <Governadores govs={govs} aoEscolher={(uf) => irAoPrimeiro({ cargo: 'governadores', uf, zz: false })} />}

      <ComoFoi resumo={resumo} pres={pres} dep={dep.dados} data={manifesto?.eleicao?.data ?? null} aoEscolher={(cargo) => irAoPrimeiro({ cargo, uf: null, zz: false })} />

      <p className="p2t-fonte">
        {modo === 'oficial'
          ? `Fonte: TSE, resultado final do 1º turno${manifesto?.geradoNaFonte ? `, gerado em ${horaIso(manifesto.geradoNaFonte, true)}` : ''}.`
          : 'Simulação ou cenário de teste: não são resultados oficiais.'}
        {' '}Percentuais sobre os votos válidos, sem os anulados <i>sub judice</i>; quem vai ao 2º turno é a situação oficial do TSE.
      </p>
    </main>
  );
}

function Lado({ l, pos, aoVerMapa }: { l: Linha; pos: 'esq' | 'dir'; aoVerMapa: (n: string) => void }) {
  const p = partido(l.c.partido);
  return (
    <div className={`p2t-lado ${pos}`}>
      <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo="presidente" tamanho={76} forma="quadrado" borda />
      <span className="p2t-lado-nome">
        <b>{l.c.nome}</b>
        <small style={{ color: p.texto }}>{siglaExibicao(l.c.partido)} {l.c.n}</small>
        {l.c.vice && <small className="p2t-vice">Vice: {l.c.vice}</small>}
      </span>
      <span className="figura tn">{pct(l.parcela, 2)}<sup style={{ color: p.texto }}>%</sup></span>
      <span className="votos tn">{num(l.votos)} votos</span>
      <button className="link" onClick={() => aoVerMapa(l.c.n)} aria-label={`Ver o mapa de ${l.c.nome} no 1º turno`}>Mapa no 1º turno</button>
    </div>
  );
}

function DueloPresidente({ pres, aoVerMapa }: { pres: SegundoTurnoPresidente; aoVerMapa: (n: string) => void }) {
  const [esq, dir] = pres.dupla;
  const [a, b] = porVotos(pres.dupla);
  return (
    <section className="card p2t-duelo" aria-labelledby="p2t-pres">
      <div className="hd"><h2 id="p2t-pres">Presidente</h2><span className="aside">votos no 1º turno</span></div>
      <div className="p2t-lados">
        <Lado l={esq} pos="esq" aoVerMapa={aoVerMapa} />
        <span className="p2t-x" aria-hidden="true">×</span>
        <Lado l={dir} pos="dir" aoVerMapa={aoVerMapa} />
      </div>
      <BarraDupla {...barra(pres.dupla)} altura={10} />
      <dl className="pares">
        <div><dt>Diferença no 1º turno</dt><dd className="tn">{a.parcela != null && b.parcela != null ? `${pct(a.parcela - b.parcela, 2)} pontos · ${compacto(a.votos - b.votos)} de votos` : '—'}</dd></div>
        <div><dt>Votos dos outros {pres.outros.candidaturas} candidatos</dt><dd className="tn">{pctS(pres.outros.parcela, 2)} · {compacto(pres.outros.votos)}</dd></div>
      </dl>
    </section>
  );
}

function OndeVenceu({ pres, aoEscolher }: { pres: SegundoTurnoPresidente; aoEscolher: (uf: string) => void }) {
  const [esq, dir] = pres.dupla;
  const venceu = (k: 'esq' | 'dir') => pres.ufs.filter((x) => x.venceu === k).length;
  const zz = pres.exterior;
  return (
    <section className="card p2t-ufs" aria-labelledby="p2t-onde">
      <div className="hd"><h2 id="p2t-onde">Onde cada um venceu no 1º turno</h2></div>
      <p className="p2t-placar">
        {([['esq', esq], ['dir', dir]] as const).map(([k, l]) => (
          <span key={k}><i style={{ background: partido(l.c.partido).cor }} /><b>{l.c.nome}</b> <span className="tn">{plural(venceu(k), 'estado', 'estados')}</span></span>
        ))}
      </p>
      <div className="p2t-grade" role="group" aria-label="Estados, pela cor de quem teve mais votos entre os dois finalistas">
        {pres.ufs.map((x) => {
          const v = x.venceu ? x[x.venceu] : null;
          const cor = v ? partido(v.c.partido).cor : '#E4E4E1';
          return (
            <button key={x.uf} className="p2t-chip" style={{ background: cor, color: textoSobreCor(cor) }} onClick={() => aoEscolher(x.uf)}
              aria-label={`${UF_NOME[x.uf]}: ${x.esq.c.nome} ${pctS(x.esq.parcela, 1)}, ${x.dir.c.nome} ${pctS(x.dir.parcela, 1)}. Ver no mapa do 1º turno`}>
              <b>{x.uf}</b><span className="tn">{v ? pctS(v.parcela, 0) : '—'}</span>
            </button>
          );
        })}
      </div>
      {zz && (
        <button className="link p2t-exterior tn" onClick={() => aoEscolher('ZZ')}>
          Exterior: {zz.esq.c.nome} {pctS(zz.esq.parcela, 1)} · {zz.dir.c.nome} {pctS(zz.dir.parcela, 1)}
        </button>
      )}
      <p className="nota">Cor de quem teve mais votos entre os dois finalistas; o número é o percentual dessa candidatura no estado. Toque num estado para abrir o mapa do 1º turno.</p>
    </section>
  );
}

function Governadores({ govs, aoEscolher }: { govs: DisputaGovernador[]; aoEscolher: (uf: string) => void }) {
  return (
    <section className="p2t-secao" aria-labelledby="p2t-gov">
      <div className="p2t-secao-hd"><h2 id="p2t-gov">Governadores no 2º turno</h2><span className="aside tn">{plural(govs.length, 'estado', 'estados')}</span></div>
      <ul className="p2t-gov">
        {govs.map(({ uf, dupla }) => (
          <li key={uf}>
            <button className="card p2t-gov-card" onClick={() => aoEscolher(uf)}
              aria-label={`${UF_NOME[uf]}: ${dupla[0].c.nome} ${pctS(dupla[0].parcela, 1)} e ${dupla[1].c.nome} ${pctS(dupla[1].parcela, 1)} no 1º turno. Ver o estado no 1º turno`}>
              <span className="p2t-gov-uf"><b>{UF_NOME[uf]}</b><small>{uf}</small></span>
              {dupla.map((l) => (
                <span key={l.c.n} className="p2t-gov-linha">
                  <Retrato nome={l.c.nome} sigla={l.c.partido} sq={l.c.sq} cargo="governador" uf={uf} tamanho={36} />
                  <span className="nome"><b>{l.c.nome}</b><small style={{ color: partido(l.c.partido).texto }}>{siglaExibicao(l.c.partido)} {l.c.n}</small></span>
                  <b className="tn" style={{ color: partido(l.c.partido).texto }}>{pctS(l.parcela, 1)}</b>
                </span>
              ))}
              <BarraDupla {...barra(dupla)} altura={4} como="span" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ComoFoi({ resumo, pres, dep, data, aoEscolher }: { resumo: ResumoPrimeiroTurno; pres: SegundoTurnoPresidente | null; dep: DeputadosBr | null; data: string | null; aoEscolher: (c: Cargo) => void }) {
  const r = resumo.presidente;
  const g = resumo.governadores;
  const [a, b] = pres ? porVotos(pres.dupla) : [null, null];
  const itens: { cargo: Cargo; titulo: string; texto: string }[] = [
    { cargo: 'presidente', titulo: 'Presidente', texto: a && b ? `${a.c.nome} ${pctS(a.parcela, 2)} · ${b.c.nome} ${pctS(b.parcela, 2)}` : resumo.presidenteEleito ? `${resumo.presidenteEleito.c.nome} venceu com ${pctS(resumo.presidenteEleito.parcela, 2)}` : 'Apuração em andamento' },
    { cargo: 'governadores', titulo: 'Governadores', texto: `${plural(g.eleitos, 'eleito', 'eleitos')} · ${num(g.segundoTurno)} no 2º turno` },
    { cargo: 'senado', titulo: 'Senado', texto: `${plural(resumo.senado.eleitos, 'senador eleito', 'senadores eleitos')}${resumo.senado.vagas ? ` de ${num(resumo.senado.vagas)} vagas` : ''}` },
    { cargo: 'deputados', titulo: 'Deputados', texto: dep ? `${num(dep.federal.eleitos)} federais · ${num(dep.estadual.eleitos)} estaduais e distritais` : 'Câmara e assembleias' },
  ];
  return (
    <section className="p2t-secao" aria-labelledby="p2t-1t">
      <div className="p2t-secao-hd"><h2 id="p2t-1t">Como foi o 1º turno</h2>{data && <span className="aside">{dataPorExtenso(data)}</span>}</div>
      <ul className="p2t-cargos">
        {itens.map((i) => (
          <li key={i.cargo}>
            <button className="card p2t-cargo" onClick={() => aoEscolher(i.cargo)} aria-label={`${i.titulo}: ${i.texto}. Ver no painel do 1º turno`}>
              <span className="p2t-cargo-titulo">{i.titulo}</span>
              <span className="p2t-cargo-texto tn">{i.texto}</span>
              <span className="p2t-cargo-acao" aria-hidden="true">Ver resultados →</span>
            </button>
          </li>
        ))}
      </ul>
      <dl className="metricas p2t-metricas">
        <div><dt>Votos válidos para presidente</dt><dd className="tn">{num(r.validos)}</dd></div>
        <div><dt>Comparecimento</dt><dd className="tn">{pctS(comparecimentoPct(r), 1)}</dd></div>
        <div><dt>Brancos e nulos</dt><dd className="tn">{pctS(brancosNulosPct(r), 1)}</dd></div>
      </dl>
    </section>
  );
}
