// Pedido de acesso (convite) e de anúncio. Validação no cliente e no servidor, campo antispam,
// estados de envio, erro por campo, 429 com espera e confirmação só após gravação confirmada.

import { useEffect, useRef, useState } from 'react';
import { useEstado } from '../../app/store';
import { MARCA } from '../../app/marca';
import { Modal } from '../../components/Modal';
import { IconeFechar, IconeSeta } from '../../components/Icones';

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

type Estado = { fase: 'editando' | 'enviando' | 'enviado' | 'erro'; mensagem?: string; campos?: Record<string, string> };

export function validarCampos(tipo: 'acesso' | 'anuncio', email: string, org: string) {
  const campos: Record<string, string> = {};
  if (!email.trim()) campos.email = 'Informe um e-mail.';
  else if (!EMAIL.test(email.trim())) campos.email = 'Confira o e-mail.';
  if (!org.trim()) campos.org = tipo === 'anuncio' ? 'Informe a empresa.' : 'Informe onde você trabalha.';
  else if (org.trim().length < 2) campos.org = 'Use pelo menos 2 caracteres.';
  return campos;
}

export function Formulario() {
  const tipo = useEstado((s) => s.formulario);
  const set = useEstado((s) => s.set);
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('');
  const [site, setSite] = useState('');
  const [estado, setEstado] = useState<Estado>({ fase: 'editando' });
  const primeiro = useRef<HTMLInputElement>(null);
  useEffect(() => { if (tipo) { setEstado({ fase: 'editando' }); } }, [tipo]);
  if (!tipo) return null;
  const textos = tipo === 'anuncio' ? MARCA.anuncieAqui : MARCA.convite;
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const campos = validarCampos(tipo, email, org);
    if (Object.keys(campos).length) { setEstado({ fase: 'erro', campos, mensagem: 'Confira os campos destacados.' }); return; }
    setEstado({ fase: 'enviando' });
    try {
      const r = await fetch('/api/acesso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, email: email.trim(), org: org.trim(), site }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setEstado({ fase: 'enviado' }); return; }
      if (r.status === 400) setEstado({ fase: 'erro', campos: j.campos ?? {}, mensagem: j.erro ?? 'Confira os campos.' });
      else if (r.status === 429) setEstado({ fase: 'erro', mensagem: `${j.erro ?? 'Muitos pedidos em pouco tempo.'} ${j.esperarSegundos ? `Tente de novo em ${Math.ceil(j.esperarSegundos / 60)} min.` : 'Tente de novo mais tarde.'}` });
      // sem o serviço de pedidos nesta hospedagem (ex.: Vercel estática), tentar de novo não adianta
      else if (r.status === 404 || r.status === 405 || r.status === 501) setEstado({ fase: 'erro', mensagem: 'O envio de pedidos está indisponível neste endereço por enquanto.' });
      else setEstado({ fase: 'erro', mensagem: j.erro ?? 'Não foi possível registrar agora. Tente novamente.' });
    } catch {
      setEstado({ fase: 'erro', mensagem: 'Sem conexão. Seus dados continuam aqui; tente de novo.' });
    }
  };
  const erroCampo = (k: string) => estado.campos?.[k];
  return (
    <Modal aberto={!!tipo} aoFechar={() => set({ formulario: null })} rotulo={textos.titulo} className="formulario" focoInicial={primeiro}>
      <div className="form-hd">
        <span className="form-marca">{MARCA.titulo}</span>
        <button className="icone" onClick={() => set({ formulario: null })} aria-label="Fechar"><IconeFechar /></button>
      </div>
      {estado.fase === 'enviado' ? (
        <div className="form-ok" role="status">
          <h2 className="serif">Pedido recebido</h2>
          <p>Registramos seu contato. Vamos responder em {email.trim()}.</p>
          <button className="btn cheio largo" onClick={() => set({ formulario: null })}>Fechar</button>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate>
          <h2 className="serif">{textos.titulo}</h2>
          <p className="form-texto">{textos.texto}</p>
          <label htmlFor="f-email">{tipo === 'anuncio' ? 'E-mail' : 'E-mail de trabalho'}</label>
          <input id="f-email" ref={primeiro} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tipo === 'anuncio' ? 'nome@empresa.com.br' : 'nome@orgao.gov.br'} aria-invalid={!!erroCampo('email')} aria-describedby={erroCampo('email') ? 'f-email-erro' : undefined} maxLength={254} />
          {erroCampo('email') && <p className="erro-campo" id="f-email-erro">{erroCampo('email')}</p>}
          <label htmlFor="f-org">{tipo === 'anuncio' ? 'Empresa' : 'Onde você trabalha'}</label>
          <input id="f-org" type="text" autoComplete="organization" value={org} onChange={(e) => setOrg(e.target.value)} placeholder={tipo === 'anuncio' ? 'Nome da empresa' : 'Órgão público ou empresa'} aria-invalid={!!erroCampo('org')} aria-describedby={erroCampo('org') ? 'f-org-erro' : undefined} maxLength={120} />
          {erroCampo('org') && <p className="erro-campo" id="f-org-erro">{erroCampo('org')}</p>}
          <div className="campo-oculto" aria-hidden="true"><label htmlFor="f-site">Site</label><input id="f-site" tabIndex={-1} autoComplete="off" value={site} onChange={(e) => setSite(e.target.value)} /></div>
          {estado.fase === 'erro' && estado.mensagem && <p className="erro-form" role="alert">{estado.mensagem}</p>}
          <button className="btn cheio largo enviar" type="submit" disabled={estado.fase === 'enviando'}>
            {estado.fase === 'enviando' ? <><span className="giro" aria-hidden="true" />Enviando…</> : <>{tipo === 'anuncio' ? 'Quero anunciar' : 'Solicitar acesso'} <IconeSeta /></>}
          </button>
          <p className="form-rodape">{textos.rodape}</p>
        </form>
      )}
    </Modal>
  );
}
