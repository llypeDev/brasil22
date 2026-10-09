# Instruções para agentes (Codex, Claude e outros)

- Comece por [docs/PENDENCIAS.md](docs/PENDENCIAS.md): o que falta fazer, em ordem de prioridade,
  e as regras do projeto (seção 0).
- Tudo em português: código, identificadores, comentários, commits e documentação.
- Sem dados pessoais sensíveis: nunca usar o `consulta_cand` do TSE nem coletar CPF, RG,
  telefone ou dados financeiros.
- Situação eleitoral sempre a oficial do TSE; percentuais sobre os votos válidos, sem os anulados
  *sub judice*.
- Visual verde e amarelo (`src/styles/tokens.css`); não voltar ao azul e vermelho.
- Antes de abrir PR: `npm run typecheck`, `npm test` e, se mexer em tela ou navegação,
  `npm run test:e2e`. A `main` é publicada na Vercel (`vercel.json`, `npm run build:vercel`).
