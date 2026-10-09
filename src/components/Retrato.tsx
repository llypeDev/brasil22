// Retrato oficial (TSE) servido pelo proxy próprio; sem foto, iniciais na cor do partido.

import { memo, useState } from 'react';
import { partido } from '../data/partidos';
import { iniciais } from '../data/formato';

export type CargoFoto = 'presidente' | 'governador' | 'senador' | 'deputado';

export function urlFoto(cargo: CargoFoto, uf: string | null, sq: string | undefined) {
  if (!sq || !/^\d{8,14}$/.test(sq)) return null;
  const ele = cargo === 'presidente' ? '6257' : '6259';
  const local = cargo === 'presidente' ? 'br' : (uf ?? '').toLowerCase();
  if (!/^[a-z]{2}$/.test(local)) return null;
  return `/feed/fotos/${ele}/${local}/${sq}.jpeg`;
}

interface Props {
  nome: string;
  sigla: string;
  sq?: string;
  cargo: CargoFoto;
  uf?: string | null;
  tamanho?: number;
  forma?: 'quadrado' | 'circulo';
  borda?: boolean;
  className?: string;
}

export const Retrato = memo(function Retrato({ nome, sigla, sq, cargo, uf = null, tamanho = 32, forma = 'circulo', borda = false, className = '' }: Props) {
  const url = urlFoto(cargo, uf, sq);
  const [falhou, setFalhou] = useState(false);
  const p = partido(sigla);
  const estilo = { width: tamanho, height: tamanho, '--cor-partido': p.cor, '--cor-claro': p.claro } as React.CSSProperties;
  const classe = `retrato ${forma} ${borda ? 'com-borda' : ''} ${className}`;
  if (!url || falhou) {
    return (
      <span className={`${classe} sem-foto`} style={{ ...estilo, fontSize: Math.max(9, tamanho * 0.36) }} aria-hidden="true">
        {iniciais(nome)}
      </span>
    );
  }
  return (
    <span className={classe} style={estilo} aria-hidden="true">
      <img src={url} alt="" width={tamanho} height={tamanho} loading="lazy" decoding="async" onError={() => setFalhou(true)} />
    </span>
  );
});
