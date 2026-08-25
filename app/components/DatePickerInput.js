'use client';

import { useEffect, useRef, useState } from 'react';
import { formatIso_ } from '../lib/format';

// Port de obrirDatePicker_/renderDatePopup_/seleccionarData_ — a l'original
// era un únic popup singleton compartit per tots els .date-input; aquí cada
// instància porta el seu propi popup (més senzill en React, mateix
// comportament visual: calendari sota l'input, dia d'avui marcat, tancar en
// clicar fora).
const MESOS_CALENDARI = ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'];

export default function DatePickerInput({ id, value, onChange, placeholder }) {
  const [obert, setObert] = useState(false);
  const [vistaAny, setVistaAny] = useState(new Date().getFullYear());
  const [vistaMes, setVistaMes] = useState(new Date().getMonth());
  const wrapRef = useRef(null);

  useEffect(() => {
    function ferClicFora(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setObert(false);
    }
    document.addEventListener('click', ferClicFora);
    return () => document.removeEventListener('click', ferClicFora);
  }, []);

  function obrir() {
    const base = value ? new Date(value + 'T00:00:00') : new Date();
    setVistaAny(base.getFullYear());
    setVistaMes(base.getMonth());
    setObert(true);
  }

  function seleccionar(iso) {
    onChange(iso);
    setObert(false);
  }

  function mesAnterior() {
    setVistaMes((m) => { if (m === 0) { setVistaAny((a) => a - 1); return 11; } return m - 1; });
  }
  function mesSeguent() {
    setVistaMes((m) => { if (m === 11) { setVistaAny((a) => a + 1); return 0; } return m + 1; });
  }

  const avuiIso = formatIso_(new Date());
  const primerDia = new Date(vistaAny, vistaMes, 1);
  const inici = (primerDia.getDay() + 6) % 7; // dilluns=0
  const diesMes = new Date(vistaAny, vistaMes + 1, 0).getDate();
  const dies = [];
  for (let i = 0; i < inici; i++) dies.push(null);
  for (let d = 1; d <= diesMes; d++) dies.push(formatIso_(new Date(vistaAny, vistaMes, d)));

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        id={id}
        className="date-input"
        readOnly
        placeholder={placeholder}
        value={value || ''}
        onClick={obrir}
      />
      {obert && (
        <div className="date-popup show" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0 }}>
          <div className="date-popup-head">
            <button type="button" onClick={mesAnterior}>&lsaquo;</button>
            <span id="date-month-label">{MESOS_CALENDARI[vistaMes]} {vistaAny}</span>
            <button type="button" onClick={mesSeguent}>&rsaquo;</button>
          </div>
          <div className="date-popup-dow">
            <span>Dl</span><span>Dt</span><span>Dc</span><span>Dj</span><span>Dv</span><span>Ds</span><span>Dg</span>
          </div>
          <div className="date-popup-days">
            {dies.map((iso, i) => iso ? (
              <span
                key={iso}
                className={'date-day' + (iso === avuiIso ? ' avui' : '') + (iso === value ? ' seleccionat' : '')}
                onClick={() => seleccionar(iso)}
              >
                {Number(iso.slice(8, 10))}
              </span>
            ) : <span key={'buit' + i} />)}
          </div>
          <div className="date-popup-foot">
            <button type="button" onClick={() => seleccionar(avuiIso)}>Avui</button>
            <button type="button" onClick={() => seleccionar('')}>Esborrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
