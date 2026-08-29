'use client';

import { useEffect, useRef, useState } from 'react';

const HORES = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export default function TimePickerInput({ value, onChange, ariaLabel, error }) {
  const [obert, setObert] = useState(false);
  const [hora, minut] = String(value || '00:00').split(':');
  const [horaTemporal, setHoraTemporal] = useState(hora || '00');
  const [minutTemporal, setMinutTemporal] = useState(minut || '00');
  const wrapRef = useRef(null);

  useEffect(() => {
    function clicFora(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setObert(false);
    }
    document.addEventListener('pointerdown', clicFora);
    return () => document.removeEventListener('pointerdown', clicFora);
  }, []);

  function obrir() {
    setHoraTemporal(hora || '00');
    setMinutTemporal(MINUTS.includes(minut) ? minut : '00');
    setObert(true);
  }

  function aplicar() {
    onChange(`${horaTemporal}:${minutTemporal}`);
    setObert(false);
  }

  return <div className="time-picker-wrap" ref={wrapRef}>
    <button type="button" className={'time-input' + (error ? ' error' : '')} onClick={obrir} aria-label={ariaLabel} aria-expanded={obert}>
      {value || '--:--'}<span className="time-input-icona" aria-hidden="true" />
    </button>
    {error && <span className="time-input-error" role="alert">{error}</span>}
    {obert && <div className="time-popup date-popup show">
      <div className="time-popup-cap"><span>Seleccionar hora</span><strong>{horaTemporal}:{minutTemporal}</strong></div>
      <span className="time-popup-label">Hora</span>
      <div className="time-popup-grid time-popup-hores" aria-label="Hores">
        {HORES.map(h => <button type="button" key={h} className={h === horaTemporal ? 'seleccionat' : ''} onClick={() => setHoraTemporal(h)}>{h}</button>)}
      </div>
      <span className="time-popup-label">Minuts</span>
      <div className="time-popup-grid time-popup-minuts" aria-label="Minuts">
        {MINUTS.map(m => <button type="button" key={m} className={m === minutTemporal ? 'seleccionat' : ''} onClick={() => setMinutTemporal(m)}>{m}</button>)}
      </div>
      <div className="time-popup-accions"><button type="button" onClick={() => setObert(false)}>Cancel·lar</button><button type="button" className="primari" onClick={aplicar}>Aplicar</button></div>
    </div>}
  </div>;
}
