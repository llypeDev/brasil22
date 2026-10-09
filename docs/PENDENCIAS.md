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
npm test               # 45 testes (Vitest)
npm run test:e2e       # jornadas T01–T16 (Playwright); Chromium via E2E_CHROMIUM=/caminho/do/chrome
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

Hoje a página do 2º turno mostra só o resultado do 1º turno (finalistas, onde cada um venceu, as 7
disputas de governador) e uma contagem regressiva. **Nada do 2º turno é coletado.** Depois de
25/10, a página avisa que os resultados não estão nela (`contagem.encerrada` em
`src/features/segundo-turno/SegundoTurno.tsx`).

**Escopo do 2º turno:** presidente (Lula × Flávio Bolsonaro; Brasil, UFs, municípios, zonas e
exterior) e governador em **7 UFs**: RJ, AM, ES, RN, DF, TO e AC. Não há Senado nem deputados.

### 1.1 Coleta e normalização (TSE)

Os códigos de eleição do 2º turno saem do `ele-c.json` do TSE
(`https://resultados.tse.jus.br/oficial/comum/config/ele-c.json`), nas eleições com `t = 2`. Pelo
padrão de 2022 (544/545 e 546/547), devem ser **6258** (federal) e **6260** (estadual); confirme
antes de fixar qualquer valor. Pontos do código presos ao 1º turno:

| Arquivo | O que muda |
|---|---|
| `server/lib/tse.mjs:56` | `lerResultado` recusa turno ≠ 1 (`'Turno inesperado.'`) |
| `server/lib/tse.mjs:27` | `minutosDaEleicao` usa 04/10 como padrão; no 2º turno, passar 25/10 |
| `scripts/tse/coletar.mjs` (`eleicaoDoCargo`) | filtra `t === 1`; precisa aceitar o turno pedido |
| `scripts/tse/coletor-ao-vivo.mjs:25` | `CARGOS` fixa 6257/6259 e inclui Senado e deputados |
| `scripts/tse/normalizar.mjs:18, 301, 306` | `ELE`, `turno: 1` e `eleicao` do manifesto fixos |
| `src/components/Retrato.tsx:11` e `server/fotos.mjs:10` | fotos por código de eleição (6257/6259) |

Recomendação: parametrizar por turno (`--turno=2`) em vez de duplicar os scripts, e publicar o 2º
turno num **diretório próprio** (ex.: `dados/publicado/oficial-2t/`, mesmo contrato de
`src/data/contratos.ts`, com `turno: 2`). O feed do 1º turno fica intacto, porque o seletor
"1º turno" continua mostrando o painel completo dele.

### 1.2 Interface

- `src/data/provedor.ts` (`baseDoModo`, `urlDe`) e `src/data/vivo.ts` (`iniciarVivo`) leem um
  único feed. O 2º turno precisa do seu, sem tirar o do 1º: por exemplo, a base do feed por turno
  e um estado separado no `src/app/store.ts` (hoje só existe `agoraVivo`, que é do 1º turno).
  `src/data/validar.ts` já aceita `turno: 2`.
- Página `src/features/segundo-turno/`: com dados do 2º turno, mostrar a apuração ao vivo
  (percentuais, votos, seções apuradas, quem venceu) no lugar dos números do 1º, e os 7 governos
  ao vivo. Os números do 1º turno podem ficar como comparação.
- Mapa do 2º turno (presidente e os 7 estados): reaproveitar o motor de `src/map/` se couber no
  prazo; senão, a grade de UFs da página já serve de mapa simplificado.
- Textos: título, linha fina e aviso de "Votação encerrada" mudam quando houver dados.

### 1.3 Publicação durante a noite da apuração

Na Vercel o feed é **estático**: dado novo só aparece com novo deploy (1–2 min cada). Isso não
serve para atualizar a cada 15–60 s. **Decisão do responsável**, escolher uma:

1. **Servidor Node próprio** (VPS, Render, Fly, Railway): `npm run coletor` e `npm start` na
   mesma máquina. É o caminho já implementado (ver INTEGRACAO.md, "Coletor ao vivo"), mas nunca
   foi exercido numa divulgação real. O domínio passa a apontar para esse servidor.
2. **Função na Vercel que lê o TSE sob demanda** e devolve o feed normalizado com
   `Cache-Control: s-maxage=15, stale-while-revalidate`. A CDN segura a audiência e o TSE recebe
   no máximo uma consulta a cada 15 s por arquivo. Exige portar a normalização do 2º turno para
   rodar por requisição.
3. **Coletor fora da Vercel gravando o feed num armazenamento** (Vercel Blob, R2). O cliente lê
   de lá: ajustar CSP (`connect-src`) e cache.

Os limites do plano Hobby da Vercel (requisições e banda) pesam numa noite de eleição: avaliar o
plano antes.

### 1.4 Testes

- Unitários do adaptador com um JSON real do 2º turno, assim que o TSE publicar a configuração.
- Simulação do 2º turno (hoje `server/simulacao.mjs` só conhece o 1º) ou dados de teste, para
  ver a apuração andando.
- E2E nova (T17): página do 2º turno com dados, troca para o 1º turno e volta.

**Pronto quando:** em 25/10, a partir da divulgação, a página do 2º turno mostra a apuração com
seções apuradas, atualiza sozinha em até 60 s, o resultado final confere com o TSE, o seletor
continua levando ao 1º turno completo e os testes passam.

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
- **CI:** o repositório não tem GitHub Actions; os testes rodam só localmente. Os minutos do mês
  do responsável acabaram. Quando houver minutos, um fluxo leve com typecheck e testes
  unitários já ajuda.
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

1. Hospedagem da noite do 2º turno (item 1.3).
2. Destino dos pedidos de acesso e anúncio (item 2).
3. Manter ou remover a presença (item 3).
4. Domínio público e proteção de deploy na Vercel (item 4).
5. Página inicial: hoje abre o 2º turno. Para voltar ao mapa do 1º turno, basta trocar
   `turnoPadrao` em `src/app/modo.ts`.
