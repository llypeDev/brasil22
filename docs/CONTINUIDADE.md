# Continuidade — Apuração 2026

Arquivo para retomar o trabalho sem recomeçar fases.

## Pedido

Seguir `PLANO_REPLICA_SEUIMPOSTO.md` e `PROMPT_EXECUCAO_SEUIMPOSTO.txt` (fora deste repositório) e
finalizar a construção. **Cores: seguir as imagens de referência 1 (Statista) e 2 (BBC)** — tema
claro — em vez do tema escuro do plano. A imagem 3 serviu de referência para rótulos e chamadas
sobre o mapa.

## Decisões

1. Projeto próprio: React 19 + TypeScript + Vite 7, servidor Node sem dependências de execução.
2. Dados: provedor **oficial** (TSE coletado e normalizado, 83/83 abrangências idênticas ao
   snapshot da referência) e provedor **simulação** (determinístico, no servidor, a partir do
   final oficial, sempre rotulado). Cenários de falha/vazio/lentidão por parâmetro.
3. Percentuais sobre votos válidos sem anulados *sub judice*; situação (eleito/2º turno) sempre
   do TSE.
4. Marca, autoria e campanhas configuráveis (`config/marca.json`), com padrões neutros.
5. Sem `consulta_cand` (contém CPF). Da API do Senado só nome/partido/UF/mandato. Do cadastro de
   locais de votação só coordenadas e contagens.
6. Projeção do Brasil: Mercator pré-projetada em 10.000 unidades; mundo: Natural Earth.

## Paleta (amostrada)

Azul `#1E57C9` · vermelho `#D82121` · cinza neutro `#A8A8A8` · fundo `#F4F4F4` · faixa `#ECECEC`
· grade `#D4D4D4` · texto `#111` / `#505050`.

## Estado (08/10/2026)

- R01–R24 e T01–T15: ver [CHECKLIST.md](CHECKLIST.md). Diferenças e dependências:
  [DIFERENCAS.md](DIFERENCAS.md).
- Verificação: `npm run typecheck`, `npm test` (34), `npm run build`, `npm run test:e2e`.
- Neste ambiente, o Playwright roda com o Chromium headless já baixado:
  `E2E_CHROMIUM=%LOCALAPPDATA%/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`.
  O Chrome instalado (`E2E_CANAL=chrome`) é encerrado pela política da máquina.
- O painel do navegador do aplicativo, quando oculto, não executa `requestAnimationFrame`, não
  entrega `resize` nem `ResizeObserver` e atrasa timers: para medir animações e layout nele,
  simular quadros (`requestAnimationFrame = cb => setTimeout(...)`) e disparar `resize`.

## Próximos passos possíveis

1. 2º turno (25/10/2026): códigos de eleição novos, turno 2 no adaptador, escopo e textos.
2. Exercitar o coletor ao vivo numa divulgação real e passar a série da linha do tempo para o
   arquivo próprio.
3. Assets pendentes: bandeiras das UFs, imagem social, arte publicitária real.
