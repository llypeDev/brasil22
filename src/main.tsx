import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/faustina/300.css';
import '@fontsource/faustina/400.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/componentes.css';
import './styles/cargos.css';
import './styles/sobreposicoes.css';
import './styles/telas.css';
import { App } from './app/App';

const raiz = document.getElementById('raiz')!;
// recursos sem os quais o painel não funciona: mapa (Canvas 2D/Path2D), layout e rede
const compativel = typeof Path2D !== 'undefined' && 'isPointInPath' in CanvasRenderingContext2D.prototype
  && typeof ResizeObserver !== 'undefined' && typeof fetch === 'function' && typeof AbortController !== 'undefined';
if (!compativel) {
  raiz.innerHTML = '<div class="incompativel"><h1>Navegador incompatível</h1><p>Este painel precisa de Canvas 2D com Path2D, ResizeObserver e fetch, indisponíveis neste navegador. Atualize-o ou use outro.</p><p><a href="https://resultados.tse.jus.br/">Ver os resultados oficiais no TSE</a></p></div>';
} else {
  createRoot(raiz).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
