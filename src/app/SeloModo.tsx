// Identificação permanente da origem dos dados (oficial, simulação ou cenário de teste) e
// avisos de conexão/validação.

import { useEstado } from './store';
import { horaDoLote } from '../components/Cabecalho';
import { IconeInfo } from '../components/Icones';
import { atualizarAgora } from '../data/vivo';
import type { Variante } from './layout';

export function SeloModo({ variante }: { variante: Variante }) {
  const segundo = useEstado((s) => s.nav.turno === 2 && s.modo === 'oficial');
  const modo = useEstado((s) => s.modo);
  const set = useEstado((s) => s.set);
  const conexao = useEstado((s) => s.conexao);
  const erro = useEstado((s) => s.erroConexao);
  const aviso = useEstado((s) => s.avisoDados);
  const agora = useEstado((s) => s.agoraVivo);
  const proxima = useEstado((s) => s.proximaTentativa);
  const ultimo = horaDoLote(agora, modo);
  const rotulo = modo === 'oficial' ? 'Dados oficiais · TSE' : modo === 'simulacao' ? 'Simulação · não são resultados oficiais' : `Cenário de teste: ${modo.replace('cenario-', '')}`;
  return (
    <div className={`selo-modo v-${variante} m-${modo.startsWith('cenario') ? 'cenario' : modo}`}>
      <button className="selo-modo-botao" onClick={() => set({ metodologia: true })} aria-label={`${rotulo}. Abrir fonte e metodologia`}>
        <IconeInfo width={13} height={13} /><span>{rotulo}</span>
      </button>
      {!segundo && (conexao === 'reconectando' || conexao === 'sem-conexao') && (
        <div className="alerta-conexao" role="alert">
          <b>{conexao === 'sem-conexao' ? 'Sem conexão com o servidor.' : 'Conexão instável.'}</b>
          <span>{ultimo ? ` Mantido o último dado válido (${ultimo}).` : ' Nenhum resultado exibido até a primeira resposta válida.'}{erro ? ` ${erro}` : ''}{proxima ? ` Nova tentativa em ${Math.max(1, Math.round((proxima - Date.now()) / 1000))} s.` : ''}</span>
          <button className="link" onClick={() => atualizarAgora()}>Tentar agora</button>
        </div>
      )}
      {!segundo && aviso && <div className="alerta-conexao aviso" role="status">{aviso}</div>}
    </div>
  );
}
