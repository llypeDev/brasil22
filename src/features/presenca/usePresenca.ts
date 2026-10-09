// Presença: heartbeat para o serviço próprio (/api/vivo) com identificador efêmero da aba.
// Pausa em aba oculta; avisa a saída ao fechar. O número exibido é o do servidor — nunca
// um valor fixo ou simulado. Hospedagem sem o serviço (ex.: Vercel estática) responde 404,
// 405 ou 501: a aba para de enviar e o número não aparece.

import { useEffect } from 'react';
import { useEstado } from '../../app/store';

function idEfemero() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 24);
}

export function usePresenca() {
  useEffect(() => {
    const id = idEfemero();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let intervalo = 20_000;
    let parado = false;
    const enviar = async () => {
      if (parado) return;
      if (document.hidden) { timer = setTimeout(enviar, 30_000); return; }
      try {
        const r = await fetch('/api/vivo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), keepalive: true });
        if (r.ok) {
          const j = (await r.json()) as { pessoas: number; intervaloSegundos?: number };
          useEstado.getState().set({ pessoas: j.pessoas });
          intervalo = (j.intervaloSegundos ?? 20) * 1000;
        } else if (r.status === 429) intervalo = 60_000;
        else if (r.status === 404 || r.status === 405 || r.status === 501) { parado = true; return; }
      } catch { /* sem rede: tenta no próximo ciclo */ }
      timer = setTimeout(enviar, intervalo);
    };
    const visivel = () => { if (!document.hidden) { if (timer) clearTimeout(timer); void enviar(); } };
    const sair = () => { if (parado) return; try { navigator.sendBeacon?.('/api/vivo', new Blob([JSON.stringify({ id, saindo: true })], { type: 'application/json' })); } catch { /* ignora */ } };
    document.addEventListener('visibilitychange', visivel);
    window.addEventListener('pagehide', sair);
    void enviar();
    return () => { parado = true; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', visivel); window.removeEventListener('pagehide', sair); };
  }, []);
}
