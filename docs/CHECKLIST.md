# Checklist R01–R24 e T01–T16

Estado em 08/10/2026. **Feito** = implementado e verificado na interface (painel do navegador e/ou
Playwright); **Feito\*** = feito com diferença ou limite registrado em
[DIFERENCAS.md](DIFERENCAS.md). Capturas em [capturas/](capturas/).

## Requisitos

| # | Requisito | Estado | Evidência |
|---|---|---|---|
| R01 | Faixas superiores (campanha e apresentação); altura altera a área útil | Feito\* — campanha de demonstração configurável | `features/comercial/Faixas.tsx`, layout desconta a altura medida; capturas 01, 15 |
| R02 | Cabeçalho: título, autoria, redes, cargos, busca, atualização, exterior, compartilhar, tela cheia | Feito\* — redes vazias por padrão (`config/marca.json`) | `components/Cabecalho.tsx`; captura 01 |
| R03 | Presidente nacional: manchete, líderes, percentuais, votos, diferença, lista completa, indicadores | Feito | `features/presidente/CardNacional.tsx`; "Flávio Bolsonaro e Lula vão ao 2º turno", 47,03% × 45,16%, 1,87 ponto, 12 candidaturas; captura 01 |
| R04 | Evolução dos dois primeiros | Feito\* — série do oficial vem do registro da referência, identificada | `CardEvolucao.tsx`; captura 01 |
| R05 | Regiões, exterior, líder, totalização e comparação com 2022 | Feito | `CardRegioes.tsx` (ex.: Norte PL 49,2% +3,7) |
| R06 | Atualizações: eventos, horário, seções, situação; itens navegáveis | Feito | `features/atualizacoes`; clique leva à UF do evento |
| R07 | Governadores: 27 disputas, eleitos/2º turno, estados, disputas apertadas | Feito | `CardGovernadores.tsx` (20 eleitos · 7 em 2º turno); captura 02; T05 |
| R08 | Senado: composição, duas vagas por UF, disputa pela segunda vaga | Feito | `CardSenado.tsx`, hemiciclo de 81 cadeiras; captura 03; T06 |
| R09 | Deputados federais: Câmara, partido/bloco, mais votados, lista completa | Feito | `CardDeputados.tsx`, 513 cadeiras, barra ideológica, 10 mais votados idênticos à referência; captura 04 |
| R10 | Deputados estaduais e variante distrital no DF | Feito | 1.059 cadeiras; DF "Câmara Legislativa · 24 vagas", "Distritais"; captura 05; T07 |
| R11 | Mapa nacional: municípios, estados, vantagem, apurado, candidato | Feito | `map/useDesenho.ts`; capturas 01, 26, 27; T01 |
| R12 | Detalhe de UF: mapa ampliado, presidente, governador, Senado, listas, anterior/próximo | Feito | `CardUf.tsx` + lista de municípios por teclado; captura 07 |
| R13 | Município: resultados, seções, comparecimento, abstenção, brancos/nulos, 2022 | Feito | `CardMunicipio.tsx`; captura 09 |
| R14 | Zona: área aproximada, resultados, eleitorado, seleção, paginação, retorno | Feito\* — áreas aproximadas (Voronoi dos locais), sem nomes de zona | `scripts/geo/construir-zonas.mjs`, 189 municípios; captura 10; T02 |
| R15 | Candidato: identificação, partido/número, situação, votos, melhor/pior lugar | Feito\* — rótulos neutros de gênero | `CardPerfil.tsx`; captura 06; T04 |
| R16 | Exterior: mapa-múndi, países, cidades, resultados, fechamento das urnas | Feito | `CardExterior.tsx` (Lisboa: urnas fecharam às 13h de Brasília); capturas 11–13; T08 |
| R17 | Busca: município, zona, estado, país, cidade, candidaturas de todos os cargos | Feito | `features/busca`, índice de 18.354 deputados sob demanda; captura 08; T03 |
| R18 | Linha do tempo: instantes passados e volta ao atual | Feito\* — no oficial, só a série nacional e o final têm registro | `LinhaDoTempo.tsx`; link direto `~tHHMM`; T09, T11 |
| R19 | TV: layout ampliado, roteiro, eventos, faixa inferior, saída | Feito | `telas/Tv.tsx`, `features/tv/roteiro.ts` (9 cenas, interrupção por definição); captura 14; T14 |
| R20 | Publicidade: modal, faixa, card rotativo, indicadores, contato | Feito\* — campanha de demonstração | `features/comercial`; capturas 18, 29 |
| R21 | Formulários de acesso e de anúncio: validação, envio, confirmação | Feito | `server/pedidos.mjs` (validação, antispam, limites, SQLite, confirmação só após gravar); T13 e `tests/e2e/api.spec.ts` |
| R22 | Presença sustentada por serviço próprio | Feito | `server/presenca.mjs` (sessões efêmeras em memória) |
| R23 | Desktop, altura reduzida, tablet, celular vertical e horizontal | Feito | `app/layout.ts`; capturas 15, 16, 20–24; T15 |
| R24 | Carregamento, ausência de dados, falha de rede, reconexão, navegador incompatível | Feito | cenários `?cenario=…`, último dado mantido, recuo exponencial, `main.tsx` (checagem de recursos e alternativas de `AbortSignal`); T12 |

## Jornadas

Automatizadas em [`tests/e2e/jornadas.spec.ts`](../tests/e2e/jornadas.spec.ts) (Playwright) e
também percorridas manualmente no painel do navegador.

| # | Jornada | Estado | O que é conferido |
|---|---|---|---|
| T01 | Presidente → trocar camadas | Feito | URL (`~e`, `~v`, `~a`) e legenda de cada camada |
| T02 | Brasil → MG → Belo Horizonte → zona | Feito | `#presidente-mg-3106200-z26`, card da 26ª zona, Esc nível a nível, voltar/avançar do navegador |
| T03 | Buscar nome sem acento | Feito | "sao jose do rio preto" → SP; cinco "Bom Jesus" distinguidos pela UF |
| T04 | Candidato nacional → fechar ficha | Feito | ficha abre o mapa da candidatura (`~c13`) e, ao fechar, restaura a camada anterior (`~e`) |
| T05 | Governadores → disputa apertada → UF | Feito | UF da disputa mais apertada, Governador primeiro, selo de situação do TSE |
| T06 | Senado → segunda vaga | Feito | UF da disputa pela 2ª vaga, seção do Senado primeiro, candidaturas da UF |
| T07 | Deputados → estadual → DF | Feito | "Câmara Legislativa", "Distritais" selecionado |
| T08 | Exterior → Portugal → Lisboa → retornar | Feito | hierarquia na URL, fechamento às 13h de Brasília, voltar/Esc, troca de cargo |
| T09 | Tempo passado → nova atualização → voltar ao atual | Feito | com novo lote ao vivo, o instante consultado não muda; "Voltar ao vivo" mostra o novo |
| T10 | Copiar link → outro navegador | Feito | contexto novo restaura cargo, UF e camada; fragmentos inválidos são normalizados |
| T11 | Atalhos e teclado | Feito | Ctrl+K e "/" com foco na busca, foco devolvido, 1–4, + − 0 (estado dos botões de zoom), controle deslizante |
| T12 | Rede offline → restaurar | Feito | último dado mantido com aviso, reconexão automática; fonte fora do ar não mostra número algum |
| T13 | Pedido inválido, 429, sucesso | Feito | erro por campo, "Pedido recebido" só com a linha gravada no banco, limite por e-mail com prazo |
| T14 | Entrar na TV → roteiro → sair | Feito | troca de cena sozinha sem empilhar histórico; Esc volta ao contexto anterior |
| T15 | Rotacionar celular | Feito | retrato ↔ paisagem sem rolagem lateral, zoom desobstruído, mapa clicável após cada giro |
| T16 | Página do 2º turno ↔ 1º turno | Feito | sem fragmento abre o 2º turno (duelo, 7 governos); estado da grade abre o mapa do 1º turno e voltar retorna; seletor de turno, Esc e atalho de cargo; capturas 30, 31 |

## Verificações de build

| Comando | Resultado |
|---|---|
| `npm run typecheck` | sem erros |
| `npm test` | 45 testes passando |
| `npm run build` | build de produção gerado |
| `npm run test:e2e` | jornadas T01–T16 e contratos da API passando (Chromium headless) |
