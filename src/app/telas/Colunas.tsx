import { useEstado } from '../store';
import { CardNacional } from '../../features/presidente/CardNacional';
import { CardEvolucao } from '../../features/presidente/CardEvolucao';
import { CardRegioes } from '../../features/presidente/CardRegioes';
import { CardAtualizacoes } from '../../features/atualizacoes/CardAtualizacoes';
import { CardGovernadores } from '../../features/governadores/CardGovernadores';
import { CardSenado } from '../../features/senado/CardSenado';
import { CardDeputados } from '../../features/deputados/CardDeputados';
import { CardUf } from '../../features/geografia/CardUf';
import { CardMunicipio } from '../../features/geografia/CardMunicipio';
import { CardPerfil } from '../../features/perfil/CardPerfil';
import { CardExterior } from '../../features/exterior/CardExterior';
import { CardDeputadosUf } from '../../features/deputados/CardDeputadosUf';
import type { Layout } from '../layout';

export function ColunaEsquerda({ layout }: { layout: Layout }) {
  const cargo = useEstado((s) => s.nav.cargo);
  if (cargo === 'governadores') return <CardGovernadores />;
  if (cargo === 'senado') return <CardSenado />;
  if (cargo === 'deputados') return <CardDeputados />;
  return (
    <>
      <CardNacional />
      {layout.altura !== 'baixa' && <CardEvolucao />}
    </>
  );
}

export function ColunaDireita() {
  const nav = useEstado((s) => s.nav);
  const perfil = useEstado((s) => s.perfil);
  if (perfil) return <CardPerfil key={`${perfil.cargo}-${perfil.uf}-${perfil.n}-${perfil.sq ?? ''}`} />;
  if (nav.zz) return <CardExterior />;
  if (nav.cargo === 'deputados' && nav.uf) return <CardDeputadosUf />;
  if (nav.mun) return <CardMunicipio key={nav.mun} />;
  if (nav.uf) return <CardUf key={nav.uf} />;
  if (nav.cargo === 'presidente') return (<><CardRegioes /><CardAtualizacoes /></>);
  return <CardAtualizacoes />;
}
