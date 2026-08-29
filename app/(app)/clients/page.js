'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { t } from '../../lib/i18n';
import { formatEuros_ } from '../../lib/format';
import { useClientsFacturacio } from '../../lib/useClientsFacturacio';

const _BASE_BANDERA = 'https://commons.wikimedia.org/wiki/';
const BANDERES = {
  ca: _BASE_BANDERA + 'Special:FilePath/Flag_of_Catalonia.svg',
  es: _BASE_BANDERA + 'Special:FilePath/Flag_of_Spain.svg',
  en: _BASE_BANDERA + 'Special:FilePath/Flag_of_the_United_Kingdom.svg',
};
function banderaUrl(id) { return BANDERES[id] || BANDERES.ca; }

function inicialsClient(nom) {
  const parts = String(nom || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CL';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function IconaPla({ pla }) {
  if (pla === 'diamond') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5 7.5 4h9L20 8.5 12 20 4 8.5Z"/><path d="m4 8.5 8 3 8-3M7.5 4 12 11.5 16.5 4"/></svg>;
  if (pla === 'gold') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 8 4 3 4-6 4 6 4-3-2 10H6L4 8Z"/><path d="M7 18h10"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-5"/></svg>;
}

export default function ClientsPage() {
  const router = useRouter();
  const { token, sessio, errorSessio } = useAuth();
  const idioma = sessio?.idioma || 'ca';

  const { clientsFacturacio: clients, carregantClientsFacturacio: carregant, actualitzarClientFacturacio: actualitzar } = useClientsFacturacio();
  const [popup, setPopup] = useState({ visible: false, client: null, top: 0, left: 0 });
  const [filtreText, setFiltreText] = useState('');
  const popupRef = useRef(null);

  const clientsFiltrats = useMemo(() => {
    const text = filtreText.trim().toLocaleLowerCase();
    if (!text) return clients;
    return clients.filter(c => c.client?.toLocaleLowerCase().includes(text) || c.pla?.toLocaleLowerCase().includes(text));
  }, [clients, filtreText]);
  const projectesTotals = clients.reduce((total, c) => total + (c.projectesActius || 0), 0);
  const facturacioTotal = clients.reduce((total, c) => total + (c.total || 0), 0);

  useEffect(() => {
    function clicFora(e) {
      if (popupRef.current && !popupRef.current.contains(e.target) && !e.target.closest('.flag-btn'))
        setPopup(p => ({ ...p, visible: false }));
    }
    document.addEventListener('click', clicFora);
    return () => document.removeEventListener('click', clicFora);
  }, []);

  async function canviarPreuBase(client, preu) {
    const item = clients.find(c => c.client === client);
    try {
      await api.actualitzarPreuBase(token, client, preu);
      actualitzar(client, { preuBase: preu, total: Math.round((preu + (item?.sumaPlus || 0)) * 100) / 100 });
    } catch (err) { errorSessio(err); }
  }

  async function canviarIdioma(client, nouIdioma) {
    setPopup(p => ({ ...p, visible: false }));
    try {
      await api.setIdiomaOverride(token, client, nouIdioma);
      actualitzar(client, { idioma: nouIdioma });
    } catch (err) { errorSessio(err); }
  }

  function obrirPopup(e, client) {
    const r = e.currentTarget.getBoundingClientRect();
    setPopup({ visible: true, client, top: r.bottom + 4, left: r.left });
  }

  return (
    <div id="clients-view">
      <header className="clients-page-header">
        <div>
          <span className="config-eyebrow">Gestió comercial</span>
          <h2>Clients</h2>
          <p className="page-subtitle">Consulta els plans contractats, la capacitat disponible i la facturació de cada client.</p>
        </div>
        <label className="clients-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
          <input value={filtreText} onChange={e => setFiltreText(e.target.value)} placeholder="Cercar per client o pla" aria-label="Cercar clients" />
        </label>
      </header>

      <div className="clients-overview" aria-label="Resum de clients">
        <div><span>Clients</span><strong>{clients.length}</strong></div>
        <div><span>Projectes actius</span><strong>{projectesTotals}</strong></div>
        <div><span>Facturació mensual</span><strong>{formatEuros_(facturacioTotal)}</strong></div>
      </div>

      <div className="clients-list-heading">
        <div><span className="clients-section-label">Cartera</span><h3>Clients actius</h3></div>
        {!carregant && <span>{clientsFiltrats.length} resultat{clientsFiltrats.length === 1 ? '' : 's'}</span>}
      </div>
      <div id="clients-grid">
        {carregant ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ height: 190 }} />
          ))
        ) : !clientsFiltrats.length ? (
          <div className="empty-state">{filtreText ? 'No hi ha cap client que coincideixi amb la cerca.' : t(idioma, 'buit_dades')}</div>
        ) : (
          clientsFiltrats.map(c => (
            <div key={c.client} className={'client-card client-card-configurable client-plan-' + (c.pla || 'silver')} role={c.tenantId ? 'button' : undefined} tabIndex={c.tenantId ? 0 : undefined}
              onClick={e => { if (c.tenantId && !e.target.closest('button,input')) router.push(`/clients/configuracio?id=${encodeURIComponent(c.tenantId)}`); }}
              onKeyDown={e => { if (c.tenantId && (e.key === 'Enter' || e.key === ' ')) router.push(`/clients/configuracio?id=${encodeURIComponent(c.tenantId)}`); }}>
              <div className="client-card-top">
                <div className="client-card-identitat">
                  <span className="client-plan-icon client-avatar" aria-label={`Inicials de ${c.client}`}>
                    {inicialsClient(c.client)}
                  </span>
                  <div>
                    <div className="client-card-nom">{c.client}</div>
                    <div className="client-card-projectes">
                      {c.projectesActius} projecte{c.projectesActius === 1 ? '' : 's'} actiu{c.projectesActius === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                <button type="button" className="flag-btn" title="Idioma" onClick={e => obrirPopup(e, c.client)}>
                  <img src={banderaUrl(c.idioma)} alt={(c.idioma || 'ca').toUpperCase()} />
                </button>
              </div>
              <div className="client-card-meta">
                {c.pla && <span className={'pla-badge client-plan-badge pla-' + c.pla}><IconaPla pla={c.pla} />{c.pla}</span>}
                <span>{c.usuarisNormals ?? 0} / {c.limits?.usuaris ?? '—'} usuaris</span>
                <span>{c.administradorsClient ?? 0} / {c.limits?.administradors ?? '—'} admins</span>
              </div>
              <div className="client-card-facturacio">
                <div className="projecte-data">
                  <label>Preu base (€)</label>
                  <span className="client-price-input"><input key={c.client + '|' + c.preuBase} type="number" min="0" step="0.01" className="input-preu-base" defaultValue={c.preuBase} onBlur={e => canviarPreuBase(c.client, parseFloat(e.target.value) || 0)} /><span>€</span></span>
                </div>
                <div className="client-card-linia"><span>Plus per projectes</span><span>{formatEuros_(c.sumaPlus)}</span></div>
                <div className="client-card-total"><span>Total mensual</span><span>{formatEuros_(c.total)}</span></div>
              </div>
              {c.tenantId && <div className="client-card-action"><span>Configurar client</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></div>}
            </div>
          ))
        )}
      </div>

      {popup.visible && (
        <div
          ref={popupRef}
          className="idioma-popup show"
          style={{ position: 'fixed', top: popup.top, left: popup.left, zIndex: 1000 }}
        >
          {['ca', 'es', 'en'].map(id => (
            <button key={id} type="button" className="idioma-opt" onClick={() => canviarIdioma(popup.client, id)}>
              <img src={banderaUrl(id)} alt={id.toUpperCase()} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
