# Pendências — para quem for continuar

Estado em 09/10/2026, depois das PRs #1 a #3. Escrito para outra IA (ou pessoa) assumir o trabalho
sem o histórico da conversa. Ordem de prioridade: **1 é urgente** (tem data), o resto pode esperar.

## 0. Antes de começar

**O que existe.** Painel de apuração das eleições de 2026 (React 19 + TypeScript + Vite, servidor
Node sem dependências de execução). Mostra o resultado **final do 1º turno** (04/10/2026) com mapa
municipal, cargos, exterior, linha do tempo e modo TV. Desde a PR #2, o endereço principal abre a
**página do 2º turno** (`#2turno`), com o seletor **1º turno | 2º turno** no topo. Visão geral no
[README](../README.md); decisões em [CONTINUIDADE.md](CONTINUIDADE.md); lacunas em
[DIFERENCAS.md](DIFERENCAS.md); integração com o TSE em [INTEGRACAO.md](INTEGRACAO.md).

**Histórico recente.**
- PR #1: identidade verde e amarela com a bandeira do Brasil (PL em verde, PT em amarelo).
- PR #2: página do 2º turno e navegação por turno (`src/features/segundo-turno/`, `#2turno`).
- PR #3: publicação na Vercel. O feed oficial vira arquivos estáticos e a simulação roda numa
  função (ver README, seção Vercel).
- Uma tarefa do Codex com a "opção de ver o 1º turno" nunca chegou ao GitHub. Ela já foi feita na
  PR #2: descarte-a.

**Comandos.**

```bash
npm install
npm run dev            # http://127.0.0.1:5180, com feeds e APIs do servidor próprio
npm run typecheck
npm test               # 54 testes (Vitest)
npm run test:e2e       # jornadas T01–T17 (Playwright); Chromium via E2E_CHROMIUM=/caminho/do/chrome
npm run build          # build para o servidor Node (npm start)
npm run build:vercel   # build + feed oficial estático em dist/feed (o que a Vercel roda)
```

**Regras do projeto (não negociáveis).**
- Código, identificadores, comentários, commits e documentação em **português**, no estilo do que
  já existe. Comentários explicam o porquê.
- **Sem dados pessoais sensíveis**: nunca usar o `consulta_cand` do TSE (traz CPF) nem coletar
  CPF, RG, telefone ou dados financeiros. Ver README, seção Privacidade.
- Percentuais sobre votos válidos **sem** os anulados *sub judice*. Situação (eleito, 2º turno)
  **sempre** a oficial do TSE, nunca deduzida de percentuais.
- Visual **verde e amarelo** (`src/styles/tokens.css`: `--verde #007A3D`, `--verde-escuro
  #004D2B`, `--amarelo #FFDF00`; cores dos partidos em `src/data/partidos.ts`). Não voltar ao
  azul e vermelho.
- Toda mudança passa por `npm run typecheck`, `npm test` e, se mexer em tela ou navegação,
  `npm run test:e2e`. Trabalhar em branch, abrir PR para `main`; a Vercel publica a `main`.

## 1. Apuração do 2º turno — urgente (votação em 25/10/2026)

~~Coletar e exibir a apuração do 2º turno.~~ Implementação preparada em 09/10/2026.

**Decisão do responsável:** opção **2**, função na Vercel com cache na CDN. O 1º turno
continua estático, no feed próprio, e o endereço principal continua abrindo `#2turno`.

### 1.1 Coleta e normalização — implementadas

- `lerResultado` valida o turno solicitado (1 por padrão, 2 explicitamente).
- Códigos obtidos de `ele-c.json`, somente de eleições com `t=2`. Em 09/10 a configuração
  ainda só contém `t=1`, com `cdt2=6258/6260`: esses valores previstos **não** habilitam resultados.
- `coletar.mjs`, `normalizar.mjs` e `coletor-ao-vivo.mjs` aceitam `--turno=2`; restringem a coleta
  a presidente e governador nas sete UFs (RJ, AM, ES, RN, DF, TO, AC), com diretório de
  publicação/arquivo/estado separado. Os minutos do 2º turno começam em 25/10.
- `server/segundo-turno.mjs` compartilha a normalização entre função, servidor local e publicação
  em disco. Só arquivos públicos de divulgação, com contagens/abrangências/turno validados.
- Fotos recebem o código confirmado no manifesto; o proxy local confirma eleições novas.

### 1.2 Interface — implementada

- Feed `/feed/oficial-2t/` e estado próprios; manifesto, catálogo e contagens no mesmo lote.
- Votos, percentuais, seções e situação oficial de presidente e dos sete governos.
- Grade de UFs (opção prevista no escopo), com consultas de municípios, zonas e exterior.
  A grade mostra liderança, sem previsão de vitória; somente `Eleito` do TSE autoriza o selo.
- Consulta a cada 15 s; pausa em aba oculta, retoma ao voltar/reconectar e mantém o último
  lote válido em falhas, respostas inválidas ou regressão de sequência.
- Antes da divulgação, a referência do 1º turno fica explicitamente identificada.

### 1.3 Publicação — opção 2 implementada

`api/segundo-turno.mjs` consulta o TSE sob demanda, com
`Cache-Control: public, max-age=0, s-maxage=15, stale-while-revalidate=15`, cache limitado por
instância e deduplicação de requisições. `vercel.json` encaminha apenas o feed do 2º turno a
essa função. Não precisa de novo deploy a cada lote. Detalhes em [INTEGRACAO](INTEGRACAO.md).

### 1.4 Testes e conferência

- Amostras artificiais isoladas em `tests/fixtures/segundo-turno.ts`: divulgação ausente,
  parcial, final, municípios, zonas, cache, erros e rejeição de outro turno.
- T17: apuração, consulta de lugares, 2º → 1º → 2º, atualização, falha e lote regressivo.
- Validação automática com Node 22 e Chromium no GitHub Actions; executar os três comandos
  da seção 0 antes da PR.
- **Ainda depende da publicação pelo TSE:** adicionar um JSON real de 2026/2º turno ao teste
  do adaptador e conferir os totais finais e a cadência durante a divulgação de 25/10.
  Não afirmar que a integração foi exercida com resultados reais antes dessa divulgação.

## 2. Pedidos de acesso e de anúncio na Vercel

Os formulários "Acesso sob convite" e "Quero anunciar" gravam em SQLite no servidor Node
(`server/pedidos.mjs`). Na Vercel não há esse serviço: o formulário mostra "O envio de pedidos
está indisponível neste endereço por enquanto".

- **Decisão do responsável:** onde guardar ou para quem enviar. Opções: banco gerenciado (Neon
  Postgres ou Upstash Redis pelo Marketplace da Vercel), Supabase, ou envio por e-mail (Resend).
- Manter `validarPedido`, o honeypot, os limites por IP e por e-mail e a regra de só responder
  "Pedido recebido" depois de gravar. Retenção de 180 dias (`PEDIDOS_RETENCAO_DIAS`).
- Atualizar o README, seção Privacidade: hoje diz que nada vai a terceiros.
- Hoje não há painel para ler os pedidos, nem no servidor Node; alguém precisa recebê-los.

## 3. Presença ("pessoas agora") na Vercel

O contador fica em memória no servidor Node (`server/presenca.mjs`). Na Vercel a aba faz uma
tentativa, recebe 404 e para (`src/features/presenca/usePresenca.ts`). Opcional: Redis com
expiração (Upstash) e intervalo maior que 20 s, para não multiplicar as chamadas de função. Ou
remover o recurso. **Decisão do responsável.**

## 4. Vercel e publicação

- **Proteção de deploy:** todos os endereços `*.vercel.app` do projeto pedem login da Vercel.
  Para o público ver, configurar um domínio de produção ou ajustar *Settings → Deployment
  Protection*. Feito pelo responsável, no painel da Vercel.
- ~~Criar CI no GitHub Actions.~~ Implementado em `.github/workflows/validar.yml`, com
  Node 22, `npm run typecheck`, 54 testes unitários, 20 testes E2E com Chromium e
  `npm run build:vercel`. O fluxo valida a branch de implementação do 2º turno e as PRs
  para `main`; a execução da PR #5 passou em 09/10/2026.
- Menor: na Vercel, o instante final exato da linha do tempo
  (`/feed/oficial/arquivo/{t final}/…`) não existe como arquivo e cai na série nacional. A linha
  do tempo já leva o instante final para "ao vivo", então só um link direto com `~t…` sente.

## 5. Documentação

- `docs/capturas/01–29` ainda mostram o visual azul e vermelho, de antes da PR #1. Regenerar com
  `node scripts/capturas.mjs`, com `npm run dev` rodando; o Chromium vem de `E2E_CHROMIUM`.
- Manter este arquivo atualizado: riscar o que for feito e registrar decisões novas.

## 6. Pendências antigas (de DIFERENCAS.md)

- Coletor ao vivo nunca exercido numa divulgação real; a série "Ao longo da apuração" do 1º
  turno é a registrada pela referência, não um arquivo próprio.
- Assets: bandeiras das UFs (hoje um selo com a sigla), imagem social (`og:image`), arte
  publicitária real e seus destinos.
- Nomes das zonas eleitorais (hoje "26ª zona"); as áreas das zonas são aproximadas.

## Decisões que dependem do responsável

1. ~~Hospedagem da noite do 2º turno~~: escolhida a opção 2 (função Vercel com cache).
2. Destino dos pedidos de acesso e anúncio (item 2).
3. Manter ou remover a presença (item 3).
4. Domínio público e proteção de deploy na Vercel (item 4).
5. Página inicial: hoje abre o 2º turno. Para voltar ao mapa do 1º turno, basta trocar
   `turnoPadrao` em `src/app/modo.ts`.
