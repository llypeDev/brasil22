// Catálogo partidário do painel.
//
// Paleta do painel: PL em verde e PT em amarelo, inspirados na bandeira do Brasil.
// As cores são convenções visuais do painel, não cores oficiais das legendas.
// `texto` usa uma variante escura para manter a leitura sobre os cards claros.
// Os demais partidos mantêm cores distintas para as vistas com várias legendas.
// `claro` é a mistura com branco usada para "apurando"/vantagem pequena; `escuro`, a
// variante para vantagem muito grande.
//
// Escala ideológica (0 = esquerda, 10 = direita): Bolognesi, Ribeiro, Codato e Silva,
// "Opinião Pública", 2025 — valores transcritos do cliente de referência. Partidos sem
// valor (ex.: Missão, criado depois) ficam sem classificação. Limiar esquerda/direita: 5
// (o estudo registra centro vazio desde 2022). Centrão: PP, União, PSD, Republicanos e MDB,
// agregado jornalístico mantido à parte do eixo esquerda/direita.

export interface Partido {
  n: string;
  sg: string;
  nome: string;
  federacao: string | null;
  cor: string;
  texto: string;
  claro: string;
  escuro: string;
}

export const PARTIDOS: Record<string, Partido> = {
  "REPUBLICANOS": { n: "10", sg: "Republicanos", nome: "Republicanos", federacao: null, cor: "#4181AD", texto: "#3878A3", claro: "#AAC6DA", escuro: "#1A5E88" },
  "PP": { n: "11", sg: "PP", nome: "Progressistas", federacao: "UNIÃO PROGRESSISTA", cor: "#6FC6DE", texto: "#1E7E95", claro: "#BEE5F0", escuro: "#47A0B7" },
  "PDT": { n: "12", sg: "PDT", nome: "Partido Democrático Trabalhista", federacao: null, cor: "#DC4C92", texto: "#CA3B83", claro: "#EFAECE", escuro: "#B2206E" },
  "PT": { n: "13", sg: "PT", nome: "Partido dos Trabalhadores", federacao: "FE BRASIL", cor: "#F2C500", texto: "#7A5D00", claro: "#FAE99A", escuro: "#B18B00" },
  "MISSÃO": { n: "14", sg: "Missão", nome: "Partido Missão", federacao: null, cor: "#CEA608", texto: "#956E00", claro: "#E9D790", escuro: "#A88100" },
  "MDB": { n: "15", sg: "MDB", nome: "Movimento Democrático Brasileiro", federacao: null, cor: "#01813A", texto: "#01813A", claro: "#8DC6A6", escuro: "#005D16" },
  "PSTU": { n: "16", sg: "PSTU", nome: "Partido Socialista dos Trabalhadores Unificado", federacao: null, cor: "#F38C8E", texto: "#B55559", claro: "#FACBCC", escuro: "#CA676A" },
  "REDE": { n: "18", sg: "Rede", nome: "Rede Sustentabilidade", federacao: "PSOL REDE", cor: "#3FC3AE", texto: "#008472", claro: "#A9E4DB", escuro: "#009D89" },
  "PODE": { n: "20", sg: "Podemos", nome: "Podemos", federacao: null, cor: "#AB6BD6", texto: "#9859C2", claro: "#D9BCED", escuro: "#8646AE" },
  "PCB": { n: "21", sg: "PCB", nome: "Partido Comunista Brasileiro", federacao: null, cor: "#B7535D", texto: "#B7535D", claro: "#DFB2B6", escuro: "#8F2F3C" },
  "PL": { n: "22", sg: "PL", nome: "Partido Liberal", federacao: null, cor: "#008C45", texto: "#006B34", claro: "#A3D8B5", escuro: "#005C2D" },
  "CIDADANIA": { n: "23", sg: "Cidadania", nome: "Cidadania", federacao: "PSDB CIDADANIA", cor: "#F0289B", texto: "#DE008C", claro: "#F89ED2", escuro: "#C40077" },
  "PRD": { n: "25", sg: "PRD", nome: "Partido Renovação Democrática", federacao: "RENOVAÇÃO SOLIDÁRIA", cor: "#14938D", texto: "#00817B", claro: "#95CECC", escuro: "#006F6A" },
  "DC": { n: "27", sg: "DC", nome: "Democracia Cristã", federacao: null, cor: "#BC8C30", texto: "#996B00", claro: "#E1CBA2", escuro: "#966800" },
  "PRTB": { n: "28", sg: "PRTB", nome: "Partido Renovador Trabalhista Brasileiro", federacao: null, cor: "#28A650", texto: "#008732", claro: "#9ED7B0", escuro: "#00812C" },
  "PCO": { n: "29", sg: "PCO", nome: "Partido da Causa Operária", federacao: null, cor: "#DE6F6A", texto: "#BC504D", claro: "#F0BEBC", escuro: "#B54A48" },
  "NOVO": { n: "30", sg: "Novo", nome: "Partido Novo", federacao: null, cor: "#F87025", texto: "#CA4500", claro: "#FCBF9D", escuro: "#CE4900" },
  "MOBILIZA": { n: "33", sg: "Mobiliza", nome: "Mobilização Nacional", federacao: null, cor: "#B24D8B", texto: "#B24D8B", claro: "#DCAFCB", escuro: "#8A2868" },
  "DEMOCRATA": { n: "35", sg: "Democrata", nome: "Democrata", federacao: null, cor: "#75C9A1", texto: "#29815D", claro: "#C1E7D5", escuro: "#4EA37D" },
  "AGIR": { n: "36", sg: "Agir", nome: "Agir", federacao: null, cor: "#A2A5E0", texto: "#6D6EA6", claro: "#D5D7F1", escuro: "#7E80B9" },
  "PSB": { n: "40", sg: "PSB", nome: "Partido Socialista Brasileiro", federacao: null, cor: "#E7B248", texto: "#9D6B00", claro: "#F4DCAD", escuro: "#C08C11" },
  "PV": { n: "43", sg: "PV", nome: "Partido Verde", federacao: "FE BRASIL", cor: "#719259", texto: "#5D7D45", claro: "#BFCEB4", escuro: "#4F6E37" },
  "UNIÃO": { n: "44", sg: "União", nome: "União Brasil", federacao: "UNIÃO PROGRESSISTA", cor: "#26C4FF", texto: "#007BB2", claro: "#9DE4FF", escuro: "#009DD6" },
  "PSDB": { n: "45", sg: "PSDB", nome: "Partido da Social Democracia Brasileira", federacao: "PSDB CIDADANIA", cor: "#3994FF", texto: "#0D74DC", claro: "#A6CFFF", escuro: "#006ED6" },
  "PSOL": { n: "50", sg: "PSOL", nome: "Partido Socialismo e Liberdade", federacao: "PSOL REDE", cor: "#C6BF00", texto: "#807700", claro: "#E5E28C", escuro: "#A19900" },
  "PSD": { n: "55", sg: "PSD", nome: "Partido Social Democrático", federacao: null, cor: "#84C65C", texto: "#45840E", claro: "#C8E5B6", escuro: "#60A034" },
  "PCDOB": { n: "65", sg: "PCdoB", nome: "Partido Comunista do Brasil", federacao: "FE BRASIL", cor: "#CE3E57", texto: "#CE3E57", claro: "#E9A8B3", escuro: "#A40836" },
  "AVANTE": { n: "70", sg: "Avante", nome: "Avante", federacao: null, cor: "#04A9B7", texto: "#00818F", claro: "#8ED8DF", escuro: "#008492" },
  "SOLIDARIEDADE": { n: "77", sg: "Solidariedade", nome: "Solidariedade", federacao: "RENOVAÇÃO SOLIDÁRIA", cor: "#F78C08", texto: "#BD5600", claro: "#FBCB90", escuro: "#CE6600" },
  "UP": { n: "80", sg: "UP", nome: "Unidade Popular", federacao: null, cor: "#B4B0AC", texto: "#777370", claro: "#DDDBDA", escuro: "#8F8B87" },
};

const SEM_PARTIDO: Partido = { n: '', sg: '—', nome: 'Sem partido', federacao: null, cor: '#A8A8A8', texto: '#666666', claro: '#D6D6D6', escuro: '#7A7A7A' };

/** Normaliza a sigla do TSE para a chave do catálogo. */
export function chavePartido(sigla: string | undefined | null): string {
  const s = String(sigla ?? '').toUpperCase().replace(/[\s.]/g, '');
  const sin: Record<string, string> = { PODEMOS: 'PODE', PROGRESSISTAS: 'PP', UNIAO: 'UNIÃO', MISSAO: 'MISSÃO', SD: 'SOLIDARIEDADE', PMN: 'MOBILIZA', PMB: 'DEMOCRATA', 'PCDOB': 'PCDOB' };
  return sin[s] ?? s;
}

export function partido(sigla: string | undefined | null): Partido {
  return PARTIDOS[chavePartido(sigla)] ?? { ...SEM_PARTIDO, sg: String(sigla ?? '—') };
}

/** Preto ou branco conforme a luminância do fundo: mantém contraste em chips e rótulos. */
export function textoSobreCor(cor: string): string {
  const hex = cor.replace('#', '');
  const completo = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const rgb = [0, 2, 4].map((i) => {
    const canal = parseInt(completo.slice(i, i + 2), 16) / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  const luminancia = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return luminancia > 0.179 ? '#000000' : '#FFFFFF';
}

/** Sigla de exibição (ex.: "UNIÃO" → "União", "PODE" → "Podemos"). */
export const siglaExibicao = (sigla: string | undefined | null) => partido(sigla).sg;

export const ESCALA_IDEOLOGICA: Record<string, number> = {
  PSTU: 0.51, PCO: 0.55, PCB: 0.69, PSOL: 1.41, UP: 1.63, PCDOB: 1.78, PT: 2.68, PSB: 3.59, REDE: 3.69, PDT: 3.86, PV: 4.12,
  SOLIDARIEDADE: 6.01, CIDADANIA: 6.17, AVANTE: 6.47, MDB: 6.5, MOBILIZA: 6.74, PSDB: 6.76, PSD: 6.94, DEMOCRATA: 7.29, PODE: 7.44,
  PRTB: 7.49, AGIR: 7.55, PP: 8.15, PRD: 8.16, DC: 8.21, REPUBLICANOS: 8.33, 'UNIÃO': 8.49, NOVO: 8.67, PL: 8.8,
};
export const CENTRAO = new Set(['PP', 'UNIÃO', 'PSD', 'REPUBLICANOS', 'MDB']);
export const NOTA_IDEOLOGIA = 'Esquerda e direita: posição média de cada partido segundo cientistas políticos (Bolognesi, Ribeiro, Codato e Silva, Opinião Pública, 2025), cujo centro está vazio desde 2022. Centrão: PP, União Brasil, PSD, Republicanos e MDB, o núcleo que a imprensa chama assim.';

/** 'e' esquerda, 'c' Centrão, 'd' direita fora do Centrão, null sem classificação. */
export function bloco(sigla: string): 'e' | 'c' | 'd' | null {
  const k = chavePartido(sigla);
  if (CENTRAO.has(k)) return 'c';
  const v = ESCALA_IDEOLOGICA[k];
  if (v == null) return null;
  return v < 5 ? 'e' : 'd';
}

export const COR_NEUTRA = '#A8A8A8';
export const COR_SEM_DADOS = '#DCDCDA';
export const COR_CENTRAO = '#A3967D';
