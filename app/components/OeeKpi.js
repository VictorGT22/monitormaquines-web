import { t } from '../lib/i18n';

// Arc de 270° (SVG): dasharray fix (part visible del cercle), dashoffset
// variable segons el % real — port de setArcOee_(), com a valors derivats
// en lloc de mutació imperativa del DOM.
function arcProps(radi, fraccio) {
  const circumferencia = 2 * Math.PI * radi;
  const arc = circumferencia * 0.75;
  return {
    strokeDasharray: arc + ' ' + circumferencia,
    strokeDashoffset: arc * (1 - Math.max(0, Math.min(1, fraccio || 0))),
  };
}

// KPI "OEE" amb popover (mostrat per CSS :hover/:focus-visible, sense JS)
// que desglossa Disponibilitat/Qualitat amb dos arcs SVG concèntrics.
export default function OeeKpi({ idioma, etiquetaId, disponibilitat, qualitat, oee }) {
  const pct = (v) => (v * 100).toFixed(0) + '%';
  return (
    <div className="kpi kpi-oee-wrap" tabIndex={0}>
      <div className="kpi-oee-border"><span></span><span></span></div>
      <div className="valor">{pct(oee)}</div>
      <div className="etiqueta">{t(idioma, 'kpi_oee')}</div>
      <div className="oee-popover">
        <svg viewBox="0 0 100 100" width="160" height="160">
          <circle className="oee-track" cx="50" cy="50" r="40" strokeDasharray="188.5 62.83" />
          <circle className="oee-arc oee-arc-disp" cx="50" cy="50" r="40" {...arcProps(40, disponibilitat)} />
          <circle className="oee-track" cx="50" cy="50" r="30" strokeDasharray="141.37 47.12" />
          <circle className="oee-arc oee-arc-qual" cx="50" cy="50" r="30" {...arcProps(30, qualitat)} />
          <text x="50" y="55" textAnchor="middle" className="oee-center">{pct(oee)}</text>
        </svg>
        <div className="oee-legend">
          <div><i className="oee-dot disp"></i><span>{t(idioma, 'oee_disponibilitat')}</span><b>{pct(disponibilitat)}</b></div>
          <div><i className="oee-dot qual"></i><span>{t(idioma, 'oee_qualitat')}</span><b>{pct(qualitat)}</b></div>
        </div>
      </div>
    </div>
  );
}
