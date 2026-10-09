import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('.', import.meta.url));

/** Monta o servidor próprio (feeds, simulação, presença, pedidos, fotos) dentro do Vite. */
function servidorProprio(): Plugin {
  return {
    name: 'apuracao-servidor-proprio',
    async configureServer(server) {
      if (process.env.VITEST) return; // testes unitários não precisam do servidor próprio
      const { criarApp } = await import('./server/app.mjs');
      const tratar = await criarApp({ raiz, producao: false });
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url.startsWith('/feed/') || url.startsWith('/api/')) {
          void tratar(req, res, next);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), servidorProprio()],
  server: { port: 5180, strictPort: false, host: '127.0.0.1' },
  preview: { port: 5181 },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
