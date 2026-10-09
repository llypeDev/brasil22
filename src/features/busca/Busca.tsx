// Busca unificada (combobox + listbox), atalhos Ctrl/Cmd+K e "/", setas, Enter e Esc.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useEstado } from '../../app/store';
import { useBuscaDeputados, useGeoBrasil, useGeoMundo, useMunicipios } from '../../app/dados';
import { Modal } from '../../components/Modal';
import { IconeBusca } from '../../components/Icones';
import { origemBusca } from '../../components/Cabecalho';
import { abrirPerfil } from '../perfil/acoes';
import { buscar, construirIndice, sugestoes, type Item } from './indice';
import { partido } from '../../data/partidos';

export function executar(it: Item) {
  const s = useEstado.getState();
  const a = it.acao;
  s.set({ busca: false, lista: null });
  switch (a.tipo) {
    case 'uf': s.navegar({ uf: a.uf, zz: false, mun: null }); break;
    case 'mun': s.navegar({ cargo: s.nav.cargo === 'deputados' ? 'presidente' : s.nav.cargo, uf: a.uf, mun: a.ibge, zz: false, zona: null }); break;
    case 'zona': s.navegar({ cargo: 'presidente', uf: a.uf, mun: a.ibge, zona: a.zona, zz: false }); break;
    case 'pais': s.navegar({ cargo: 'presidente', zz: true, pais: a.iso, cidade: null }); break;
    case 'cidade': s.navegar({ cargo: 'presidente', zz: true, cidade: a.tse, pais: a.pais }); break;
    case 'cand':
      s.navegar(a.cargo === 'presidente' ? { cargo: 'presidente', uf: null, zz: false } : { cargo: a.cargo === 'governador' ? 'governadores' : 'senado', uf: a.uf, zz: false, mun: null });
      abrirPerfil({ cargo: a.cargo, uf: a.uf, n: a.n, sq: a.sq });
      break;
    case 'dep':
      s.set({ casa: a.casa === 'f' ? 'f' : 'e' });
      s.navegar({ cargo: 'deputados', uf: a.uf, zz: false });
      abrirPerfil({ cargo: 'deputado', uf: a.uf, n: a.n, sq: a.sq, casa: a.casa });
      break;
  }
}

export function Busca() {
  const aberta = useEstado((s) => s.busca);
  const set = useEstado((s) => s.set);
  const uf = useEstado((s) => s.nav.uf);
  const cat = useEstado((s) => s.catalogo);
  const manifesto = useEstado((s) => s.manifesto);
  const geo = useGeoBrasil().dados;
  const mundo = useGeoMundo(aberta).dados;
  const mun = useMunicipios().dados;
  const dep = useBuscaDeputados(aberta);
  const [q, setQ] = useState('');
  const [ativo, setAtivo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const idLista = useId();

  useEffect(() => { if (aberta) { setQ(''); setAtivo(0); } }, [aberta]);
  const indice = useMemo(() => (geo && cat ? construirIndice(geo, mundo, cat, mun, manifesto?.zonasPorMunicipio, dep.dados) : []), [geo, mundo, cat, mun, manifesto, dep.dados]);
  const grupos = useMemo(() => (q.trim() ? buscar(indice, q, uf) : [sugestoes(indice, uf)].filter((g) => g.itens.length)), [indice, q, uf]);
  const plano = grupos.flatMap((g) => g.itens);
  useEffect(() => { setAtivo(0); }, [q]);

  const teclar = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(plano.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && plano[ativo]) { e.preventDefault(); executar(plano[ativo]); }
  };
  useEffect(() => { document.getElementById(`${idLista}-${ativo}`)?.scrollIntoView({ block: 'nearest' }); }, [ativo, idLista]);

  const vazio = q.trim() && !plano.length;
  let k = -1;
  return (
    <Modal aberto={aberta} aoFechar={() => set({ busca: false })} rotulo="Buscar" className="busca" focoInicial={entrada} devolverFocoPara={origemBusca}>
      <div className="busca-campo">
        <IconeBusca />
        <input ref={entrada} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={teclar} placeholder="Município, zona, estado, país, candidato ou deputado"
          role="combobox" aria-expanded={plano.length > 0} aria-controls={idLista} aria-activedescendant={plano.length ? `${idLista}-${ativo}` : undefined} aria-autocomplete="list" aria-label="Buscar município, zona, estado, país ou candidatura" autoComplete="off" spellCheck={false} />
        <kbd>Esc</kbd>
      </div>
      <div className="busca-resultados" id={idLista} role="listbox" aria-label="Resultados">
        {grupos.map((g) => (
          <div key={g.grupo} role="group" aria-label={g.grupo}>
            <p className="busca-grupo">{g.grupo}</p>
            {g.itens.map((it) => {
              k++;
              const meu = k;
              const cor = it.acao.tipo === 'cand' || it.acao.tipo === 'dep' ? partido(it.acao.partido).cor : undefined;
              return (
                <div key={it.id} id={`${idLista}-${meu}`} role="option" aria-selected={meu === ativo} className={`busca-item ${meu === ativo ? 'ativo' : ''}`} onMouseMove={() => setAtivo(meu)} onClick={() => executar(it)}>
                  <span className="busca-selo" style={cor ? { background: cor, color: '#fff' } : undefined}>{it.selo}</span>
                  <span className="busca-texto"><b>{it.titulo}</b><small>{it.detalhe}</small></span>
                </div>
              );
            })}
          </div>
        ))}
        {vazio && <p className="busca-vazio">Nada encontrado para “{q}”.</p>}
        {dep.carregando && q.trim().length > 2 && <p className="busca-vazio">Carregando o índice de deputados…</p>}
        {dep.erro && <p className="busca-vazio">O índice de deputados não carregou; municípios, estados e demais cargos seguem disponíveis.</p>}
      </div>
      <div className="busca-rodape" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></div>
      <p className="sr" aria-live="polite">{q.trim() ? (plano.length ? `${plano.length} resultados` : 'Nenhum resultado') : ''}</p>
    </Modal>
  );
}
