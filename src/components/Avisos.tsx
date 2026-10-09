import { create } from 'zustand';

interface EstadoAvisos { texto: string | null; id: number; set: (texto: string | null) => void }
const useAvisos = create<EstadoAvisos>((set) => ({ texto: null, id: 0, set: (texto) => set((s) => ({ texto, id: s.id + 1 })) }));

let timer: ReturnType<typeof setTimeout> | null = null;
export function avisar(texto: string, ms = 3200) {
  useAvisos.getState().set(texto);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => useAvisos.getState().set(null), ms);
}

export function Avisos() {
  const { texto, id } = useAvisos();
  return (
    <div className="avisos" role="status" aria-live="polite">
      {texto && <div key={id} className="aviso-toast">{texto}</div>}
    </div>
  );
}
