import { useEffect, useMemo, useState } from 'react';
import { useEstado } from './store';
import { iniciarUrl, lerModoDaUrl, definirValidadores } from './url';
import { iniciarVivo } from '../data/vivo';
import { usarVivoSegundoTurno } from '../data/vivo-segundo-turno';
import { obterGeoBrasil, useGeoBrasil } from './dados';
import { calcularLayout, useAltura, useViewport } from './layout';
import { Faixas } from '../features/comercial/Faixas';
import { Desktop } from './telas/Desktop';
import { Celular } from './telas/Celular';
import { Tv } from './telas/Tv';
import { PaginaSegundoTurno } from '../features/segundo-turno/SegundoTurno';
import { Sobreposicoes } from './Sobreposicoes';
import { usarAtalhos } from './atalhos';
import { usePresenca } from '../features/presenca/usePresenca';
import { useMapa } from '../map/api';

export function App() {
  const vp = useViewport();
  const [faixas, setFaixas] = useState<HTMLElement | null>(null);
  const hFaixas = useAltura(faixas);
  const tv = useEstado((s) => s.nav.tv);
  const nav = useEstado((s) => s.nav);
  const modo = useEstado((s) => s.modo);
  const segundoTurno = nav.turno === 2 && !tv;
  usarVivoSegundoTurno(segundoTurno && modo === 'oficial');
  const carregandoGeo = !useGeoBrasil().dados;
  const carregando2t = useEstado((s) => s.modo === 'oficial' && s.painelSegundoTurno?.agora ? false : !s.agoraVivo || !s.catalogo);

  // inicialização: modo de dados, URL e acompanhamento ao vivo
  useEffect(() => {
    useEstado.getState().set({ modo: lerModoDaUrl() });
    const pararUrl = iniciarUrl();
    const pararVivo = iniciarVivo();
    return () => { pararUrl(); pararVivo(); };
  }, []);

  // valida o fragmento contra geografia e catálogo assim que estiverem disponíveis
  const catalogo = useEstado((s) => s.catalogo);
  useEffect(() => {
    if (!catalogo) return;
    let vivo = true;
    obterGeoBrasil().then((geo) => {
      if (!vivo) return;
      definirValidadores(() => ({
        ufExiste: (uf) => geo.ufIndice.has(uf),
        municipioDaUf: (uf, ibge) => { const i = geo.porIbge.get(ibge); return i != null && geo.uf[i] === uf; },
        candidatoExiste: (cargo, uf, n) => cargo === 'presidente' ? catalogo.presidente.some((c) => c.n === n) : cargo === 'governadores' ? !!uf && (catalogo.governador[uf] ?? []).some((c) => c.n === n) : cargo === 'senado' ? !!uf && (catalogo.senador[uf] ?? []).some((c) => c.n === n) : false,
      }));
    }).catch(() => undefined);
    return () => { vivo = false; };
  }, [catalogo]);

  usarAtalhos();
  usePresenca();

  const colunaDireita = !tv;
  const layout = useMemo(() => calcularLayout(vp.w, Math.max(200, vp.h - (tv ? 0 : hFaixas)), tv, colunaDireita), [vp.w, vp.h, hFaixas, tv, colunaDireita]);
  const fluxo = layout.variante === 'celular';
  useEffect(() => { document.body.classList.toggle('fluxo', fluxo); }, [fluxo]);

  // título do documento acompanha o contexto
  useEffect(() => {
    const partes = ['Apuração 2026'];
    if (nav.turno === 2) partes.unshift('2º turno');
    else if (nav.zz) partes.unshift('Exterior');
    else if (nav.uf) partes.unshift(nav.uf);
    document.title = partes.join(' · ');
  }, [nav.turno, nav.uf, nav.zz]);

  const carregandoMapa = useMapa((s) => s.carregando);
  // O lote do 2º turno basta; antes da divulgação, usa a referência do 1º turno.
  const carregando = segundoTurno ? carregando2t : carregandoGeo || carregandoMapa;

  return (
    <div className={`app v-${layout.variante} altura-${layout.altura} modo-${modo} turno-${segundoTurno ? 2 : 1}`} data-carregando={carregando ? 'sim' : 'nao'}>
      {!tv && <Faixas refRaiz={setFaixas} variante={layout.variante} />}
      {layout.variante === 'tv' ? <Tv layout={layout} /> : segundoTurno ? <PaginaSegundoTurno layout={layout} topo={hFaixas} /> : layout.variante === 'desktop' ? <Desktop layout={layout} topo={hFaixas} /> : <Celular layout={layout} topo={hFaixas} />}
      <Sobreposicoes variante={layout.variante} />
    </div>
  );
}
