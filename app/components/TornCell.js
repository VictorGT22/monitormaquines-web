import { DICC } from '../lib/i18n';

const COLORS_TORN = { Matí: '#f6c453', Tarda: '#4da3ff', Nit: '#b582f8' };

// Cel·la de torn compartida per la taula de Paradas i la d'Alarmes —
// mateix marcatge (punt de color + etiqueta) que ja feia servir la taula
// d'Alarmes, ara reutilitzat en lloc de duplicar-lo.
export default function TornCell({ torns, idioma }) {
  const llista = (torns || []).filter(Boolean);
  if (!llista.length) return <span>—</span>;
  return llista.map((tn) => (
    <span key={tn} className="torn-cell-item">
      <span className="torn-dot" style={{ background: COLORS_TORN[tn] || '#8a95a5' }}></span>
      {DICC[idioma]?.torns?.[tn] || tn}
    </span>
  ));
}
