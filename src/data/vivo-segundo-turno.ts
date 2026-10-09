// Atualiza o lote completo de 2º turno sem alterar os dados e a navegação do 1º.
import { useEffect } from 'react';
import { useEstado } from '../app/store';
import { ErroFeed, obterJson, urlDe } from './provedor';
import { validarAtualizacaoSegundoTurno, validarPainelSegundoTurno } from './validar';

export function usarVivoSegundoTurno(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    let parado = false, emAndamento = false, falhas = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controle: AbortController | undefined;
    const agendar = (ms: number) => { if (!parado) timer = setTimeout(ciclo, ms); };
    async function ciclo() {
      if (parado || emAndamento) return;
      if (document.hidden && useEstado.getState().painelSegundoTurno) { agendar(15_000); return; }
      emAndamento = true;
      controle = new AbortController();
      try {
        const painel = validarPainelSegundoTurno(await obterJson(urlDe('oficial', 'painel.json', null, 2), { signal: controle.signal, tempoLimite: 55_000 }));
        if (parado) return;
        const anterior = useEstado.getState().painelSegundoTurno;
        validarAtualizacaoSegundoTurno(painel, anterior);
        useEstado.getState().set({ painelSegundoTurno: painel, conexaoSegundoTurno: 'ao-vivo', erroSegundoTurno: null });
        falhas = 0;
        agendar(15_000);
      } catch (e) {
        if (parado) return;
        falhas++;
        useEstado.getState().set({ conexaoSegundoTurno: useEstado.getState().painelSegundoTurno?.agora ? 'reconectando' : 'sem-conexao', erroSegundoTurno: `${(e as Error).message} Mantido o último dado válido, quando disponível.` });
        const recuo = Math.min(60_000, 2000 * 2 ** Math.min(falhas - 1, 5));
        agendar(Math.min(60_000, Math.max(recuo, e instanceof ErroFeed ? (e.esperarSegundos ?? 0) * 1000 : 0)));
      } finally { emAndamento = false; }
    }
    const retomar = () => { if (timer) clearTimeout(timer); void ciclo(); };
    const visibilidade = () => { if (!document.hidden) retomar(); };
    document.addEventListener('visibilitychange', visibilidade);
    window.addEventListener('online', retomar);
    void ciclo();
    return () => { parado = true; controle?.abort(); if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', visibilidade); window.removeEventListener('online', retomar); };
  }, [ativo]);
}
