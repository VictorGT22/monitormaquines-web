// Port de barraHtml_() — barra d'hores sobre 24h a la targeta de màquina.
export default function BarraDades({ etiqueta, classeOmpliment, hores }) {
  const percent = Math.min(100, Math.round((hores / 24) * 100));
  return (
    <div className="barra-row">
      <span className="barra-label">{etiqueta}</span>
      <div className="barra-track"><div className={'barra-fill ' + classeOmpliment} style={{ width: percent + '%' }} /></div>
      <span className="barra-valor">{hores}h/24h</span>
    </div>
  );
}
