# Catálogo de assets e fontes de dados

Consulta: 08/10/2026. Cada item registra origem, uso permitido e arquivo local. Nada aqui é
copiado do build do seuimposto.com; os arquivos públicos da referência foram usados apenas para
conferir contratos e resultados.

## Dados eleitorais

| Asset | Origem | Uso | Arquivo local |
|---|---|---|---|
| Resultados 2026, 1º turno (presidente, governador, senado, deputados federais/estaduais/distritais), por Brasil, UF, município, zona e cidade do exterior | TSE, arquivos públicos de divulgação — `https://resultados.tse.jus.br/oficial/ele2026/{6257,6259}/dados/...-u.json` | Dados públicos oficiais | brutos em `dados-brutos/tse/` (17.765 arquivos, 0 falhas); normalizados em `dados/publicado/oficial/` |
| Configuração da eleição e cadastro de municípios/zonas | TSE — `oficial/comum/config/ele-c.json`, `config/mun-e006257-cm.json` | idem | `dados-brutos/tse/oficial/...` |
| Fotos das candidaturas | TSE — `oficial/ele2026/{eleição}/fotos/{uf}/{sq}.jpeg` | Divulgação oficial; servidas pelo proxy próprio com cache | `dados-brutos/fotos/` (sob demanda) |
| Presidente 2022, 1º turno, por município/zona e exterior | TSE Dados Abertos — `votacao_partido_munzona_2022.zip` (`_BR.csv`) | Comparação histórica | `dados/historico/presidente-2022-1t.json` |
| Cadeiras do Senado mantidas até 2031 | Senado Federal — Dados Abertos `senador/lista/atual` | Composição; **somente nome, partido, UF e fim do mandato** são gravados (contatos descartados) | `dados/senado/cadeiras-mantidas.json` |
| Série nacional da apuração (presidente) e horários de definição | Registro da referência (`referencia-seuimposto/feed/historico.json`, `agora.json`) — **não auditado**; o TSE não publica série histórica | Gráfico "Ao longo da apuração" e horários de eventos no modo oficial, sempre identificados | `dados/publicado/oficial/historico.json`, `eventos.json` |
| Classificação ideológica dos partidos | Bolognesi, Ribeiro, Codato e Silva (Opinião Pública, 2025), escala transcrita do cliente de referência; Centrão: PP, União, PSD, Republicanos, MDB | Barra esquerda/Centrão/direita, com a explicação | `src/data/partidos.ts` |

Verificação: `dados/publicado/oficial/verificacao.json` compara o snapshot da referência com o
TSE — 83/83 abrangências (presidente BR, 27 UFs e exterior; governador e senado nas 27 UFs)
idênticas em votos, seções, comparecimento, brancos, nulos e situação.

## Geografia

| Asset | Origem | Arquivo |
|---|---|---|
| Municípios (5.571) e UFs | IBGE, API de malhas v3 (`servicodados.ibge.gov.br/api/v3/malhas`, qualidade mínima); MT pela malha municipal 2025 (`geoftp.ibge.gov.br`, inclui Boa Esperança do Norte, 5101837); correspondência TSE/IBGE do TSE Dados Abertos (CC BY). Insumos preparados fora do repositório (`../assets-pesquisa/`), ver [INTEGRACAO.md](INTEGRACAO.md) | `public/geo/brasil-v1.json` (TopoJSON projetado, fronteiras compartilhadas) |
| Nomes oficiais dos municípios | IBGE, API de localidades | `dados-brutos/ibge/municipios.json` |
| Países | Natural Earth 1:50m admin-0 (domínio público), com `NAME_PT` e ISO | `public/geo/mundo-v1.json` |
| Cidades do exterior (186) | Cadastro TSE + coordenadas Natural Earth 1:10m populated places; 8 localidades de fronteira com coordenadas manuais (`MANUAIS` em `scripts/geo/construir-geografia.mjs`) | idem |
| Fusos das cidades do exterior | `geo-tz` (timezone-boundary-builder). 185/186 iguais à referência; Trípoli diverge (referência usa Africa/Tunis, a Líbia usa Africa/Tripoli) | idem |
| Áreas **aproximadas** de zonas eleitorais | Não há limite oficial. TSE Dados Abertos, eleitorado por local de votação 2026: só UF, município, zona, local, coordenadas e eleitores são lidos (telefone e endereço, não). Voronoi dos locais unido por zona e recortado pelo município, 189 municípios; identificado como aproximação no mapa e no card | `public/geo/zonas/{codigoTSE}.json` |

## Tipografia e identidade

| Asset | Origem | Licença |
|---|---|---|
| Faustina 300–400 | `@fontsource/faustina` (Google Fonts) | SIL OFL 1.1 |
| Geist 400–600 | `@fontsource/geist` (Vercel/Google Fonts) | SIL OFL 1.1 |
| Paleta | Amostrada das imagens de referência 1 (Statista) e 2 (BBC) fornecidas pelo responsável | — |
| Marca, autoria, redes, campanhas | **Configuráveis** em `config/marca.json`; padrões neutros de demonstração. Não reproduzimos Pandora, G4 Valley ou contas pessoais da referência | — |

## Pendências de assets

- Arte publicitária real e destinos: depende do responsável (o card usa campanha de demonstração identificada).
- Nomes de zona e bandeiras das UFs: sem fonte adequada no projeto (ver [DIFERENCAS.md](DIFERENCAS.md)).
- Imagem social (`og:image`): não criada.
- Gênero das candidaturas para "eleito/eleita": a única fonte do TSE (consulta_cand) traz CPF; por regra da organização não é usada. Rótulos neutros.
