// Barra dupla: candidatura da esquerda cresce a partir da esquerda, a da direita a partir da
// direita; o meio é o restante (demais candidaturas). Linha central = 50% dos válidos.

import { partido } from '../data/partidos';
import { pctS } from '../data/formato';

interface Props {
  esq: { nome: string; sigla: string; parcela: number | null } | null;
  dir: { nome: string; sigla: string; parcela: number | null } | null;
  rotulo?: string;
  altura?: number;
  marca50?: boolean;
}

export function BarraDupla({ esq, dir, rotulo, altura = 6, marca50 = true }: Props) {
  const a = Math.max(0, Math.min(1, esq?.parcela ?? 0));
  const b = Math.max(0, Math.min(1 - a, dir?.parcela ?? 0));
  const desc = rotulo ?? `${esq ? `${esq.nome} ${pctS(esq.parcela)}` : ''}${dir ? `, ${dir.nome} ${pctS(dir.parcela)}` : ''}; a linha do meio marca 50% dos votos válidos`;
  return (
    <div className="barra-dupla" role="img" aria-label={desc} style={{ height: altura }}>
      <i className="esq" style={{ width: `${a * 100}%`, background: esq ? partido(esq.sigla).cor : 'transparent' }} />
      <i className="meio" />
      <i className="dir" style={{ width: `${b * 100}%`, background: dir ? partido(dir.sigla).cor : 'transparent' }} />
      {marca50 && <em className="marca50" />}
    </div>
  );
}

/** Barra simples de participação (listas). */
export function BarraParcela({ parcela, sigla, altura = 3 }: { parcela: number | null; sigla: string; altura?: number }) {
  return (
    <span className="barra-parcela" style={{ height: altura }} aria-hidden="true">
      <i style={{ width: `${Math.max(0, Math.min(1, parcela ?? 0)) * 100}%`, background: partido(sigla).cor }} />
    </span>
  );
}
