# Diferenças restantes e dependências

Relação do que difere da referência pública (seuimposto.com, apuração de 2026) e do que ainda
depende de fornecedor, credencial ou asset. Conferência feita com os dados oficiais do TSE e com
o snapshot publicado pela referência (`dados/publicado/oficial/verificacao.json`: 83 de 83
abrangências idênticas em votos, seções, comparecimento, brancos, nulos e situação).

## Escolhas deliberadas

| Item | Aqui | Referência | Motivo |
|---|---|---|---|
| Tema | Claro, paleta amostrada das imagens 1 (Statista) e 2 (BBC) | Escuro (`#0F0E0D`) | Pedido do responsável |
| Marca, autoria, redes, campanha | Configuráveis em `config/marca.json`, padrões neutros de demonstração | Pandora, G4 Valley, contas pessoais | Não reproduzir identidade de terceiros |
| Formulários | Servidor próprio (SQLite local) | Infraestrutura da referência | Nada é enviado ao site original |
| Gênero nos rótulos | "Eleito(a)" | Eleito/eleita | A única fonte do TSE com gênero (`consulta_cand`) traz CPF; por regra da organização não é usada |
| Percentuais com anulados *sub judice* | Sobre válidos **sem** os anulados (ex.: RJ, governador, Douglas Ruas 50,9%) | O TSE publica 49,27% (válidos computados) | A situação (2º turno) segue a do TSE; a nota no card explica o denominador |
| "Outras N candidaturas" | Conta só as válidas (ex.: 8) | Conta também as anuladas (9) | Candidaturas anuladas aparecem à parte, identificadas |

## Diferenças de dados encontradas (a referência diverge do oficial ou de si mesma)

- **Municípios com PL à frente**: 2.906 aqui, 2.905 na referência — a malha usada aqui inclui Boa
  Esperança do Norte (MT, instalado em 2025), ausente da malha simplificada nacional do IBGE.
- **Exterior**: 41 cidades sem comparecimento. Aqui ficam sem cor ("sem votos"); a referência as
  conta para o PT (legenda "PT 127"; aqui "PT 86 · PL 59").
- **Lisboa, 2022**: 61,5% (12.153 de 19.770 válidos, TSE) contra 61,8% na referência.
- **Trípoli**: fuso `Africa/Tripoli` (fechamento às 12h de Brasília); a referência usa `Africa/Tunis`.
- **Legenda de governadores**: a captura da referência mostra "PL 8" durante uma transição; com o
  final oficial a contagem é a que o painel mostra.
- **Mapa de deputados por UF**: empate em cadeiras desempatado pelos votos do partido (PL 14); a
  referência mostra PL 13.
- **Ordem da busca**: municípios com o mesmo trecho no nome aparecem por eleitorado; a referência
  usa outra ponderação (a posição relativa de Betim e Montes Claros difere).

## Lacunas conhecidas

| Item | Situação | Para fechar |
|---|---|---|
| Áreas de zonas eleitorais | **Aproximadas**: Voronoi dos locais de votação, unido por zona e recortado pelo município (189 municípios). Identificado no mapa e no card | O TSE não publica limites de zona |
| Nomes de zona (ex.: "Sagrada Família") | Ausentes; mostramos "26ª zona" | Fonte com nomes de zona sem dados pessoais |
| Bandeiras das UFs | Selo com a sigla | Asset licenciado das bandeiras |
| Fotos | Do TSE, via proxy próprio com cache; iniciais quando faltam | — |
| Duelo no celular | Sem fotos, como na referência | — |
| Arte publicitária e destinos reais | Campanha de demonstração identificada | Responsável comercial |
| Imagem social (`og:image`) | Não criada | Tarefa própria, sem parecer resultado oficial |
| Série "Ao longo da apuração" no oficial | Registro da referência, identificado no gráfico; o último ponto confere com o TSE | Rodar o coletor ao vivo numa divulgação e usar o arquivo próprio |

## Dependências para operar ao vivo

- **Coletor ao vivo** (`npm run coletor`): implementado, com arquivamento e publicação atômica,
  mas **não exercido durante uma divulgação real** do TSE.
- **2º turno (25/10/2026)**: a página do 2º turno (`#2turno`, aberta por padrão) apresenta as
  disputas com o resultado final do 1º turno, mas a **apuração do 2º turno não é coletada** ainda —
  o adaptador aceita só turno 1 e os códigos de eleição 6257/6259; faltam os novos códigos, o feed
  do turno 2 e a apuração na página. Depois da data, a página avisa que os resultados não estão nela.
- **Hospedagem**: servidor Node 22.13+ com disco gravável para `dados/` (feed, arquivo e
  pedidos). Atrás de proxy, `CONFIAR_PROXY=1`. Sem segredos obrigatórios; `PEDIDOS_SAL` próprio é
  recomendado. Na Vercel (`vercel.json`), o feed oficial é estático e a simulação roda numa
  função, mas não há presença nem pedidos (ver README, seção Vercel), e dados novos dependem de
  um novo deploy.
- **Contato dos pedidos**: os pedidos ficam no SQLite; não há envio de e-mail nem painel — quem
  opera consulta o banco (`dados/privado/pedidos.sqlite`).

## Verificação

- Unitários: 45 testes (Vitest).
- Ponta a ponta: jornadas T01–T16 e contratos da API (Playwright, `npm run test:e2e`), rodadas com
  o Chromium headless do Playwright neste ambiente. O Chrome instalado (`E2E_CANAL=chrome`) é
  bloqueado aqui pela política da máquina, não pelo projeto.
- Igualdade visual: implementação própria; as capturas em `docs/capturas/` servem para comparar
  vistas, não reproduzem a referência pixel a pixel.
