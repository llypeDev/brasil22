// Acompanhamento ao vivo: consulta agora.json no intervalo do manifesto (15 s), uma
// requisição por vez, com recuo exponencial e variação aleatória em falhas, respeito a
// Retry-After, pausa em aba oculta e retomada imediata ao voltar ou reconectar.
// Mantém sempre o último snapshot válido.

import { useEstado } from '../app/store';
import type { Agora, Catalogo, Manifesto } from './contratos';
import { ErroFeed, obterJson, urlDe } from './provedor';
import { ErroValidacao, sequenciaAceita, validarAgora } from './validar';

let pararAtual: (() => void) | null = null;
let forcar: (() => void) | null = null;

export function atualizarAgora() { forcar?.(); }

export function iniciarVivo() {
  pararAtual?.();
  const st = useEstado.getState;
  const set = useEstado.getState().set;
  let parado = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controle: AbortController | null = null;
  let falhas = 0;
  let emAndamento = false;
  const modo = st().modo;

  const agendar = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(ciclo, ms);
    set({ proximaTentativa: Date.now() + ms });
  };

  async function ciclo() {
    if (parado || emAndamento) return;
    // Aba oculta pausa o acompanhamento — mas o primeiro lote sempre é buscado, para a
    // página estar pronta quando a pessoa voltar a ela.
    if (typeof document !== 'undefined' && document.hidden && st().agoraVivo) { agendar(30_000); return; }
    emAndamento = true;
    controle = new AbortController();
    try {
      let manifesto = st().manifesto;
      if (!manifesto) {
        manifesto = await obterJson<Manifesto>(urlDe(modo, 'manifesto.json', null), { signal: controle.signal });
        set({ manifesto });
      }
      if (!st().catalogo) set({ catalogo: await obterJson<Catalogo>(urlDe(modo, 'catalogo.json', null), { signal: controle.signal }) });
      const bruto = await obterJson<unknown>(urlDe(modo, 'agora.json', null), { signal: controle.signal });
      let agora: Agora;
      try {
        agora = validarAgora(bruto);
      } catch (e) {
        if (e instanceof ErroValidacao) {
          set({ avisoDados: `Lote descartado na validação: ${e.message}. Mantido o último dado válido.`, conexao: 'ao-vivo', ultimoSucesso: Date.now() });
          falhas = 0;
          agendar((manifesto.recarregarSegundos ?? 15) * 1000);
          return;
        }
        throw e;
      }
      const anterior = st().seq;
      if (agora.seq !== anterior && sequenciaAceita(anterior, agora.seq, modo)) {
        if (anterior != null && agora.seq !== anterior) {
          // o manifesto acompanha a sequência (contagens, avisos, relógio da simulação)
          try { set({ manifesto: await obterJson<Manifesto>(urlDe(modo, 'manifesto.json', null), { signal: controle.signal }) }); } catch { /* mantém o anterior */ }
        }
        set({ agoraVivo: agora, seq: agora.seq, avisoDados: null });
      } else if (agora.seq !== anterior) {
        set({ avisoDados: 'O servidor enviou um lote mais antigo que o exibido; mantido o mais recente.' });
      }
      falhas = 0;
      set({ conexao: 'ao-vivo', ultimoSucesso: Date.now(), erroConexao: null });
      const br = agora.presidente.br;
      const concluida = br.secoes > 0 && br.totalizadas >= br.secoes && modo === 'oficial';
      agendar((concluida ? 60 : manifesto.recarregarSegundos ?? 15) * 1000);
    } catch (e) {
      if ((e as Error).name === 'AbortError' && parado) return;
      falhas++;
      const erro = e instanceof ErroFeed ? e : new ErroFeed('Falha de conexão.');
      set({ conexao: st().agoraVivo ? 'reconectando' : 'sem-conexao', erroConexao: erro.message });
      const base = Math.min(60_000, 2000 * 2 ** Math.min(falhas - 1, 5));
      const espera = Math.max(base * (0.75 + Math.random() * 0.5), (erro.esperarSegundos ?? 0) * 1000);
      agendar(espera);
    } finally {
      emAndamento = false;
    }
  }

  const aoVisibilidade = () => { if (!document.hidden) { if (timer) clearTimeout(timer); void ciclo(); } };
  const aoOnline = () => { if (timer) clearTimeout(timer); void ciclo(); };
  const aoOffline = () => set({ conexao: st().agoraVivo ? 'reconectando' : 'sem-conexao', erroConexao: 'Sem conexão com a internet.' });
  document.addEventListener('visibilitychange', aoVisibilidade);
  window.addEventListener('online', aoOnline);
  window.addEventListener('offline', aoOffline);
  forcar = () => { if (timer) clearTimeout(timer); void ciclo(); };
  void ciclo();

  pararAtual = () => {
    parado = true;
    controle?.abort();
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', aoVisibilidade);
    window.removeEventListener('online', aoOnline);
    window.removeEventListener('offline', aoOffline);
  };
  return pararAtual;
}
