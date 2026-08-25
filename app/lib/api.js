/**
 * Client API directe cap al Bridge — substitueix gas-bridge.js. Ja no cal
 * emular google.script.run.withSuccessHandler/.withFailureHandler (això
 * només existia per compatibilitat amb el codi Apps Script original que
 * ara ja no es porta): els components criden aquestes funcions directament.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

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

export async function login(email, password, dispositiu) {
  return apiFetch_('/login', { method: 'POST', body: { email, password, ...(dispositiu || {}) } });
}

export async function logout(token) {
  return apiFetch_('/logout', { method: 'POST', token });
}

export async function getSessioActual(token) {
  return apiFetch_('/sessio', { token });
}

export async function actualitzarPresencia(token) {
  return apiFetch_('/sessio/presencia', { method: 'POST', token });
}

export async function getMaquines(token, filtres) {
  return apiFetch_('/maquines' + qs_(filtres), { token });
}

export async function getMaquinesBase(token, filtres) {
  return apiFetch_('/maquines-base' + qs_(filtres), { token });
}

export async function getMaquinesEstat(token, filtres) {
  return apiFetch_('/maquines-estat' + qs_(filtres), { token });
}

export async function getMaquinesProduccioAvui(token, filtres) {
  return apiFetch_('/maquines-produccio-avui' + qs_(filtres), { token });
}

export async function getFiltresAdmin(token) {
  return apiFetch_('/filtres-admin', { token });
}

export async function getFitxaMaquina(token, machineId, dataInici, dataFi, filtres) {
  return apiFetch_(`/maquines/${machineId}/fitxa` + qs_({ ...filtres, dataInici, dataFi }), { token });
}

export async function getProduccio(token, machineId, filtres) {
  return apiFetch_(`/maquines/${machineId}/produccio` + qs_(filtres), { token });
}

export async function getDetallMaquina(token, machineId, dataInici, dataFi, filtres) {
  const [fitxa, produccio] = await Promise.all([
    apiFetch_(`/maquines/${machineId}/fitxa` + qs_({ dataInici, dataFi }), { token }),
    apiFetch_(`/maquines/${machineId}/produccio` + qs_(filtres), { token }),
  ]);
  return { fitxa, produccio };
}

// Substitueix N crides getDetallMaquina (una per màquina) per una única
// petició: retorna { [machineId]: { fitxa, produccio } }. Si es passa
// machineIds (array), només calcula i torna aquest subconjunt.
export async function getFitxesMaquinesBulk(token, filtres) {
  return apiFetch_('/maquines-fitxes' + qs_(filtres || {}), { token });
}

// Versió barata per màquina (sense recalcular fitxa/produccio sencers), per
// decidir al client quines màquines cal refrescar de veritat.
export async function getFitxesMaquinesVersions(token) {
  return apiFetch_('/maquines-fitxes-versions', { token });
}

export async function getConsums(token, machineId, tipus, dataInici, dataFi) {
  return apiFetch_(`/maquines/${machineId}/consums` + qs_({ tipus, dataInici, dataFi }), { token });
}

export async function getCronologia(token, machineId, data) {
  return apiFetch_(`/maquines/${machineId}/cronologia` + qs_({ data }), { token });
}

export async function getCronologiaRang(token, machineId, dataInici, dataFi) {
  return apiFetch_(`/maquines/${machineId}/cronologia-rang` + qs_({ dataInici, dataFi }), { token });
}

export async function getDispositiusLog(token) {
  return apiFetch_('/dispositius-log', { token });
}

export async function getPreusConsum(token) {
  return apiFetch_('/preus-consum', { token });
}

export async function setPreusConsum(token, aire, electric) {
  return apiFetch_('/preus-consum', { method: 'PATCH', token, body: { aire, electric } });
}

export async function versioDades(token) {
  const d = await apiFetch_('/versio', { token });
  return d.v || 0;
}

// ── Admin: Projectes ERP / NexaControl / Clients ──────────────────────────
export async function getProjectesErp(token) {
  return apiFetch_('/projectes-erp', { token });
}
export async function activarNexaControl(token, projecteId, descripcio, client, preuPlus) {
  return apiFetch_('/projectes-nexa-control/activar', { method: 'POST', token, body: { projecteId, descripcio, client, preuPlus } });
}
export async function actualitzarDataImplementacio(token, projecteId, novaData) {
  return apiFetch_(`/projectes-erp/${projecteId}/data-implementacio`, { method: 'PATCH', token, body: { novaData } });
}
export async function actualitzarPreuPlus(token, projecteId, preu) {
  return apiFetch_(`/projectes-erp/${projecteId}/preu-plus`, { method: 'PATCH', token, body: { preu } });
}
export async function canviarActivacioProjecte(token, projecteId, actiu) {
  return apiFetch_(`/projectes-erp/${projecteId}/actiu`, { method: 'PATCH', token, body: { actiu } });
}
export async function canviarVisibilitatClient(token, projecteId, visible) {
  return apiFetch_(`/projectes-erp/${projecteId}/visible`, { method: 'PATCH', token, body: { visible } });
}
export async function canviarMostrarReferencia(token, projecteId, mostrar) {
  return apiFetch_(`/projectes-erp/${projecteId}/mostrar-referencia`, { method: 'PATCH', token, body: { mostrar } });
}
export async function canviarControlCabal(token, projecteId, actiu) {
  return apiFetch_(`/projectes-erp/${projecteId}/control-cabal`, { method: 'PATCH', token, body: { actiu } });
}
export async function canviarControlConsumElectric(token, projecteId, actiu) {
  return apiFetch_(`/projectes-erp/${projecteId}/control-consum-electric`, { method: 'PATCH', token, body: { actiu } });
}
export async function canviarTornsProjecte(token, projecteId, torns) {
  return apiFetch_(`/projectes-erp/${projecteId}/torns`, { method: 'PATCH', token, body: { torns } });
}
export async function setIdiomaOverride(token, client, idioma) {
  return apiFetch_('/clients-nexa/idioma', { method: 'PATCH', token, body: { client, idioma } });
}
export async function getClientsFacturacio(token) {
  return apiFetch_('/clients-facturacio', { token });
}
export async function actualitzarPreuBase(token, client, preuBase) {
  return apiFetch_('/clients-nexa/preu-base', { method: 'PATCH', token, body: { client, preuBase } });
}
