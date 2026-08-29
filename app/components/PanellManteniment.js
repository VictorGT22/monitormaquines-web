'use client';

import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { t } from '../lib/i18n';

const TASCA_BUIDA = { nom: '', materialNecessari: [], periodicitatHores: '', duradaMin: '', notes: '' };
const NOM_MAX = 100;
const MATERIAL_ITEM_MAX = 80;
const MATERIAL_ITEMS_MAX = 30;
const NOTES_MAX = 500;
const PERIODICITAT_MIN_H = 8;
const DURADA_MIN_MIN = 5;
const DURADA_MAX_MIN = 480; // una jornada (8h)

function formatarDataCurta_(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ca', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Verd fins al 70%, ambre fins al 95%, vermell a partir d'aquí (o vençuda).
function colorProgres_(percent, vencuda) {
  if (vencuda || percent >= 95) return 'vermell';
  if (percent >= 70) return 'ambre';
  return 'verd';
}

export default function PanellManteniment({ machineId, onDadesCanvi }) {
  const { token, sessio, errorSessio } = useAuth();
  const idioma = sessio?.idioma || 'ca';

  const [dades, setDades] = useState(null);
  const [formObert, setFormObert] = useState(false);
  const [editantId, setEditantId] = useState(null);
  const [formValors, setFormValors] = useState(TASCA_BUIDA);
  const [guardant, setGuardant] = useState(false);
  // Text encara no afegit a la llista de material — separat de
  // formValors.materialNecessari (l'array ja confirmat).
  const [materialDraft, setMaterialDraft] = useState('');

  const carregar = useCallback(() => {
    if (!token || !machineId) return;
    // 403 (màquina d'un altre tenant, accés directe per URL): la fitxa ja
    // en detecta l'accés denegat i redirigeix — aquí només cal no mostrar
    // el banner d'error genèric mentre això passa.
    api.getManteniment(token, machineId).then((resposta) => {
      setDades(resposta);
      onDadesCanvi?.(resposta);
    }).catch((err) => {
      if (err && err.status === 403) return;
      errorSessio(err);
    });
  }, [token, machineId, errorSessio, onDadesCanvi]);

  useEffect(() => { carregar(); }, [carregar]);

  function obrirNovaTasca() {
    setEditantId(null);
    setFormValors(TASCA_BUIDA);
    setMaterialDraft('');
    setFormObert(true);
  }

  function obrirEdicio(tasca) {
    setEditantId(tasca.id);
    setFormValors({
      nom: tasca.nom, materialNecessari: Array.isArray(tasca.materialNecessari) ? tasca.materialNecessari : [],
      periodicitatHores: tasca.periodicitatHores, duradaMin: tasca.duradaMin, notes: tasca.notes,
    });
    setMaterialDraft('');
    setFormObert(true);
  }

  function tancarForm() {
    setFormObert(false);
    setEditantId(null);
    setFormValors(TASCA_BUIDA);
    setMaterialDraft('');
  }

  function afegirMaterial() {
    const valor = materialDraft.trim().slice(0, MATERIAL_ITEM_MAX);
    if (!valor) return;
    setFormValors((v) => (
      v.materialNecessari.length >= MATERIAL_ITEMS_MAX || v.materialNecessari.includes(valor)
        ? v
        : { ...v, materialNecessari: [...v.materialNecessari, valor] }
    ));
    setMaterialDraft('');
  }

  function eliminarMaterial(index) {
    setFormValors((v) => ({ ...v, materialNecessari: v.materialNecessari.filter((_, i) => i !== index) }));
  }

  async function guardarForm(e) {
    e.preventDefault();
    setGuardant(true);
    try {
      const periodicitatHores = Math.max(PERIODICITAT_MIN_H, Number(formValors.periodicitatHores) || 0);
      const duradaMin = Math.min(DURADA_MAX_MIN, Math.max(DURADA_MIN_MIN, Number(formValors.duradaMin) || 0));
      const body = {
        nom: formValors.nom.slice(0, NOM_MAX),
        materialNecessari: formValors.materialNecessari.slice(0, MATERIAL_ITEMS_MAX),
        periodicitatHores,
        duradaMin,
        notes: formValors.notes.slice(0, NOTES_MAX),
      };
      if (editantId) await api.editarTascaManteniment(token, machineId, editantId, body);
      else await api.crearTascaManteniment(token, machineId, body);
      tancarForm();
      carregar();
    } catch (err) { errorSessio(err); } finally { setGuardant(false); }
  }

  async function marcarFeta(tascaId) {
    try {
      await api.marcarTascaFetaAvui(token, machineId, tascaId);
      carregar();
    } catch (err) { errorSessio(err); }
  }

  async function eliminar(tascaId) {
    if (!window.confirm(t(idioma, 'manteniment_confirmarEliminar'))) return;
    try {
      await api.eliminarTascaManteniment(token, machineId, tascaId);
      carregar();
    } catch (err) { errorSessio(err); }
  }

  if (!dades) return <div className="skeleton-card" style={{ height: 180 }} />;

  const { tasques, mitjanaHoresDia, potEditar, horesFuncionamentAnyEstimades, horesManteniAnyEstimades, disponibilitatEstimadaAnual } = dades;

  return (
    <div>
      <div className="kpi-row" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="valor">{mitjanaHoresDia}h/dia</div>
          <div className="etiqueta">{t(idioma, 'manteniment_ritmeUs')}</div>
        </div>
        <div className="kpi">
          <div className="valor">{horesFuncionamentAnyEstimades}h</div>
          <div className="etiqueta">Funcionament estimat/any</div>
        </div>
        <div className="kpi kpi-parat-wrap">
          <div className="valor">{horesManteniAnyEstimades}h</div>
          <div className="etiqueta">{t(idioma, 'manteniment_horesManteniAny')}</div>
        </div>
        <div className="kpi kpi-produccio">
          <div className="valor">{disponibilitatEstimadaAnual}%</div>
          <div className="etiqueta">{t(idioma, 'manteniment_disponibilitatAnual')}</div>
        </div>
      </div>

      {potEditar && (
        <div style={{ marginBottom: 18 }}>
          {!formObert ? (
            <button type="button" className="btn-primary" onClick={obrirNovaTasca}>
              <span className="manteniment-btn-nova-icona">+</span> {t(idioma, 'manteniment_novaTasca')}
            </button>
          ) : (
            <div className="manteniment-form-card">
              <div className="manteniment-form-titol">
                {editantId ? t(idioma, 'manteniment_editar') : t(idioma, 'manteniment_novaTasca')}
              </div>
              <form onSubmit={guardarForm} className="manteniment-form-grid">
                <div className="manteniment-camp manteniment-camp-ampla">
                  <label>{t(idioma, 'manteniment_nom')}</label>
                  <input type="text" required maxLength={NOM_MAX} value={formValors.nom}
                    onChange={(e) => setFormValors((v) => ({ ...v, nom: e.target.value }))} />
                  <span className="manteniment-comptador">{formValors.nom.length}/{NOM_MAX}</span>
                </div>
                <div className="manteniment-camp manteniment-camp-ampla">
                  <label>{t(idioma, 'manteniment_material')}</label>
                  <div className="manteniment-material-input">
                    <input
                      type="text" maxLength={MATERIAL_ITEM_MAX} value={materialDraft}
                      placeholder={t(idioma, 'manteniment_material_afegir')}
                      onChange={(e) => setMaterialDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); afegirMaterial(); } }}
                    />
                    <button type="button" className="btn-secondary" onClick={afegirMaterial} disabled={!materialDraft.trim()}>
                      {t(idioma, 'manteniment_material_afegirBtn')}
                    </button>
                  </div>
                  {formValors.materialNecessari.length > 0 && (
                    <ul className="manteniment-material-llista">
                      {formValors.materialNecessari.map((item, i) => (
                        <li key={i}>
                          <span>{item}</span>
                          <button type="button" onClick={() => eliminarMaterial(i)} aria-label={t(idioma, 'manteniment_material_eliminar')}>×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="manteniment-camp">
                  <label>{t(idioma, 'manteniment_periodicitat')}</label>
                  <input type="number" min={PERIODICITAT_MIN_H} step="1" required value={formValors.periodicitatHores}
                    onChange={(e) => setFormValors((v) => ({ ...v, periodicitatHores: e.target.value }))} />
                  <span className="manteniment-ajuda">mín. {PERIODICITAT_MIN_H}h</span>
                </div>
                <div className="manteniment-camp">
                  <label>{t(idioma, 'manteniment_durada')}</label>
                  <input type="number" min={DURADA_MIN_MIN} max={DURADA_MAX_MIN} step="1" required value={formValors.duradaMin}
                    onChange={(e) => setFormValors((v) => ({ ...v, duradaMin: e.target.value }))} />
                  <span className="manteniment-ajuda">{DURADA_MIN_MIN}-{DURADA_MAX_MIN} min</span>
                </div>
                <div className="manteniment-camp manteniment-camp-ampla">
                  <label>{t(idioma, 'manteniment_notes')}</label>
                  <input type="text" maxLength={NOTES_MAX} value={formValors.notes}
                    onChange={(e) => setFormValors((v) => ({ ...v, notes: e.target.value }))} />
                  <span className="manteniment-comptador">{formValors.notes.length}/{NOTES_MAX}</span>
                </div>
                <div className="manteniment-form-botons">
                  <button type="submit" className="btn-primary" disabled={guardant}>{t(idioma, 'manteniment_guardar')}</button>
                  <button type="button" className="btn-secondary" onClick={tancarForm}>{t(idioma, 'manteniment_cancelar')}</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {!tasques.length ? (
        <div className="empty-state">{t(idioma, 'manteniment_buit')}</div>
      ) : (
        <div className="manteniment-grid">
          {tasques.map((tasca) => {
            const color = colorProgres_(tasca.progresPercent, tasca.vencuda);
            return (
              <div key={tasca.id} className={'manteniment-card manteniment-card-' + color}>
                <div className="manteniment-card-top">
                  <div className="manteniment-card-nom" title={tasca.nom}>{tasca.nom}</div>
                  <span className={'manteniment-badge manteniment-badge-' + color}>
                    {tasca.vencuda ? t(idioma, 'manteniment_vencuda') : tasca.progresPercent + '%'}
                  </span>
                </div>

                {tasca.materialNecessari?.length ? (
                  <div className="manteniment-card-material" title={tasca.materialNecessari.join(', ')}>
                    {tasca.materialNecessari.join(', ')}
                  </div>
                ) : null}

                <div className="manteniment-progres">
                  <div className="manteniment-progres-track">
                    <div
                      className={'manteniment-progres-fill manteniment-progres-fill-' + color}
                      style={{ width: Math.min(100, tasca.progresPercent) + '%' }}
                    />
                  </div>
                  <div className="manteniment-progres-text">
                    {tasca.horesAcumulades}h <span className="manteniment-progres-de">/ {tasca.periodicitatHores}h</span>
                  </div>
                </div>

                <div className="manteniment-info-grid">
                  <div className="manteniment-info-camp">
                    <span className="manteniment-info-label">{t(idioma, 'manteniment_ultimaRealitzada')}</span>
                    <span className="manteniment-info-valor">{formatarDataCurta_(tasca.ultimaRealitzada)}</span>
                  </div>
                  <div className="manteniment-info-camp">
                    <span className="manteniment-info-label">{t(idioma, 'manteniment_properaEstimada')}</span>
                    <span className="manteniment-info-valor">
                      {tasca.vencuda ? t(idioma, 'manteniment_vencuda') : (tasca.dataEstimadaProxima ? formatarDataCurta_(tasca.dataEstimadaProxima) : '—')}
                    </span>
                  </div>
                  <div className="manteniment-info-camp">
                    <span className="manteniment-info-label">{t(idioma, 'manteniment_durada')}</span>
                    <span className="manteniment-info-valor">{tasca.duradaMin} min</span>
                  </div>
                </div>

                {tasca.notes ? <div className="manteniment-notes" title={tasca.notes}>{tasca.notes}</div> : null}

                {potEditar && (
                  <div className="manteniment-card-botons">
                    <button type="button" className="btn-primary" onClick={() => marcarFeta(tasca.id)}>
                      {t(idioma, 'manteniment_fetaAvui')}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => obrirEdicio(tasca)}>
                      {t(idioma, 'manteniment_editar')}
                    </button>
                    <button type="button" className="btn-secondary manteniment-btn-eliminar" onClick={() => eliminar(tasca.id)}>
                      {t(idioma, 'manteniment_eliminar')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
