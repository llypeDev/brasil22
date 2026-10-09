import { useEffect, useState } from 'react';
import { useEstado } from '../app/store';
import { CARGOS, type Cargo } from '../app/hash';
import { MARCA } from '../app/marca';
import { horaDe, horaIso, pctS } from '../data/formato';
import { fracaoSecoes } from '../data/calculos';
import type { Agora, Modo } from '../data/contratos';
import { IconeBusca, IconeCompartilhar, IconeGlobo, IconeInstagram, IconeTelaCheia, IconeX, IconeOlho } from './Icones';
import { avisar } from './Avisos';
import { entrarNaTv } from '../features/tv/controle';

export const ROTULO_CARGO: Record<Cargo, string> = { presidente: 'Presidente', governadores: 'Governadores', senado: 'Senado', deputados: 'Deputados' };

export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="marca">
      <b>{MARCA.titulo}</b>
      {!compacta && MARCA.autoria?.nome && (
        MARCA.autoria.url
          ? <a className="autoria" href={MARCA.autoria.url} target="_blank" rel="noopener noreferrer">{MARCA.autoria.rotulo} {MARCA.autoria.nome}</a>
          : <span className="autoria">{MARCA.autoria.rotulo} {MARCA.autoria.nome}</span>
      )}
      {!compacta && MARCA.redes.length > 0 && (
        <nav className="redes" aria-label="Redes do autor">
          {MARCA.redes.map((r) => (
            <a key={r.url} className="icone" href={r.url} target="_blank" rel="noopener noreferrer" aria-label={r.rotulo}>
              {r.rede === 'x' ? <IconeX /> : <IconeInstagram />}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

export function AbasCargo({ rolagem = false }: { rolagem?: boolean }) {
  const cargo = useEstado((s) => s.nav.cargo);
  const navegar = useEstado((s) => s.navegar);
  return (
    <div className={`abas-cargo ${rolagem ? 'rolagem' : ''}`} role="group" aria-label="Cargo">
      {CARGOS.map((c) => (
        <button key={c} aria-pressed={c === cargo} onClick={() => navegar({ cargo: c })}>{ROTULO_CARGO[c]}</button>
      ))}
    </div>
  );
}

export function BotaoBusca({ compacto = false }: { compacto?: boolean }) {
  const set = useEstado((s) => s.set);
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button className={`botao-busca ${compacto ? 'compacto' : ''}`} onClick={(e) => { origemBusca = e.currentTarget; set({ busca: true }); }} aria-label="Buscar município, estado ou candidato" aria-keyshortcuts="Control+K /">
      <IconeBusca />
      {!compacto && <><span>Buscar</span><kbd>{mac ? '⌘ K' : 'Ctrl K'}</kbd></>}
    </button>
  );
}
/** Elemento que abriu a busca, para devolver o foco ao fechar. */
export let origemBusca: HTMLElement | null = null;
export const definirOrigemBusca = (el: HTMLElement | null) => { origemBusca = el; };

/** Hora de referência do lote exibido: geração do resultado nacional de presidente no TSE. */
export function horaDoLote(agora: Agora | null, modo: Modo) {
  if (!agora) return null;
  const geracao = agora.presidente.br.geradoEm ?? agora.geradoNaFonte;
  return modo === 'oficial' && geracao ? horaIso(geracao) : horaDe(agora.t);
}

export function IndicadorVivo({ curto = false }: { curto?: boolean }) {
  const agora = useEstado((s) => s.agoraVivo);
  const conexao = useEstado((s) => s.conexao);
  const t = useEstado((s) => s.nav.t);
  const modo = useEstado((s) => s.modo);
  const ultimo = useEstado((s) => s.ultimoSucesso);
  const [, tique] = useState(0);
  useEffect(() => { const id = setInterval(() => tique((x) => x + 1), 15000); return () => clearInterval(id); }, []);
  const br = agora?.presidente.br;
  const hora = horaDoLote(agora, modo) ?? '—';
  const f = br ? pctS(fracaoSecoes(br), fracaoSecoes(br) >= 0.9995 || fracaoSecoes(br) === 0 ? 0 : 1) : '—';
  if (t != null) {
    return <span className="vivo historico" role="status"><i className="ponto" aria-hidden="true" />Histórico · {horaDe(t)}</span>;
  }
  if (conexao === 'conectando') return <span className="vivo" role="status"><i className="ponto apagado" aria-hidden="true" />Conectando…</span>;
  if (conexao === 'sem-conexao') return <span className="vivo erro" role="status"><i className="ponto alerta" aria-hidden="true" />Sem conexão</span>;
  const reconectando = conexao === 'reconectando';
  const desatualizado = ultimo != null && Date.now() - ultimo > 90_000;
  return (
    <span className={`vivo ${reconectando ? 'reconectando' : ''}`} role="status" aria-label={`${reconectando ? 'Reconectando; último dado às' : 'Atualizado às'} ${hora} (horário de Brasília) · ${f} das seções`}>
      <i className={`ponto ${reconectando || desatualizado ? 'alerta' : 'pulso'}`} aria-hidden="true" />
      {!curto && <span className="lt">{reconectando ? 'Reconectando · último às' : 'Atualizado às'}</span>}
      <b className="tn">{hora}</b><span className="sep">·</span><b className="tn">{f}</b>{!curto && <span className="lt"> das seções</span>}
    </span>
  );
}

export async function compartilhar() {
  const url = location.href;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: document.title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    avisar('Link desta vista copiado.');
  } catch (e) {
    if ((e as Error).name !== 'AbortError') avisar('Não foi possível copiar. Copie o endereço da barra do navegador.');
  }
}

export function Cabecalho() {
  const zz = useEstado((s) => s.nav.zz);
  const cargo = useEstado((s) => s.nav.cargo);
  const navegar = useEstado((s) => s.navegar);
  const pessoas = useEstado((s) => s.pessoas);
  return (
    <header className="topo">
      <Marca />
      <div className="topo-centro">
        <AbasCargo />
        <BotaoBusca />
      </div>
      <div className="topo-dir">
        <IndicadorVivo />
        {pessoas != null && <span className="pessoas-topo sr">{pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'} com a página aberta</span>}
        <button className="btn exterior" aria-pressed={zz} onClick={() => navegar(zz ? { zz: false } : { cargo: cargo === 'presidente' ? cargo : 'presidente', zz: true })} aria-label="Ver os votos do exterior">
          <IconeGlobo /><span className="lbl">Exterior</span>
        </button>
        <button className="icone grande" onClick={compartilhar} aria-label="Compartilhar esta vista"><IconeCompartilhar /></button>
        <button className="btn tvb" onClick={() => entrarNaTv()} aria-label="Tela cheia (modo TV, com roteiro automático)">
          <IconeTelaCheia /><span className="lbl">Tela cheia</span>
        </button>
      </div>
    </header>
  );
}

export const IconePessoas = IconeOlho;
