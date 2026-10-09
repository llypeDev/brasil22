// Estado de navegação serializado no fragmento da URL.
//
//   #presidente                     Brasil
//   #presidente-mg                  UF
//   #presidente-mg-3106200          município (código IBGE)
//   #presidente-mg-3106200-z26      zona eleitoral
//   #presidente-zz                  exterior
//   #presidente-zz-pt               país (ISO 3166-1 alfa-2)
//   #presidente-zz-29955            cidade do exterior (código TSE)
//   sufixos: ~e estados · ~v vantagem · ~a apurado · ~c13 candidato · ~tv modo TV · ~t2055 instante
//   #2turno                         página do 2º turno (as rotas acima são todas do 1º turno)
//
// Perfis, listas e modais são estados temporários e não entram no fragmento.

export type Cargo = 'presidente' | 'governadores' | 'senado' | 'deputados';
export type Camada = 'mun' | 'uf' | 'votes' | 'apur' | 'cand';
export type Turno = 1 | 2;

export interface EstadoUrl {
  /** 1 = painel do 1º turno (mapa, cargos, lugares); 2 = página do 2º turno */
  turno: Turno;
  cargo: Cargo;
  uf: string | null;
  mun: string | null;
  zona: string | null;
  zz: boolean;
  pais: string | null;
  cidade: string | null;
  camada: Camada;
  cand: string | null;
  tv: boolean;
  /** minutos desde 00:00 do dia da eleição; null = ao vivo */
  t: number | null;
}

export const ESTADO_INICIAL: EstadoUrl = { turno: 1, cargo: 'presidente', uf: null, mun: null, zona: null, zz: false, pais: null, cidade: null, camada: 'mun', cand: null, tv: false, t: null };

export const CARGOS: Cargo[] = ['presidente', 'governadores', 'senado', 'deputados'];

export interface Validadores {
  ufExiste?: (uf: string) => boolean;
  municipioDaUf?: (uf: string, ibge: string) => boolean;
  zonaExiste?: (ibge: string, zona: string) => boolean;
  paisExiste?: (iso: string) => boolean;
  cidadeExiste?: (tse: string) => boolean;
  candidatoExiste?: (cargo: Cargo, uf: string | null, numero: string) => boolean;
}

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SE SP TO'.split(' '));

const SEGUNDO_TURNO = new Set(['2turno', '2t', 'segundo-turno']);

/** `turnoPadrao` vale só para o fragmento vazio; qualquer rota com cargo é do 1º turno. */
export function parseHash(hash: string, v: Validadores = {}, turnoPadrao: Turno = 1): EstadoUrl {
  const bruto = decodeURIComponent(hash.replace(/^#/, '')).trim().toLowerCase();
  const e: EstadoUrl = { ...ESTADO_INICIAL };
  if (!bruto) return { ...e, turno: turnoPadrao };
  if (SEGUNDO_TURNO.has(bruto)) return { ...e, turno: 2 };
  const [caminho, ...sufixos] = bruto.split('~');
  const partes = caminho.split('-').filter(Boolean);
  const cargo = partes.shift();
  if (cargo && (CARGOS as string[]).includes(cargo)) e.cargo = cargo as Cargo;
  else if (cargo === 'governador') e.cargo = 'governadores';
  else if (cargo === 'deputado') e.cargo = 'deputados';

  const escopo = partes.shift();
  if (escopo === 'zz') {
    if (e.cargo === 'presidente') {
      e.zz = true;
      const alvo = partes.shift();
      if (alvo && /^\d{5}$/.test(alvo) && (v.cidadeExiste?.(alvo) ?? true)) e.cidade = alvo;
      else if (alvo && /^[a-z]{2}$/.test(alvo) && (v.paisExiste?.(alvo.toUpperCase()) ?? true)) e.pais = alvo.toUpperCase();
    }
  } else if (escopo && /^[a-z]{2}$/.test(escopo) && UFS.has(escopo.toUpperCase()) && (v.ufExiste?.(escopo.toUpperCase()) ?? true)) {
    e.uf = escopo.toUpperCase();
    const mun = partes.shift();
    if (mun && /^\d{7}$/.test(mun) && (v.municipioDaUf?.(e.uf, mun) ?? true)) {
      e.mun = mun;
      const z = partes.shift();
      const m = z ? /^z(\d{1,4})$/.exec(z) : null;
      if (m) {
        const zona = String(Number(m[1]));
        if (v.zonaExiste?.(mun, zona) ?? true) e.zona = zona;
      }
    }
  }

  for (const s of sufixos) {
    if (s === 'e') e.camada = 'uf';
    else if (s === 'v') e.camada = 'votes';
    else if (s === 'a') e.camada = 'apur';
    else if (s === 'tv') e.tv = true;
    else if (/^c\d{1,5}$/.test(s)) {
      const n = s.slice(1);
      if (v.candidatoExiste?.(e.cargo, e.uf, n) ?? true) { e.camada = 'cand'; e.cand = n; }
    } else if (/^t\d{3,4}$/.test(s)) {
      const hhmm = s.slice(1).padStart(4, '0');
      const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2));
      if (Number(hhmm.slice(2)) < 60) e.t = t;
    }
  }
  // Camadas municipais não existem para o Senado/deputados no Brasil; o exterior só tem presidente.
  if (e.zz && e.camada === 'uf') e.camada = 'mun';
  return e;
}

export function serializeHash(e: EstadoUrl): string {
  if (e.turno === 2) return '#2turno';
  let s = e.cargo;
  if (e.zz && e.cargo === 'presidente') {
    s += '-zz';
    if (e.cidade) s += `-${e.cidade}`;
    else if (e.pais) s += `-${e.pais.toLowerCase()}`;
  } else if (e.uf) {
    s += `-${e.uf.toLowerCase()}`;
    if (e.mun) {
      s += `-${e.mun}`;
      if (e.zona) s += `-z${Number(e.zona)}`;
    }
  }
  if (e.camada === 'uf') s += '~e';
  else if (e.camada === 'votes') s += '~v';
  else if (e.camada === 'apur') s += '~a';
  else if (e.camada === 'cand' && e.cand) s += `~c${e.cand}`;
  if (e.t != null) s += `~t${String(Math.floor(e.t / 60)).padStart(2, '0')}${String(e.t % 60).padStart(2, '0')}`;
  if (e.tv) s += '~tv';
  return `#${s}`;
}

export const mesmoEstado = (a: EstadoUrl, b: EstadoUrl) => serializeHash(a) === serializeHash(b);
