'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { t } from '../../lib/i18n';
import { formatEuros_ } from '../../lib/format';

const _BASE_BANDERA = 'https://commons.wikimedia.org/wiki/';
const BANDERES = {
  ca: _BASE_BANDERA + 'Special:FilePath/Flag_of_Catalonia.svg',
  es: _BASE_BANDERA + 'Special:FilePath/Flag_of_Spain.svg',
  en: _BASE_BANDERA + 'Special:FilePath/Flag_of_the_United_Kingdom.svg',
};
function banderaUrl(id) { return BANDERES[id] || BANDERES.ca; }

export default function ClientsPage() {
  const { token, sessio, errorSessio } = useAuth();
  const idioma = sessio?.idioma || 'ca';

  const [clients, setClients] = useState([]);
  const [carregant, setCarregant] = useState(true);
  const [popup, setPopup] = useState({ visible: false, client: null, top: 0, left: 0 });
  const popupRef = useRef(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      setClients(await api.getClientsFacturacio(token));
    } catch (err) {
      errorSessio(err);
    } finally {
      setCarregant(false);
    }
  }, [token, errorSessio]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    function clicFora(e) {
      if (popupRef.current && !popupRef.current.contains(e.target) && !e.target.closest('.flag-btn'))
        setPopup(p => ({ ...p, visible: false }));
    }
    document.addEventListener('click', clicFora);
    return () => document.removeEventListener('click', clicFora);
  }, []);

  async function canviarPreuBase(client, preu) {
    try {
      await api.actualitzarPreuBase(token, client, preu);
      setClients(prev => prev.map(c => c.client !== client ? c : {
        ...c, preuBase: preu, total: Math.round((preu + c.sumaPlus) * 100) / 100
      }));
    } catch (err) { errorSessio(err); }
  }

  async function canviarIdioma(client, nouIdioma) {
    setPopup(p => ({ ...p, visible: false }));
    try {
      await api.setIdiomaOverride(token, client, nouIdioma);
      setClients(prev => prev.map(c => c.client !== client ? c : { ...c, idioma: nouIdioma }));
    } catch (err) { errorSessio(err); }
  }

  function obrirPopup(e, client) {
    const r = e.currentTarget.getBoundingClientRect();
    setPopup({ visible: true, client, top: r.bottom + 4, left: r.left });
  }

  return (
    <div id="clients-view">
      <div id="clients-grid">
        {carregant ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ height: 190 }} />
          ))
        ) : !clients.length ? (
          <div className="empty-state">{t(idioma, 'buit_dades')}</div>
        ) : (
          clients.map(c => (
            <div key={c.client} className="client-card">
              <div className="client-card-top">
                <div>
                  <div className="client-card-nom">{c.client}</div>
                  <div className="client-card-projectes">
                    {c.projectesActius} projecte{c.projectesActius === 1 ? '' : 's'}{' '}
                    actiu{c.projectesActius === 1 ? '' : 's'} a NexaControl
                  </div>
                </div>
                <button type="button" className="flag-btn" title="Idioma" onClick={e => obrirPopup(e, c.client)}>
                  <img src={banderaUrl(c.idioma)} alt={(c.idioma || 'ca').toUpperCase()} />
                </button>
              </div>
              <div className="projecte-data">
                <label>Preu base (€)</label>
                <input
                  key={c.client + '|' + c.preuBase}
                  type="number" min="0" step="0.01" className="input-preu-base"
                  defaultValue={c.preuBase}
                  onBlur={e => canviarPreuBase(c.client, parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="client-card-linia">
                <span>Plus per projectes</span>
                <span>{formatEuros_(c.sumaPlus)}</span>
              </div>
              <div className="client-card-total">
                <span>Total</span>
                <span>{formatEuros_(c.total)}</span>
              </div>
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
