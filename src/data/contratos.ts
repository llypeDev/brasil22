// Contratos do feed publicado pelo servidor próprio (dados/publicado/* e simulação).
// A interface consome somente estes tipos; formatos do TSE ficam nos adaptadores do servidor.

export type Modo = 'oficial' | 'simulacao' | 'cenario-aguardando' | 'cenario-vazio' | 'cenario-falha' | 'cenario-instavel' | 'cenario-lento';

export type SituacaoDisputa = 'aguardando' | 'apurando' | 'segundo-turno' | 'eleito' | 'eleitos' | 'parcial' | 'concluida';
export type SituacaoCandidatura = 'eleito' | 'eleito-qp' | 'eleito-media' | 'segundo-turno' | 'suplente' | 'nao-eleito' | 'apurando' | 'aguardando' | string;

/** Resultado de uma abrangência para um cargo. Contagens inteiras. */
export interface Resultado {
  secoes: number;
  totalizadas: number;
  eleitorado: number;
  eleitoradoApurado: number;
  comparecimento: number;
  abstencao: number;
  brancos: number;
  nulos: number;
  /** votos válidos (exclui anulados sub judice) */
  validos: number;
  anuladosSJ: number;
  votos: Record<string, number>;
  anulados: Record<string, number>;
  situacao: SituacaoDisputa;
  situacoes: Record<string, SituacaoCandidatura>;
  totalizadoEm?: string | null;
  geradoEm?: string | null;
  /** minutos desde 00:00 do dia da eleição em que a disputa foi definida */
  definido?: number;
  vagas?: number;
}

export interface Agora {
  versao: 1;
  seq: number;
  /** minutos desde 00:00 de 04/10/2026 (horário de Brasília); pode passar de 1.440 */
  t: number;
  turno: number;
  modo?: string;
  aviso?: string;
  geradoNaFonte?: string;
  presidente: { br: Resultado; uf: Record<string, Resultado>; zz: Resultado; regioes: Record<string, Resultado> };
  governador: { uf: Record<string, Resultado> };
  senador: { uf: Record<string, Resultado> };
}

export interface Candidato {
  n: string;
  sq: string;
  nome: string;
  nomeUrna: string;
  nomeCompleto: string;
  partido: string;
  situacao: SituacaoCandidatura;
  situacaoTse: string;
  destino: 'valido' | 'anulado';
  vice?: string | null;
  suplentes?: string[];
}

export interface Catalogo {
  versao: 1;
  presidente: Candidato[];
  governador: Record<string, Candidato[]>;
  senador: Record<string, Candidato[]>;
  partidos: Record<string, { sigla: string; numero: string; federacao: string | null; nome: string }>;
}

/** Coleção colunar alinhada por código explícito (tse). */
export interface Colunar {
  candidatos: string[];
  tse: string[];
  secoes: (number | null)[];
  totalizadas: (number | null)[];
  eleitorado: (number | null)[];
  comparecimento: (number | null)[];
  brancos: (number | null)[];
  nulos: (number | null)[];
  validos: (number | null)[];
  anuladosSJ: (number | null)[];
  votos: (number | null)[][];
}

export interface MunicipiosPresidente extends Colunar { versao: 1; cargo: 'presidente'; modo?: string; t?: number }
export interface UfMunicipal { versao: 1; uf: string; governador: Colunar; senador: Colunar }
export interface Exterior { versao: 1; cidades: Colunar; paises: Record<string, Omit<Resultado, 'situacao' | 'situacoes' | 'anulados' | 'eleitoradoApurado' | 'abstencao'>> }
export interface Zonas extends Colunar { versao: 1; municipio: string; uf: string; cargo: 'presidente' }

export interface Manifesto {
  versao: 1;
  modo: string;
  origem: string;
  eleicao: { ano: number; turno: number; data: string; segundoTurno: string; eleicoes: Record<string, string> };
  seq: number;
  t: number;
  geradoNaFonte?: string;
  publicadoEm?: string;
  recarregarSegundos: number;
  municipiosComZonas: string[];
  /** número das zonas de cada município com mais de uma zona (código TSE) */
  zonasPorMunicipio?: Record<string, number[]>;
  contagens?: Record<string, number>;
  avisos?: string[];
  aviso?: string;
  calibracao?: unknown;
  relogio?: { inicio: number; abertura: number; fim: number; ciclo: number; velocidade: number; fixo: number | null };
}

export type TipoEvento = 'secoes' | 'virada' | 'definicao' | 'fim';
export interface Evento {
  id: string;
  tipo: TipoEvento;
  t: number;
  cargo: 'presidente' | 'governador' | 'senador';
  uf: string;
  secoes?: number;
  totalizadas?: number;
  totalSecoes?: number;
  /** votos válidos no instante (denominador das parcelas) */
  validos?: number;
  votos?: Record<string, number>;
  situacao?: SituacaoDisputa;
  candidatos?: string[];
  origemHorario?: 'referencia' | 'tse-totalizacao';
}

export interface PontoHistorico { t: number; totalizadas: number; secoes: number; votos: Record<string, number>; situacao: string }
export interface Historico { versao: 1; origem: 'referencia' | 'simulacao' | 'indisponivel' | string; descricao?: string; ultimoPontoConfereComTse?: boolean; pontos: PontoHistorico[] }
export interface IndiceArquivo { versao: 1; origem: string; descricao?: string; snapshots: number[]; agregados: number[] }

/** [numero, nome, partido, votos, situacao, sq, valido(1/0)] */
export type CandidaturaLegislativa = [string, string, string, number, SituacaoCandidatura, string, number];
export interface CasaLegislativa {
  cargo: number;
  vagas: number;
  eleitos: number;
  situacao: SituacaoDisputa;
  totais: Record<string, number>;
  totalizadoEm?: string | null;
  agremiacoes: { n: string; nome: string; tipo: string; composicao: string; vagas: number | null }[];
  partidos: Record<string, { n: string; agremiacao: string; nominais: number; legenda: number; validos: number; cadeiras: number }>;
  candidatos: CandidaturaLegislativa[];
}
export interface DeputadosUf { versao: 1; uf: string; federal?: CasaLegislativa; estadual?: CasaLegislativa; distrital?: CasaLegislativa }
/** [numero, nome, partido, uf, casa, votos, situacao, sq] */
export type RankingLegislativo = [string, string, string, string, 'f' | 'e' | 'd', number, SituacaoCandidatura, string];
export interface CasaNaUf { vagas: number; eleitos: number; situacao: SituacaoDisputa; cadeiras: Record<string, number>; votos: Record<string, number>; totalizadas: number; secoes: number }
export interface DeputadosBr {
  versao: 1;
  federal: { vagas: number; eleitos: number; partidos: Record<string, number>; ranking: RankingLegislativo[]; totalCandidatos: number };
  estadual: { vagas: number; eleitos: number; partidos: Record<string, number>; ranking: RankingLegislativo[]; totalCandidatos: number };
  porUf: Record<string, { federal?: CasaNaUf; estadual?: CasaNaUf }>;
}
/** [numero, nome, partido, uf, casa, votos, eleito(1/0), sq] */
export type ItemBuscaLegislativa = [string, string, string, string, 'f' | 'e' | 'd', number, number, string];
export interface BuscaDeputados { versao: 1; itens: ItemBuscaLegislativa[] }

export interface Presidente2022 {
  versao: 1;
  fonte: string;
  candidatos: Record<string, { nome: string; partido: string }>;
  brasil: { validos: number; votos: Record<string, number> };
  ufs: Record<string, { validos: number; votos: Record<string, number> }>;
  regioes: Record<string, { validos: number; votos: Record<string, number> }>;
  municipios: { tse: string[]; uf: string[]; validos: number[]; v13: number[]; v22: number[] };
}

export interface SenadoMantidas { versao: 1; fonte: string; consultadoEm: string; cadeiras: { uf: string; nome: string; partido: string; mandatoAte: string }[] }
