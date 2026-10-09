// Fonte e metodologia: origem e modo dos dados, regras de cálculo e limites conhecidos.

import { useEstado } from '../../app/store';
import { trocarModo } from '../../app/url';
import { Modal } from '../../components/Modal';
import { IconeFechar } from '../../components/Icones';
import { horaIso, num } from '../../data/formato';

export function Metodologia() {
  const aberta = useEstado((s) => s.metodologia);
  const set = useEstado((s) => s.set);
  const modo = useEstado((s) => s.modo);
  const m = useEstado((s) => s.manifesto);
  return (
    <Modal aberto={aberta} aoFechar={() => set({ metodologia: false })} rotulo="Fonte e metodologia" className="metodologia">
      <div className="lc-hd">
        <div><h2 className="serif">Fonte e metodologia</h2><p className="f3">O que o painel mostra e de onde vem cada número.</p></div>
        <button className="icone" onClick={() => set({ metodologia: false })} aria-label="Fechar"><IconeFechar /></button>
      </div>
      <div className="met-corpo">
        <div className="met-modo" role="group" aria-label="Fonte dos dados">
          <button aria-pressed={modo === 'oficial'} onClick={() => modo !== 'oficial' && trocarModo('oficial')}>
            <b>Oficial (TSE)</b><small>Arquivos públicos de divulgação, coletados e conferidos.</small>
          </button>
          <button aria-pressed={modo === 'simulacao'} onClick={() => modo !== 'simulacao' && trocarModo('simulacao')}>
            <b>Simulação</b><small>Reconstrução determinística da noite, a partir do resultado final. Não oficial.</small>
          </button>
        </div>
        {m && <p className="f3 tn">Origem: {m.origem}. {m.geradoNaFonte ? `Geração na fonte: ${horaIso(m.geradoNaFonte, true)}. ` : ''}{m.contagens ? `${num(m.contagens.municipios)} municípios, ${num(m.contagens.cidadesExterior)} cidades no exterior, ${num(m.contagens.zonas)} zonas, ${num(m.contagens.candidatosDeputados)} candidaturas a deputado.` : ''}</p>}
        <h3>Resultados</h3>
        <p>Os resultados do 1º turno de 4 de outubro de 2026 vêm dos arquivos públicos do TSE (resultados.tse.jus.br), por Brasil, UF, município, zona e cidade do exterior, para todos os cargos. Cada arquivo é validado (contagens inteiras, seções totalizadas ≤ total, soma municipal igual à da UF, UFs + exterior iguais ao Brasil) antes da publicação, que é atômica.</p>
        <p>Os números conferem com o painel de referência em 83 de 83 abrangências (presidente no Brasil, nas UFs e no exterior; governador e Senado nas 27 UFs).</p>
        <h3>Percentuais</h3>
        <p>Parcela = votos da candidatura ÷ votos válidos. Votos de candidaturas anuladas <i>sub judice</i> ficam fora do denominador e aparecem à parte — por isso alguns percentuais diferem dos publicados pelo TSE, que usa os válidos computados. A situação (eleito, 2º turno, eleito por QP/média, suplente) é sempre a oficial; o painel nunca a deduz de percentuais arredondados. Comparecimento e abstenção usam o eleitorado das seções já totalizadas; brancos e nulos, o comparecimento.</p>
        <h3>Ao longo da apuração</h3>
        <p>O TSE não publica série histórica. No modo oficial, a curva nacional de presidente e os horários de definição vêm do registro da referência (seuimposto.com) — não auditado, com o ponto final conferido com o TSE. Instantes anteriores ao final não têm mapa nem detalhes: o painel informa “sem registro” em vez de repetir o resultado atual.</p>
        <p>Na simulação, cada município totaliza numa janela calibrada pela curva nacional de seções; votos crescem com as seções; definições usam limites conservadores e só declaram o que coincide com a situação oficial final.</p>
        <h3>Mapas e lugares</h3>
        <p>Malhas municipais do IBGE (MT pela malha 2025, que inclui Boa Esperança do Norte), simplificadas para visualização e ligadas aos resultados pelo código TSE. Países: Natural Earth. As áreas de zona eleitoral não são desenhadas: o TSE não publica esses limites.</p>
        <h3>2022</h3>
        <p>Comparações com 2022 usam a votação do 1º turno de 2022 do TSE (dados abertos), pela candidatura de mesmo número: 13 (Lula) e 22 (Jair Bolsonaro, então no PL).</p>
        <h3>Esquerda, direita e Centrão</h3>
        <p>Posição média de cada partido segundo Bolognesi, Ribeiro, Codato e Silva (Opinião Pública, 2025), cujo centro está vazio desde 2022. Centrão: PP, União Brasil, PSD, Republicanos e MDB — agregado jornalístico mantido à parte do eixo.</p>
        <p className="met-links"><a href="https://resultados.tse.jus.br/" target="_blank" rel="noopener noreferrer">Resultados oficiais no TSE</a> · <a href="https://dadosabertos.tse.jus.br/" target="_blank" rel="noopener noreferrer">Dados abertos do TSE</a></p>
      </div>
    </Modal>
  );
}
