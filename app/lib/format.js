// Port literal de les funcions formatar*/format* d'index.html.
export function formatIso_(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function formatarData_(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit' });
}

export function formatarDataHora_(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
}

export function formatarHoresMin_(minuts) {
  const total = Math.round(Number(minuts) || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

export function formatarNumero_(idioma, valor, decimals) {
  const loc = idioma === 'en' ? 'en-US' : (idioma === 'es' ? 'es-ES' : 'ca-ES');
  return new Intl.NumberFormat(loc, {
    minimumFractionDigits: decimals || 0,
    maximumFractionDigits: decimals || 0,
  }).format(Number(valor) || 0);
}

export function formatarDurada_(min, seg) {
  if (min > 0) return min;
  return (seg || 0) + 's';
}

// Mateix criteri d'"avui" que ja fa servir el backend (avuiISO a
// app-maquines.routes.js): data ISO en UTC, no la data local del navegador —
// cal mantenir el mateix criteri arreu perquè "avui" vulgui dir la mateixa
// data a tots els filtres de la fitxa (Producció, Paradas, Alarmes...).
export function avuiISO_() {
  return new Date().toISOString().slice(0, 10);
}

// Durada en minuts entre dos ISO — null si encara no ha acabat (fi buit).
export function calcularDuradaMin_(iniciIso, fiIso) {
  if (!iniciIso || !fiIso) return null;
  const ms = new Date(fiIso) - new Date(iniciIso);
  if (!(ms > 0)) return null;
  return { min: Math.round(ms / 60000), seg: Math.round(ms / 1000) };
}

export function formatEuros_(n) {
  return (Number(n) || 0).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
