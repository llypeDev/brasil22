// Publicidade inicial (3:2). Abre só com campanha ativa, fora do modo TV, depois que o painel
// carregou e — se houver arte configurada — com a imagem já carregada. A dispensa é guardada
// por ID de campanha, sem impedir campanhas futuras.

import { useEffect, useState } from 'react';
import { useEstado } from '../../app/store';
import { campanhaAtiva } from '../../app/marca';
import { Modal } from '../../components/Modal';
import { IconeFechar, IconeSeta } from '../../components/Icones';

const chave = (id: string) => `apuracao:campanha-dispensada:${id}`;
const lerDispensa = (id: string) => { try { return localStorage.getItem(chave(id)) === '1'; } catch { return false; } };
const gravarDispensa = (id: string) => { try { localStorage.setItem(chave(id), '1'); } catch { /* armazenamento indisponível */ } };

export function ModalCampanha() {
  const aberto = useEstado((s) => s.campanhaModal);
  const set = useEstado((s) => s.set);
  const tv = useEstado((s) => s.nav.tv);
  const agora = useEstado((s) => s.agoraVivo);
  const c = campanhaAtiva();
  const [imagemPronta, setImagemPronta] = useState(false);
  const imagem = (c as unknown as { imagem?: string } | null)?.imagem;

  useEffect(() => {
    if (!imagem) return;
    const img = new Image();
    img.onload = () => setImagemPronta(true);
    img.src = imagem;
  }, [imagem]);

  useEffect(() => {
    if (!c || tv || !agora || lerDispensa(c.id)) return;
    if (imagem && !imagemPronta) return;
    if (new URLSearchParams(location.search).has('semAnuncio')) return;
    const id = setTimeout(() => {
      const s = useEstado.getState();
      if (!s.nav.tv && !s.busca && !s.formulario) set({ campanhaModal: true });
    }, 2500);
    return () => clearTimeout(id);
  }, [c, tv, agora, imagem, imagemPronta, set]);

  useEffect(() => { if (tv && aberto) set({ campanhaModal: false }); }, [tv, aberto, set]);

  if (!c) return null;
  const fechar = () => { gravarDispensa(c.id); set({ campanhaModal: false }); };
  const agir = () => { gravarDispensa(c.id); set({ campanhaModal: false, formulario: c.destino ? null : c.abre ?? 'anuncio' }); if (c.destino) window.open(c.destino, '_blank', 'noopener'); };
  return (
    <Modal aberto={aberto && !tv} aoFechar={fechar} rotulo={`Anúncio: ${c.marca}`} className="modal-campanha" folha={false}>
      <div className="arte" style={{ background: c.cores.fundo, color: c.cores.texto }}>
        {imagem ? <img src={imagem} alt={c.modal.titulo} /> : (
          <div className="arte-texto">
            <span className="arte-rotulo">Anúncio{c.demonstracao ? ' · demonstração' : ''}</span>
            <b className="serif">{c.modal.titulo}</b>
            <p>{c.modal.texto}</p>
            <span className="arte-marca" style={{ color: c.cores.destaque }}>{c.marca}</span>
          </div>
        )}
        <button className="icone fechar-arte" onClick={fechar} aria-label="Fechar o anúncio"><IconeFechar /></button>
      </div>
      <div className="arte-acoes">
        <button className="btn cheio" onClick={agir}>{c.modal.acao} <IconeSeta /></button>
        <button className="btn fantasma" onClick={fechar}>Agora não</button>
      </div>
    </Modal>
  );
}
