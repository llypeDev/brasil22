# Apuração 2026

Painel de apuração das eleições gerais de 4 de outubro de 2026 (1º turno): mapa municipal do
Brasil, presidente, governadores, Senado, deputados federais, estaduais e distritais, zonas
eleitorais, votos no exterior, linha do tempo e modo TV.

Entre os turnos, o endereço principal abre a **página do 2º turno** (25 de outubro): a disputa de
presidente e as 7 de governador, com o resultado final do 1º turno como referência, e o seletor
**1º turno | 2º turno** no topo leva ao painel completo do 1º turno.

Implementação própria em React 19 + TypeScript + Vite, com servidor Node sem dependências de
execução (feeds, simulação, presença, pedidos e proxy de fotos). Os arquivos públicos de
divulgação do TSE são coletados, validados e normalizados num feed próprio; a interface não
consulta o TSE diretamente nem a infraestrutura de terceiros.

**O que esta entrega é:** aplicação funcional com os **dados oficiais finais do TSE** do 1º turno
(83 de 83 abrangências idênticas ao snapshot publicado pela referência) e uma **simulação determinística,
sempre rotulada**, para acompanhar uma apuração em andamento. **O que não é:** um serviço oficial
ao vivo — o coletor ao vivo existe e publica de forma atômica, mas não foi exercido durante uma
divulgação real. Detalhes em [docs/DIFERENCAS.md](docs/DIFERENCAS.md).

## Início rápido

Requisito: Node.js 22.13 ou mais novo (usa `node:sqlite`).

```bash
npm install
```

```bash
npm run dev
```

Abra <http://127.0.0.1:5180>. O servidor de desenvolvimento já monta os feeds e as APIs próprias
(`/feed/*`, `/api/*`) com os dados versionados em `dados/publicado/oficial/` — não é preciso
baixar nada para usar o painel.

### Modos de dados (parâmetros da URL)

| URL | Fonte | Uso |
|---|---|---|
| `/` | Oficial: TSE normalizado (`dados/publicado/oficial/`) | padrão |
| `/?fonte=simulacao` | Simulação no servidor, calibrada para terminar igual ao oficial; relógio de 16h52 a 03h30, 10× mais rápido | ver a apuração andando, linha do tempo, roteiro da TV |
| `/?cenario=aguardando` · `vazio` · `falha` · `instavel` · `lento` | Cenários de teste | carregamento, ausência de dados, queda e lentidão |
| `?semAnuncio` (combinável) | — | não abre o modal de campanha (testes e capturas) |

O modo em uso fica sempre identificado no selo do canto da tela, que abre a metodologia.

### Endereços (fragmento da URL)

`#presidente`, `#governadores-rj`, `#senado-rn`, `#deputados-df`, `#presidente-mg-3106200`
(município, código IBGE), `#presidente-mg-3106200-z26` (zona), `#presidente-zz-pt` (país),
`#presidente-zz-29955` (cidade do exterior, código TSE). Sufixos: `~e` estados, `~v` vantagem,
`~a` apurado, `~c13` mapa de uma candidatura, `~t1800` instante passado (18h00), `~tv` modo TV.
Todas essas rotas são do 1º turno. `#2turno` é a página do 2º turno, que também abre quando o
endereço não tem fragmento (só com os dados oficiais; simulação e cenários abrem no 1º turno).
Fragmentos inválidos voltam ao estado válido mais próximo.

Atalhos: `Ctrl/Cmd+K` ou `/` busca · `1`–`4` cargo · `+` `−` `0` zoom · `Esc` fecha a camada de
cima e, sem nenhuma aberta, volta um nível.

## Produção

```bash
npm run build
```

```bash
npm start
```

Serve `dist/`, a geografia, os feeds e as APIs em <http://127.0.0.1:8080> (`PORT`, `HOST`), com
compressão brotli/gzip, ETag, cache imutável para arquivos com hash e cabeçalhos de segurança
(CSP restrita a `'self'`, `frame-ancestors 'none'`, `nosniff`, COOP). `npm start` lê `.env` se
existir; as variáveis estão em [.env.example](.env.example). Atrás de proxy reverso, use
`CONFIAR_PROXY=1` para os limites por IP verem o cliente real. O controle do relógio da simulação
(`/api/simulacao/relogio`) é recusado em produção.

## Verificação

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run test:e2e
```

`npm test` roda os testes unitários (Vitest: fragmento da URL, cálculos, contratos do TSE,
simulação, resumo do 2º turno). `npm run test:e2e` roda as jornadas T01–T16 e os contratos da API no Playwright: sobe
o servidor de desenvolvimento na porta 5190 com banco de pedidos temporário. O navegador vem de
`npx playwright install chromium`; alternativas: `E2E_CANAL=chrome` (Chrome instalado) ou
`E2E_CHROMIUM=/caminho/do/executavel`. `E2E_BASE=https://...` aponta outro servidor.

## Dados

Tudo o que a interface mostra sai de `dados/publicado/oficial/` (oficial) ou da simulação, que é
gerada no servidor a partir desse mesmo diretório. Para reconstruir a partir das fontes:

```bash
npm run dados:tse:coletar -- --cargos=1,3,5 --zonas
```

```bash
npm run dados:tse:coletar -- --cargos=6,7,8
```

```bash
npm run dados:tse:normalizar
```

Os demais insumos (geografia IBGE, 2022, Senado, locais de votação) e a coleta durante uma
divulgação estão em [docs/INTEGRACAO.md](docs/INTEGRACAO.md). Fontes e licenças em
[docs/ASSETS.md](docs/ASSETS.md).

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `src/app` | estado (zustand), URL e histórico, layout por variante (desktop, TV, tablet, celular vertical e horizontal), atalhos |
| `src/map` | motor de mapa em Canvas 2D (Path2D, câmera, teste de clique, zoom/arraste/pinça), rótulos e chamadas em DOM |
| `src/features` | cards de cada vista: presidente, governadores, Senado, deputados, UF, município, zona, exterior, perfil, busca, linha do tempo, TV, comercial, página do 2º turno |
| `src/data` | contratos do feed, cálculos, validação, provedor com cache e consulta ao vivo |
| `server` | servidor próprio: feeds oficial/simulação/cenários, presença, pedidos (SQLite), fotos |
| `scripts` | coleta e normalização do TSE, geografia, zonas aproximadas, 2022, Senado, coletor ao vivo, capturas |
| `config/marca.json` | título, autoria, redes, faixas e campanhas (padrões neutros de demonstração) |
| `tests` | unitários (`tests/unit`) e ponta a ponta (`tests/e2e`) |
| `docs` | checklist R01–R24/T01–T15, integração, diferenças restantes, assets, continuidade |

## Privacidade

- Pedidos de acesso e de anúncio ficam apenas no SQLite local (`dados/privado/`, fora do
  versionamento), com validação no servidor, campo antispam, limite por IP e por e-mail e
  retenção configurável (180 dias por padrão). Nada é enviado a terceiros.
- Presença: identificador efêmero gerado na aba, contado só em memória; sem cookies.
- Não usamos o cadastro de candidaturas do TSE que contém CPF; do cadastro de locais de votação
  só são lidas coordenadas e contagens de eleitores (sem telefones ou endereços); da API do Senado,
  só nome, partido, UF e fim do mandato.
