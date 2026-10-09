// Hooks de dados do instante visível (ao vivo ou consulta histórica).

import { useEffect, useMemo, useState } from 'react';
import { useEstado } from '../app/store';
import type { Agora, PontoHistorico } from './contratos';
import { buscarFeed, chaveFeed, emCache, ErroFeed } from './provedor';
import { validarAgora } from './validar';

export interface EstadoFeed<T> { dados: T | null; carregando: boolean; erro: ErroFeed | null; t: number | null }

/**
 * Busca `rel` para o instante visível. Ao vivo, refaz quando a sequência muda e mantém o
 * dado anterior até o novo chegar. Na consulta histórica, só reaproveita dado de outro
 * instante histórico enquanto carrega — nunca o dado ao vivo.
 */
export function useFeed<T>(rel: string | null, { vivo = false, validar }: { vivo?: boolean; validar?: (x: unknown) => T } = {}): EstadoFeed<T> {
  const modo = useEstado((s) => s.modo);
  const seq = useEstado((s) => s.seq);
  const tNav = useEstado((s) => s.nav.t);
  const t = vivo ? null : tNav;
  const chave = rel ? chaveFeed(modo, rel, t, seq) : null;
  const [estado, setEstado] = useState<{ chave: string | null; rel: string | null; t: number | null; dados: T | null; erro: ErroFeed | null }>(() => ({ chave, rel, t, dados: chave ? emCache<T>(chave) ?? null : null, erro: null }));

  // A chave histórica não depende da sequência; sem esta marca, um link direto para um
  // instante passado ficaria esperando para sempre depois que o primeiro lote chegasse.
  const pronto = seq != null;
  useEffect(() => {
    if (!rel || !chave || !pronto) return;
    let ativo = true;
    const c = emCache<T>(chave);
    if (c !== undefined) { setEstado({ chave, rel, t, dados: c, erro: null }); return; }
    setEstado((s) => {
      const mesmoRecurso = s.rel === rel && ((s.t == null && t == null) || (s.t != null && t != null));
      return { chave: s.chave, rel, t: mesmoRecurso ? s.t : t, dados: mesmoRecurso ? s.dados : null, erro: null };
    });
    buscarFeed<T>(modo, rel, t, seq, validar)
      .then((d) => { if (ativo) setEstado({ chave, rel, t, dados: d, erro: null }); })
      .catch((e: unknown) => {
        if (!ativo) return;
        const erro = e instanceof ErroFeed ? e : new ErroFeed((e as Error)?.message ?? 'Falha ao carregar.');
        setEstado((s) => ({ chave, rel, t, dados: t == null && s.rel === rel ? s.dados : null, erro }));
      });
    return () => { ativo = false; };
    // validar é estável por chamada; a chave cobre modo/rel/t/seq
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, pronto]);

  if (!rel) return { dados: null, carregando: false, erro: null, t };
  const atual = estado.chave === chave;
  const dados = estado.rel === rel ? estado.dados : null;
  // sem sequência ainda (primeiro lote não chegou), o recurso está carregando
  return { dados, carregando: (seq == null && !dados) || (!atual && !estado.erro), erro: atual ? estado.erro : null, t: estado.t };
}

export interface AgoraVisivel {
  agora: Agora | null;
  /** consulta histórica sem snapshot completo (modo oficial): só o agregado nacional da série */
  semRegistro: boolean;
  carregando: boolean;
  historico: boolean;
  t: number | null;
  ponto: PontoHistorico | null;
}

export function useAgora(): AgoraVisivel {
  const agoraVivo = useEstado((s) => s.agoraVivo);
  const tNav = useEstado((s) => s.nav.t);
  const hist = useFeed<Agora>(tNav == null ? null : 'agora.json', { validar: validarAgora });
  const serie = useFeed<{ pontos: PontoHistorico[] }>(tNav == null ? null : 'historico.json', { vivo: true });
  const ponto = useMemo(() => {
    if (tNav == null || !serie.dados) return null;
    let p: PontoHistorico | null = null;
    for (const x of serie.dados.pontos) if (x.t <= tNav) p = x; else break;
    return p;
  }, [tNav, serie.dados]);
  if (tNav == null) return { agora: agoraVivo, semRegistro: false, carregando: !agoraVivo, historico: false, t: agoraVivo?.t ?? null, ponto: null };
  return { agora: hist.dados, semRegistro: !!hist.erro?.semRegistro || (!hist.dados && hist.erro?.status === 404), carregando: hist.carregando, historico: true, t: hist.dados?.t ?? tNav, ponto };
}
