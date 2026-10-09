import { Busca } from '../features/busca/Busca';
import { ListaCompleta } from '../features/listas/ListaCompleta';
import { Formulario } from '../features/comercial/Formulario';
import { ModalCampanha } from '../features/comercial/ModalCampanha';
import { Metodologia } from '../features/fonte/Metodologia';
import { Avisos } from '../components/Avisos';
import { SeloModo } from './SeloModo';
import type { Variante } from './layout';

export function Sobreposicoes({ variante }: { variante: Variante }) {
  return (
    <>
      <Busca />
      <ListaCompleta />
      <Formulario />
      <ModalCampanha />
      <Metodologia />
      <Avisos />
      {(variante === 'desktop' || variante === 'tv') && <SeloModo variante={variante} />}
    </>
  );
}
