# Integração de dados

## Fluxo

```
TSE (resultados.tse.jus.br, arquivos públicos de divulgação)
  └─ scripts/tse/coletar.mjs ........ espelho bruto em dados-brutos/tse/ (cache, retentativas, gravação atômica)
      └─ scripts/tse/normalizar.mjs .. valida e publica de forma atômica em dados/publicado/oficial/
          └─ server/app.mjs ........... /feed/oficial/* (ETag, br/gzip, no-cache)
              └─ src/data/provedor.ts + vivo.ts ... cache LRU, deduplicação, timeout, consulta periódica

server/simulacao.mjs ... a partir do final oficial, o estado em qualquer instante → /feed/simulacao/*
```

A interface só conhece o contrato deste documento (`src/data/contratos.ts`). Formatos do TSE
ficam nos adaptadores do servidor (`server/lib/tse.mjs`). Nenhuma requisição sai do navegador
para o TSE ou para a infraestrutura de outros sites; as fotos passam pelo proxy próprio.

## Provedores

| Provedor | Origem | Identificação na tela |
|---|---|---|
| `oficial` (padrão) | `dados/publicado/oficial/`, normalizado do TSE. Hoje contém o resultado **final** do 1º turno | "Dados oficiais · TSE" |
| `simulacao` (`?fonte=simulacao`) | Gerado no servidor. Calibrado (descida por coordenadas) para seguir a curva nacional de seções registrada e terminar **idêntico** ao oficial. Determinístico | "Simulação · não são resultados oficiais" |
| cenários (`?cenario=…`) | `aguardando` (antes das 17h), `vazio` (404 nos agregados), `falha` (503 em tudo), `instavel` (503 em 1/3 do tempo), `lento` (4 s por resposta) | "Cenário de teste: …" |

Regra comum: um lote que falha na validação é descartado e o último lote válido continua na
tela, com aviso. Sem nenhum lote válido, nenhum número é exibido.

## Arquivos do feed (contrato versão 1)

| Arquivo | Conteúdo |
|---|---|
| `manifesto.json` | versão, modo, origem, eleição (códigos 6257/6259, datas dos dois turnos), `seq`, `t`, `geradoNaFonte`, `recarregarSegundos` (15), municípios com zonas e número das zonas, contagens |
| `agora.json` | presidente (Brasil, 27 UFs, exterior e 5 regiões), governador e Senado por UF — cada um um `Resultado` |
| `catalogo.json` | candidaturas de presidente, governador e senador por UF (número, sequencial, nomes, partido, situação e destino do voto) e partidos/federações |
| `municipios-presidente.json` | presidente por município, em colunas alinhadas pelo código TSE |
| `uf/{uf}.json` | governador e Senado por município da UF |
| `zonas/{codigoTSE}.json` | presidente por zona, nos 190 municípios com mais de uma zona |
| `exterior.json` | cidades do exterior (colunar) e soma por país |
| `deputados/br.json`, `deputados/{uf}.json` | Câmara, assembleias e Câmara Legislativa: vagas, eleitos, agremiações e candidaturas `[número, nome, partido, votos, situação, sequencial, válido]` |
| `deputados/busca.json` | índice de busca das 18.354 candidaturas a deputado |
| `historico.json` | série nacional da apuração de presidente (`origem: "referencia"`; ver abaixo) |
| `eventos.json` | eventos: lotes de seções, viradas e definições (eleito, 2º turno), com horário e origem do horário |
| `arquivo-indice.json` | instantes com snapshot disponível para a linha do tempo |
| `presidente-2022.json` | 1º turno de 2022 por município e exterior, para a comparação |
| `senado-mantidas.json` | cadeiras do Senado que não estavam em disputa (nome, partido, UF, fim do mandato) |
| `verificacao.json` | comparação do snapshot publicado pela referência com o TSE, abrangência a abrangência |

### `Resultado`

`secoes`, `totalizadas`, `eleitorado`, `eleitoradoApurado`, `comparecimento`, `abstencao`,
`brancos`, `nulos`, `validos`, `anuladosSJ` (inteiros); `votos` e `anulados` (`{número: votos}`);
`situacao` (`aguardando | apurando | segundo-turno | eleito | eleitos | parcial | concluida`);
`situacoes` (`{número: eleito | eleito-qp | eleito-media | segundo-turno | suplente | nao-eleito}`);
`totalizadoEm`, `geradoEm` (ISO com fuso de Brasília).

### Regras de cálculo

- **Percentual** = votos da candidatura ÷ `validos`, e `validos` exclui os votos anulados *sub
  judice*. O TSE publica `pvapn` sobre os válidos computados, que incluem os sub judice; onde há
  anulados, os dois diferem (exemplo e lista em [DIFERENCAS.md](DIFERENCAS.md)).
- **Situação** (eleito, 2º turno, eleitos ao Senado, cadeiras) vem exclusivamente do campo de
  situação de cada candidatura no TSE. O painel não declara resultado por conta própria.
- **Regiões** são a soma das UFs. **Comparecimento** é sobre o eleitorado das seções
  totalizadas (`eleitoradoApurado`).
- **Validação** (`lerResultado`): fase oficial, turno e eleição esperados, abrangência igual à
  pedida, contagens inteiras e não negativas, totalizadas ≤ seções, soma nominal ≤ válidos. Qualquer
  falha lança erro e o normalizador não publica.
- **Publicação atômica**: o normalizador escreve num diretório temporário e troca de nome; o
  servidor invalida o cache pelo `mtime` do manifesto.

## Rotas do servidor

| Rota | Descrição |
|---|---|
| `GET /feed/oficial/{arquivo}` | feed oficial (ETag, compressão, `no-cache`) |
| `GET /feed/oficial/arquivo/{t}/{arquivo}` | snapshot do instante `t` (minutos desde 00:00 de 04/10); o final ou os arquivados pelo coletor; sem registro → 404 `{ semRegistro: true }` |
| `GET /feed/oficial/arquivo-indice.json` | índice publicado + snapshots próprios do coletor |
| `GET /feed/simulacao/{arquivo}` e `/feed/simulacao/arquivo/{t}/{arquivo}` | simulação no relógio atual ou num instante já ocorrido |
| `GET /feed/cenario/{nome}/{arquivo}` | cenários de teste |
| `GET /feed/fotos/{eleição}/{uf}/{sequencial}.jpeg` | foto oficial via proxy com cache em disco (parâmetros validados) |
| `GET /feed/anuncio.json` | campanha ativa (`config/marca.json`) |
| `POST /api/vivo` | presença (identificador efêmero, em memória) |
| `POST /api/acesso` | pedidos de acesso/anúncio: 201 só após gravação confirmada; 400 por campo; 415; 429 com `Retry-After` |
| `GET /api/saude` | estado do serviço |
| `GET/POST /api/simulacao/relogio` | ler/fixar o relógio simulado (`{ t, velocidade }`); 403 em produção |

Escritas em `/feed/*` respondem 405; caminhos fora do padrão de arquivo do feed, 404.

## Linha do tempo

- **Oficial**: o TSE publica só o estado corrente. O painel tem o snapshot final e, quando o
  coletor roda durante a divulgação, cada estado publicado é arquivado em
  `dados/arquivo-oficial/{t}/`. Instantes sem registro mostram "Sem registro neste instante" —
  nunca números interpolados.
- **"Ao longo da apuração"** (gráfico nacional): `historico.json` é a série registrada pela
  referência durante a apuração de 2026 (o TSE não publica série histórica). O gráfico diz isso e
  o último ponto confere com o arquivo oficial. Com o coletor rodando numa próxima divulgação, a
  série passa a ser a do próprio arquivo.
- **Simulação**: qualquer instante já ocorrido no relógio simulado.
- Consultar um instante passado não é alterado pela consulta periódica; "Voltar ao vivo" retoma.

## Coletor ao vivo (divulgação real)

```bash
npm run coletor
```

A cada `TSE_INTERVALO` segundos (padrão 30): consulta os agregados BR/UF de cada cargo e compara
a geração (`idg`); para o que mudou, rebaixa os arquivos municipais e de zonas daquele cargo;
arquiva o snapshot publicado atual; roda o normalizador. Recuo exponencial em 429/5xx (respeita
`Retry-After`, até 5 min). Deve rodar na mesma máquina do servidor, que lê o mesmo diretório.

Limites conhecidos, a resolver antes de uma divulgação real:

- **Não foi exercido durante uma divulgação.** A publicação foi testada com o final do 1º turno.
- **2º turno (25/10/2026):** integração implementada, aguardando publicação de eleições
  `t=2` e resultados reais pelo TSE. A conferência final exige a divulgação oficial.
- Coleta municipal completa de um cargo a cada mudança: suficiente para 30 s, mas gera tráfego;
  preferir rebaixar só as UFs alteradas se o TSE publicar com frequência maior.

## Reconstruir os insumos

| Insumo | Como obter | Comando |
|---|---|---|
| Resultados 2026 (todos os cargos, municípios, zonas, exterior) | baixados pelo script do TSE | `npm run dados:tse:coletar -- --cargos=1,3,5 --zonas` e `-- --cargos=6,7,8`, depois `npm run dados:tse:normalizar` |
| Presidente 2022 | `votacao_partido_munzona_2022.zip` do TSE Dados Abertos em `dados-brutos/tse-2022/` | `npm run dados:2022` |
| Senado: cadeiras mantidas | API de Dados Abertos do Senado (só nome, partido, UF e mandato são gravados) | `npm run dados:senado` |
| Geografia do Brasil e do mundo | malhas municipais do IBGE por UF (API de malhas v3, MT pela malha 2025) em `../assets-pesquisa/municipios/{uf}.geojson` e `estados.json`, `br-uf.geojson`; nomes do IBGE em `dados-brutos/ibge/municipios.json`; Natural Earth (`ne_50m_admin_0_countries`, `ne_10m_populated_places`) em `dados-brutos/natural-earth/` | `npm run dados:geo` |
| Áreas aproximadas de zonas | `eleitorado_local_votacao_2026.zip` do TSE Dados Abertos em `dados-brutos/tse-locais/` (lidos só UF, município, zona, local, coordenadas e eleitores) | `npm run dados:zonas` |

Os resultados geográficos (`public/geo/`) e o feed publicado (`dados/publicado/oficial/`) estão
versionados; os brutos (`dados-brutos/`, ~430 MB) não.

## Marca e campanhas

`config/marca.json`: título, autoria, redes, faixa institucional, convite, "anuncie aqui" e
campanhas (`id`, cores, textos da faixa/card/modal, `destino` — URL externa ou `null` para abrir o
formulário de anúncio). A campanha padrão é de demonstração e está identificada como tal.

## Apuração do 2º turno — opção 2 de publicação

A função `api/segundo-turno.mjs` e o servidor local compartilham `server/segundo-turno.mjs`.
A interface só consulta o servidor próprio. A função normaliza os arquivos públicos `-u.json`
do TSE por abrangência, sem consultas de cadastro pessoal. Valida fase, eleição, turno,
abrangência, contagens e geração; o status eleitoral vem das situações oficiais das candidaturas.

| Rota | Conteúdo |
|---|---|
| `/feed/oficial-2t/painel.json` | manifesto, catálogo e `Agora` de um lote; antes da divulgação, `agora: null`, `aguardando: true` |
| `/feed/oficial-2t/resultados/presidente/br.json` | resultado nacional e candidaturas |
| `/feed/oficial-2t/resultados/{presidente,governador}/{uf}.json` | resultado da UF; `zz` para presidente no exterior |
| `/feed/oficial-2t/resultados/{cargo}/{uf}/{tse}.json` | município ou cidade do exterior, confirmado no cadastro do TSE |
| `/feed/oficial-2t/resultados/presidente/{uf}/{tse}/z{zona}.json` | zona eleitoral, confirmada no cadastro do TSE |
| `/feed/oficial-2t/cadastro/{cargo}/{uf}.json` | somente códigos municipais e números das zonas; nomes vêm da geografia local |

Cache de sucesso/ausência: `public, max-age=0, s-maxage=15, stale-while-revalidate=15`.
A CDN guarda as respostas por 15 s e revalida em segundo plano por até outros 15 s.
Erros do TSE/contrato retornam 503, `no-store` e `Retry-After`; o cliente preserva o último
lote válido. A interface consulta a cada 15 s, com recuo em falhas até 60 s. Requisições
iguais em voo são compartilhadas e o cache em memória tem limite de 512 arquivos por instância.
O limite é por instância/região da CDN; não é uma garantia global de uma chamada ao TSE.

Fonte dos códigos: [configuração oficial do TSE](https://resultados.tse.jus.br/oficial/comum/config/ele-c.json).
Em 09/10/2026, `cdt2` indica 6258/6260, mas não há entradas `t=2`: o feed aguarda sem
fixar códigos previstos nem confundir os resultados do 1º turno com os do 2º.
Cabeçalhos: [documentação da Vercel](https://vercel.com/docs/caching/cache-control-headers).

Os scripts continuam disponíveis para coleta/publicação local:

```bash
npm run dados:tse:coletar -- --turno=2 --zonas --forcar
npm run dados:tse:normalizar -- --turno=2
npm run coletor -- --turno=2
```

Geram `dados/publicado/oficial-2t/`, com minutos desde 00:00 de 25/10 e arquivo/estado
separados do 1º turno. A publicação escolhida na Vercel usa a função, e não esses arquivos.
Não há Senado, deputados nem série histórica de referência no feed do 2º turno.
