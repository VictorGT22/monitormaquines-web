'use client';

import { useCallback, useEffect, useState } from 'react';
import * as api from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { t } from '../../lib/i18n';
import { IconaCabal, IconaConsum, IconaReferencia } from '../../lib/icons';
import DatePickerInput from '../../components/DatePickerInput';

const TOTS_TORNS = ['Matí', 'Tarda', 'Nit'];
const TORNS_IDIOMA = {
  ca: { 'Matí': 'Matí', 'Tarda': 'Tarda', 'Nit': 'Nit' },
  es: { 'Matí': 'Mañana', 'Tarda': 'Tarde', 'Nit': 'Noche' },
  en: { 'Matí': 'Morning', 'Tarda': 'Afternoon', 'Nit': 'Night' },
};
export default function ProjectesPage() {
  const { token, sessio, errorSessio } = useAuth();
  const idioma = sessio?.idioma || 'ca';
  const tornsNoms = TORNS_IDIOMA[idioma] || TORNS_IDIOMA.ca;

  const [projectes, setProjectes] = useState([]);
  const [carregant, setCarregant] = useState(true);
  const [filtreEstat, setFiltreEstat] = useState('actius');
  const [filtreText, setFiltreText] = useState('');
  const [preusNou, setPreusNou] = useState({});

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      setProjectes(await api.getProjectesErp(token));
    } catch (err) {
      errorSessio(err);
    } finally {
      setCarregant(false);
    }
  }, [token, errorSessio]);

  useEffect(() => { carregar(); }, [carregar]);

  function actualitzar(id, camps) {
    setProjectes(prev => prev.map(p => p.id !== id ? p : { ...p, ...camps }));
  }

  async function activar(id) {
    const item = projectes.find(p => p.id === id);
    if (!item) return;
    const preu = parseFloat(preusNou[id]) || 0;
    actualitzar(id, { nexaControlActiu: true, nexaControlSuspes: false, preuPlus: preu });
    try {
      await api.activarNexaControl(token, id, item.descripcio, item.client, preu);
      carregar();
    } catch (err) {
      actualitzar(id, { nexaControlActiu: false });
      errorSessio(err);
    }
  }

  async function canviarActivacio(id, actiu) {
    actualitzar(id, { nexaControlSuspes: !actiu });
    try {
      await api.canviarActivacioProjecte(token, id, actiu);
      carregar();
    } catch (err) {
      actualitzar(id, { nexaControlSuspes: actiu });
      errorSessio(err);
    }
  }

  async function canviarVisibilitat(id, visible) {
    actualitzar(id, { visibleClient: visible });
    try {
      await api.canviarVisibilitatClient(token, id, visible);
      carregar();
    } catch (err) {
      actualitzar(id, { visibleClient: !visible });
      errorSessio(err);
    }
  }

  async function canviarReferencia(id, mostrar) {
    actualitzar(id, { mostrarReferencia: mostrar });
    try {
      await api.canviarMostrarReferencia(token, id, mostrar);
      carregar();
    } catch (err) {
      actualitzar(id, { mostrarReferencia: !mostrar });
      errorSessio(err);
    }
  }

  async function canviarCabal(id, actiu) {
    actualitzar(id, { controlCabal: actiu });
    try {
      await api.canviarControlCabal(token, id, actiu);
      carregar();
    } catch (err) {
      actualitzar(id, { controlCabal: !actiu });
      errorSessio(err);
    }
  }

  async function canviarConsum(id, actiu) {
    actualitzar(id, { controlConsumElectric: actiu });
    try {
      await api.canviarControlConsumElectric(token, id, actiu);
      carregar();
    } catch (err) {
      actualitzar(id, { controlConsumElectric: !actiu });
      errorSessio(err);
    }
  }

  async function canviarTorns(id, torn) {
    const item = projectes.find(p => p.id === id);
    if (!item) return;
    const actiu = item.torns.includes(torn);
    const nous = actiu ? item.torns.filter(t => t !== torn) : [...item.torns, torn];
    if (!nous.length) return;
    actualitzar(id, { torns: nous });
    try {
      await api.canviarTornsProjecte(token, id, nous);
    } catch (err) {
      actualitzar(id, { torns: item.torns });
      errorSessio(err);
    }
  }

  async function guardarDataImpl(id, novaData) {
    try {
      await api.actualitzarDataImplementacio(token, id, novaData || null);
      actualitzar(id, { dataImplementacio: novaData });
    } catch (err) { errorSessio(err); }
  }

  async function guardarPreuPlus(id, preu) {
    try {
      await api.actualitzarPreuPlus(token, id, preu);
      actualitzar(id, { preuPlus: preu });
    } catch (err) { errorSessio(err); }
  }

  const q = filtreText.trim().toLowerCase();
  const projectesFiltrats = projectes
    .filter(p => filtreEstat === 'actius' ? p.nexaControlActiu : !p.nexaControlActiu)
    .filter(p => !q || p.descripcio.toLowerCase().includes(q) || p.client.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));

  return (
    <div id="projectes-view">
      <div className="subtabs" id="filtre-projectes-estat">
        {[['actius', 'Activats'], ['no-actius', 'No activats']].map(([estat, label]) => (
          <button
            key={estat} type="button"
            className={'nav-tab' + (filtreEstat === estat ? ' actiu' : '')}
            onClick={() => setFiltreEstat(estat)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="filtres-historic">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Cercar</label>
          <input
            type="text"
            placeholder="Cercar per projecte o client..."
            value={filtreText}
            onChange={e => setFiltreText(e.target.value)}
          />
        </div>
      </div>

      <div id="projectes-grid">
        {carregant ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ height: 170 }} />
          ))
        ) : !projectesFiltrats.length ? (
          <div className="empty-state">{t(idioma, 'buit_dades')}</div>
        ) : (
          projectesFiltrats.map(p => (
            <div key={p.id} className={'projecte-card' + (p.nexaControlSuspes ? ' suspes' : '')}>
              {p.nexaControlSuspes
                ? <span className="chip-suspes">Desactivat</span>
                : p.nexaControlActiu
                ? <span className="chip-nexacontrol">NexaControl</span>
                : null}
              <div className="projecte-header2">
                <div className="projecte-info">
                  <div className="client-tag">{p.client}</div>
                  <div className="projecte-nom">
                    <span className="projecte-id">{p.id}</span>
                    {p.descripcio}
                  </div>
                </div>
              </div>

              {p.nexaControlActiu ? (
                <div className="projecte-bottom">
                  <div className="projecte-pills">
                    <button type="button"
                      className={'control-pill' + (p.controlCabal ? ' actiu' : '')}
                      onClick={() => canviarCabal(p.id, !p.controlCabal)}
                    >
                      <IconaCabal />Control cabal
                    </button>
                    <button type="button"
                      className={'control-pill' + (p.controlConsumElectric ? ' actiu' : '')}
                      onClick={() => canviarConsum(p.id, !p.controlConsumElectric)}
                    >
                      <IconaConsum />Consum elèctric
                    </button>
                    <button type="button"
                      className={'control-pill' + (p.mostrarReferencia ? ' actiu' : '')}
                      onClick={() => canviarReferencia(p.id, !p.mostrarReferencia)}
                    >
                      <IconaReferencia />Referència
                    </button>
                  </div>
                  <div className="projecte-data">
                    <label>Torns</label>
                    <div className="torns-chips">
                      {TOTS_TORNS.map(torn => (
                        <button key={torn} type="button"
                          className={'torn-chip' + (p.torns.includes(torn) ? ' actiu' : '')}
                          onClick={() => canviarTorns(p.id, torn)}
                        >
                          {tornsNoms[torn]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="projecte-camps">
                    <div className="projecte-data">
                      <label>Implementació a fàbrica</label>
                      <DatePickerInput
                        value={p.dataImplementacio ? p.dataImplementacio.substring(0, 10) : ''}
                        placeholder="dd/mm/aaaa"
                        onChange={val => guardarDataImpl(p.id, val)}
                      />
                    </div>
                    <div className="projecte-data">
                      <label>Plus (€)</label>
                      <input
                        key={p.id + '|' + p.preuPlus}
                        type="number" min="0" step="0.01" className="input-preu-plus"
                        defaultValue={p.preuPlus || 0}
                        onBlur={e => guardarPreuPlus(p.id, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="projecte-botons">
                    <button type="button" className="btn btn-neutral"
                      onClick={() => canviarActivacio(p.id, !!p.nexaControlSuspes)}
                    >
                      {p.nexaControlSuspes ? 'Reactivar' : 'Suspendre'}
                    </button>
                    <button type="button" className="btn btn-neutral"
                      onClick={() => canviarVisibilitat(p.id, p.visibleClient === false)}
                    >
                      {p.visibleClient === false ? 'Fer visible al client' : 'Amagar al client (posta en marxa)'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="projecte-bottom">
                  <div className="projecte-camps">
                    <div className="projecte-data">
                      <label>Plus (€)</label>
                      <input
                        type="number" min="0" step="0.01" className="input-preu-nou"
                        placeholder="0,00"
                        value={preusNou[p.id] || ''}
                        onChange={e => setPreusNou(prev => ({ ...prev, [p.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                  <button type="button" className="btn btn-activar" onClick={() => activar(p.id)}>
                    Activar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
