/**
 * Pont que fa que el codi client ORIGINAL de MonitorMaquines (body.html,
 * copiat literal des d'Apps Script) funcioni sense tocar ni una línia:
 * emula `google.script.run.withSuccessHandler(...).withFailureHandler(...).nomFuncio(args)`
 * cridant el backend real (native-api.js a Render) en lloc de google.script.run.
 *
 * Per què així i no reescrivint index.html com a components: la fidelitat
 * visual/comportamental és total perquè és LITERALMENT el mateix codi que
 * ja funcionava — no hi ha reinterpretació humana pel mig.
 */
const API_BASE = 'https://monitormaquines-bridge.onrender.com/app';

async function apiFetch_(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const resp = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let dades;
  try { dades = text ? JSON.parse(text) : null; } catch (e) { dades = text; }
  if (!resp.ok) {
    const err = new Error((dades && dades.error) || ('Error ' + resp.status));
    err.status = resp.status;
    throw err;
  }
  return dades;
}

function qs_(params) {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '') return;
    if (Array.isArray(v)) { if (v.length) p.set(k, v.filter(Boolean).join(',')); return; }
    p.set(k, v);
  });
  const s = p.toString();
  return s ? '?' + s : '';
}

// ── Implementació de cada funció que abans era una funció de servidor GAS ──
const IMPL = {
  async login(email, password) {
    return apiFetch_('/login', { method: 'POST', body: { email, password } });
  },

  async logout(_token) {
    // Sessió stateless (JWT): no cal avisar el servidor, només netejar local.
    return { ok: true };
  },

  async getSessioActual(token) {
    return apiFetch_('/sessio', { token });
  },

  async getMaquines(token, filtres) {
    return apiFetch_('/maquines' + qs_(filtres), { token });
  },

  async getFiltresAdmin(token) {
    return apiFetch_('/filtres-admin', { token });
  },

  async getFitxaMaquina(token, machineId, dataInici, dataFi, filtres) {
    return apiFetch_(`/maquines/${machineId}/fitxa` + qs_({ ...filtres, dataInici, dataFi }), { token });
  },

  // Als originals, getProduccio/getDetallMaquina tornen una STRING JSON
  // (Apps Script fa JSON.stringify per poder-la enviar al navegador) i el
  // codi client sempre en fa JSON.parse — es replica el mateix contracte.
  async getProduccio(token, machineId, filtres) {
    const dades = await apiFetch_(`/maquines/${machineId}/produccio` + qs_(filtres), { token });
    return JSON.stringify(dades);
  },

  async getDetallMaquina(token, machineId, dataInici, dataFi, filtres) {
    const [fitxa, produccio] = await Promise.all([
      apiFetch_(`/maquines/${machineId}/fitxa` + qs_({ dataInici, dataFi }), { token }),
      apiFetch_(`/maquines/${machineId}/produccio` + qs_(filtres), { token }),
    ]);
    return JSON.stringify({ fitxa, produccio });
  },

  async getConsums(token, machineId, tipus, dataInici, dataFi) {
    const dades = await apiFetch_(`/maquines/${machineId}/consums` + qs_({ tipus, dataInici, dataFi }), { token });
    return JSON.stringify(dades);
  },
  async getCronologia(token, machineId, data) {
    const dades = await apiFetch_(`/maquines/${machineId}/cronologia` + qs_({ data }), { token });
    return JSON.stringify(dades);
  },
  async getDispositiusLog(token) {
    return apiFetch_('/dispositius-log', { token });
  },
  async getPreusConsum(token) {
    return apiFetch_('/preus-consum', { token });
  },
  async setPreusConsum(token, aire, electric) {
    return apiFetch_('/preus-consum', { method: 'PATCH', token, body: { aire, electric } });
  },

  async versioDades(token) {
    const d = await apiFetch_('/versio', { token });
    return d.v || 0;
  },

  // ── Admin: Projectes ERP / NexaControl / Clients ──────────────────────
  async getProjectesErp(token) {
    return apiFetch_('/projectes-erp', { token });
  },
  async activarNexaControl(token, projecteId, descripcio, client, preuPlus) {
    return apiFetch_('/projectes-nexa-control/activar', { method: 'POST', token, body: { projecteId, descripcio, client, preuPlus } });
  },
  async actualitzarDataImplementacio(token, projecteId, novaData) {
    return apiFetch_(`/projectes-erp/${projecteId}/data-implementacio`, { method: 'PATCH', token, body: { novaData } });
  },
  async actualitzarPreuPlus(token, projecteId, preu) {
    return apiFetch_(`/projectes-erp/${projecteId}/preu-plus`, { method: 'PATCH', token, body: { preu } });
  },
  async canviarActivacioProjecte(token, projecteId, actiu) {
    return apiFetch_(`/projectes-erp/${projecteId}/actiu`, { method: 'PATCH', token, body: { actiu } });
  },
  async canviarVisibilitatClient(token, projecteId, visible) {
    return apiFetch_(`/projectes-erp/${projecteId}/visible`, { method: 'PATCH', token, body: { visible } });
  },
  async canviarMostrarReferencia(token, projecteId, mostrar) {
    return apiFetch_(`/projectes-erp/${projecteId}/mostrar-referencia`, { method: 'PATCH', token, body: { mostrar } });
  },
  async canviarControlCabal(token, projecteId, actiu) {
    return apiFetch_(`/projectes-erp/${projecteId}/control-cabal`, { method: 'PATCH', token, body: { actiu } });
  },
  async canviarControlConsumElectric(token, projecteId, actiu) {
    return apiFetch_(`/projectes-erp/${projecteId}/control-consum-electric`, { method: 'PATCH', token, body: { actiu } });
  },
  async canviarTornsProjecte(token, projecteId, torns) {
    return apiFetch_(`/projectes-erp/${projecteId}/torns`, { method: 'PATCH', token, body: { torns } });
  },
  async setIdiomaOverride(token, client, idioma) {
    return apiFetch_('/clients-nexa/idioma', { method: 'PATCH', token, body: { client, idioma } });
  },
  async getClientsFacturacio(token) {
    return apiFetch_('/clients-facturacio', { token });
  },
  async actualitzarPreuBase(token, client, preuBase) {
    return apiFetch_('/clients-nexa/preu-base', { method: 'PATCH', token, body: { client, preuBase } });
  },

  // Funcions temporals de depuració de l'app original (mai fan res crític —
  // al codi original els errors ja es descarten en silenci): no cal implementar-les.
  async simularDadesClient_temp() { return null; },
  async simularHistoricIncidencies_temp() { return null; },
};

// ── Emulació de la cadena fluent de google.script.run ──────────────────────
function crearRunner_() {
  let onSuccess = () => {};
  let onFailure = (e) => console.error('[gas-bridge]', e);

  const runner = {
    withSuccessHandler(fn) { onSuccess = fn; return runner; },
    withFailureHandler(fn) { onFailure = fn; return runner; },
  };

  Object.keys(IMPL).forEach((nom) => {
    runner[nom] = (...args) => {
      Promise.resolve(IMPL[nom](...args)).then(onSuccess).catch((err) => onFailure(err));
    };
  });

  return runner;
}

window.google = window.google || {};
window.google.script = window.google.script || {};
Object.defineProperty(window.google.script, 'run', {
  get() { return crearRunner_(); },
  configurable: true,
});
