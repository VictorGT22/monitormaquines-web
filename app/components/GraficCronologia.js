'use client';

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { formatarData_ } from '../lib/format';
import { t } from '../lib/i18n';

const COLORS_ESTAT = { marxa: '#34d17a', alarma: '#ef4444', parada: '#f5a623', incomunicada: '#8a95a5' };

const FORMATADOR_MADRID = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function minutsDiaMadrid(iso, diaSeleccionat) {
  const parts = Object.fromEntries(
    FORMATADOR_MADRID.formatToParts(new Date(iso))
      .filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)])
  );
  const diaLocal = `${String(parts.year).padStart(4,'0')}-${String(parts.month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`;
  if (diaLocal < diaSeleccionat) return 0;
  if (diaLocal > diaSeleccionat) return 1440;
  return parts.hour * 60 + parts.minute + parts.second / 60;
}

function fusionarSegments(segments) {
  return (segments || []).slice()
    .sort((a, b) => new Date(a.inici) - new Date(b.inici))
    .reduce((res, seg) => {
      const ant = res[res.length - 1];
      const gap = ant ? new Date(seg.inici) - new Date(ant.fi) : Infinity;
      if (ant && ant.estat === seg.estat && gap >= 0 && gap <= 1000) {
        ant.fi = seg.fi;
        ant.referencies = Array.from(new Set([].concat(ant.referencies || [], seg.referencies || [])));
        ant.alarmes = [].concat(ant.alarmes || [], seg.alarmes || []);
        ant.parades = [].concat(ant.parades || [], seg.parades || []);
      } else {
        res.push({ ...seg });
      }
      return res;
    }, []);
}

function formatMinutsHora(min) {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(Math.round(min % 60)).padStart(2, '0');
}

function formatMinutsHoraPrecisa(min, ambSegons) {
  const totalS = Math.max(0, Math.min(86400, Math.round(min * 60)));
  const h = Math.floor(totalS / 3600);
  const mm = Math.floor((totalS % 3600) / 60);
  const ss = totalS % 60;
  const base = String(h).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
  return ambSegons ? base + ':' + String(ss).padStart(2,'0') : base;
}

function etiquetaEstat(estat, idioma) {
  if (estat === 'marxa') return t(idioma, 'cronologia_producint');
  if (estat === 'alarma') return t(idioma, 'cronologia_alarma');
  if (estat === 'incomunicada') return t(idioma, 'cronologia_incomunicada');
  return t(idioma, 'cronologia_parada');
}

function prepararDies(dies, tornsActius, referencia) {
  return (dies || []).map(dia => {
    let segments = fusionarSegments(dia.segments || []);
    if (referencia) {
      segments = segments.filter(s => Array.isArray(s.referencies) && s.referencies.includes(referencia));
    }
    if (tornsActius && tornsActius.length) {
      const rangs = tornsActius.flatMap(torn => {
        if (torn === 'Matí') return [{ inici: 360, fi: 840 }];
        if (torn === 'Tarda') return [{ inici: 840, fi: 1320 }];
        if (torn === 'Nit') return [{ inici: 0, fi: 360 }, { inici: 1320, fi: 1440 }];
        return [];
      });
      segments = segments.flatMap(seg => {
        const ini = minutsDiaMadrid(seg.inici, dia.dia);
        const fi = minutsDiaMadrid(seg.fi, dia.dia);
        if (fi <= ini) return [];
        return rangs.map(r => {
          const ti = Math.max(ini, r.inici);
          const tf = Math.min(fi, r.fi);
          if (tf <= ti) return null;
          return { ...seg, __minInici: ti, __minFi: tf };
        }).filter(Boolean);
      });
    }
    return { ...dia, segments };
  }).filter(dia => dia.segments.length > 0);
}

function kpiText(dia, idioma) {
  const totals = { marxa: 0, alarma: 0, parada: 0, incomunicada: 0 };
  (dia.segments || []).forEach(s => {
    if (totals[s.estat] === undefined) return;
    totals[s.estat] += typeof s.__minInici === 'number'
      ? (s.__minFi - s.__minInici) / 60
      : (new Date(s.fi) - new Date(s.inici)) / 3600000;
  });
  const fmt = h => { const m = Math.max(0, Math.round(h * 60)); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2,'0') + 'm'; };
  return [
    t(idioma,'cronologia_producint') + ': ' + fmt(totals.marxa),
    t(idioma,'cronologia_alarma') + ': ' + fmt(totals.alarma),
    t(idioma,'cronologia_parada') + ': ' + fmt(totals.parada),
    t(idioma,'cronologia_incomunicada') + ': ' + fmt(totals.incomunicada),
  ].join(' · ');
}

const GraficCronologia = forwardRef(function GraficCronologia(
  { dies, tornsActius, referencia, idioma, onJumpHistoric, onJumpParades },
  ref
) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const lupaRef = useRef(null);
  const lupaStatRef = useRef(null);
  const lupaHoraRef = useRef(null);
  const lupaTramsRef = useRef(null);
  const lupaExtraRef = useRef(null);
  const lupaTancamentRef = useRef(null);
  const [diesProcessats, setDiesProcessats] = useState([]);

  useEffect(() => { if (lupaRef.current) lupaRef.current.hidden = true; }, []);

  useImperativeHandle(ref, () => ({
    resaltarSegment(timestampInici) {
      const chart = chartRef.current;
      if (!chart || !timestampInici) return;
      const dades = chart.data.datasets[0]?.data || [];
      const index = dades.findIndex(d =>
        (d.alarmes || []).some(a => a.timestampInici === timestampInici) ||
        (d.parades || []).some(p => p.timestampInici === timestampInici)
      );
      if (index === -1) return;
      const els = chart.data.datasets.map((_, di) => ({ datasetIndex: di, index }));
      const punt = chart.getDatasetMeta(0).data[index];
      chart.setActiveElements(els);
      chart.tooltip.setActiveElements(els, { x: punt ? punt.x : 0, y: punt ? punt.y : 0 });
      chart.update();
    },
  }));

  useEffect(() => {
    const dp = prepararDies(dies, tornsActius, referencia);
    setDiesProcessats(dp);

    const dataset = [];
    dp.forEach(dia => {
      (dia.segments || []).forEach(s => {
        const mi = typeof s.__minInici === 'number' ? s.__minInici : minutsDiaMadrid(s.inici, dia.dia);
        const mf = typeof s.__minFi === 'number' ? s.__minFi : minutsDiaMadrid(s.fi, dia.dia);
        if (mf <= mi) return;
        dataset.push({ x: [mi, mf], y: dia.etiqueta, estat: s.estat, referencies: s.referencies, alarmes: s.alarmes, parades: s.parades });
      });
    });

    const labels = dp.map(d => d.etiqueta);
    const canvas = canvasRef.current;
    const lupa = lupaRef.current;
    if (!canvas) return;

    if (canvas.parentElement) {
      canvas.parentElement.style.height = Math.max(120, Math.min(420, 72 + labels.length * 34)) + 'px';
    }
    canvas.style.display = dataset.length ? '' : 'none';

    function cancelLupa() { if (lupaTancamentRef.current) { clearTimeout(lupaTancamentRef.current); lupaTancamentRef.current = null; } }
    function programarTancamentLupa() {
      if (lupaTancamentRef.current) return;
      lupaTancamentRef.current = setTimeout(() => { if (lupa) lupa.hidden = true; }, 1500);
    }

    function actualitzarLupa(raw) {
      const dur = raw.x[1] - raw.x[0];
      if (lupaStatRef.current) lupaStatRef.current.textContent = etiquetaEstat(raw.estat, idioma);
      if (lupaHoraRef.current) lupaHoraRef.current.textContent =
        formatMinutsHoraPrecisa(raw.x[0], true) + ' – ' + formatMinutsHoraPrecisa(raw.x[1], true) +
        ' · ' + t(idioma, 'cronologia_durada') + ': ' + Math.max(1, Math.round(dur * 60)) + ' s';
      const ex = [];
      if (raw.referencies?.length) ex.push(t(idioma,'f_referencia') + ': ' + raw.referencies.join(', '));
      if (raw.alarmes?.length) ex.push(...raw.alarmes.map(a => a.codi + ' — ' + a.missatge));
      if (raw.parades?.length) ex.push(...raw.parades.map(p => p.motiu));
      if (lupaExtraRef.current) lupaExtraRef.current.textContent = ex.join(' · ');
    }

    function obrirDetall(raw) {
      if (lupa) lupa.hidden = true;
      cancelLupa();
      if (raw.estat === 'alarma') onJumpHistoric?.(raw.alarmes?.[0]?.timestampInici);
      else if (raw.estat === 'parada') onJumpParades?.(raw.parades?.[0]?.timestampInici);
    }

    function mostrarLupa(event, actius, chart) {
      if (!actius.length) { programarTancamentLupa(); return; }
      const actiu = actius[0];
      const rawProper = chart.data.datasets[actiu.datasetIndex].data[actiu.index];
      const directes = chart.getElementsAtEventForMode(event.native, 'nearest', { intersect: true }, false);
      canvas.style.cursor = directes.length &&
        ['alarma','parada'].includes(chart.data.datasets[directes[0].datasetIndex].data[directes[0].index].estat)
        ? 'pointer' : 'default';
      if (directes.length) {
        const rawDir = chart.data.datasets[directes[0].datasetIndex].data[directes[0].index];
        if ((rawDir.x[1] - rawDir.x[0]) >= 4) { programarTancamentLupa(); return; }
      }
      const el = chart.getDatasetMeta(actiu.datasetIndex).data[actiu.index];
      if (Math.abs(event.y - el.y) > Math.max(16, (Number(el.height) || 28) / 2 + 8)) { programarTancamentLupa(); return; }
      const cursorMin = chart.scales.x.getValueForPixel(event.x);
      const ini = Math.max(0, Math.min(1400, cursorMin - 20));
      const fi = ini + 40;
      const dadesFila = chart.data.datasets[actiu.datasetIndex].data.filter(d => d.y === rawProper.y);
      const curts = dadesFila.filter(d => (d.x[1] - d.x[0]) < 4 && d.x[0] < fi && d.x[1] > ini);
      if (!curts.length) { programarTancamentLupa(); return; }
      cancelLupa();
      const sel = curts.slice().sort((a, b) =>
        Math.abs((a.x[0]+a.x[1])/2 - cursorMin) - Math.abs((b.x[0]+b.x[1])/2 - cursorMin))[0];
      actualitzarLupa(sel);
      const trams = lupaTramsRef.current;
      if (trams) {
        trams.innerHTML = '';
        dadesFila.filter(d => d.x[0] < fi && d.x[1] > ini).forEach(d => {
          const acc = d.estat === 'alarma' || d.estat === 'parada';
          const barra = document.createElement('span');
          barra.className = 'cronologia-lupa-tram' + (d === sel ? ' actiu' : '') + (acc ? ' accionable' : '');
          barra.style.left = Math.max(0, (d.x[0]-ini)/40*100) + '%';
          barra.style.width = Math.max(2, Math.min(100,(d.x[1]-ini)/40*100) - Math.max(0,(d.x[0]-ini)/40*100)) + '%';
          barra.style.background = COLORS_ESTAT[d.estat];
          barra.setAttribute('aria-label', etiquetaEstat(d.estat, idioma) + ' ' + formatMinutsHoraPrecisa(d.x[0], true));
          if (acc) { barra.setAttribute('role','button'); barra.tabIndex = 0; }
          barra.addEventListener('mouseenter', () => { cancelLupa(); actualitzarLupa(d); });
          barra.addEventListener('focus', () => { cancelLupa(); actualitzarLupa(d); });
          if (acc) {
            barra.addEventListener('click', () => obrirDetall(d));
            barra.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); obrirDetall(d); } });
          }
          trams.appendChild(barra);
        });
        const cursor = document.createElement('span');
        cursor.className = 'cronologia-lupa-cursor';
        cursor.style.left = Math.max(0, Math.min(100, (cursorMin-ini)/40*100)) + '%';
        trams.appendChild(cursor);
        trams.onmousemove = e => {
          const rect = trams.getBoundingClientRect();
          cursor.style.left = Math.max(0, Math.min(100, (e.clientX-rect.left)/rect.width*100)) + '%';
        };
      }
      const wrap = canvas.parentElement;
      const x = Math.max(132, Math.min((wrap?.clientWidth||400)-132, canvas.offsetLeft + event.x));
      if (lupa) {
        lupa.style.left = x + 'px';
        lupa.style.top = (canvas.offsetTop + el.y - 26) + 'px';
        lupa.style.transform = 'translate(-50%, -100%)';
        lupa.hidden = false;
      }
    }

    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: dataset,
          backgroundColor: c => c.raw ? COLORS_ESTAT[c.raw.estat] : '#4da3ff',
          borderColor: c => c.raw ? COLORS_ESTAT[c.raw.estat] : '#4da3ff',
          borderWidth: 0, hoverBorderWidth: 0, minBarLength: 5, borderRadius: 0,
          borderSkipped: false, inflateAmount: 0, barThickness: 28, maxBarThickness: 28,
          categoryPercentage: 1, barPercentage: 1,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'nearest', axis: 'xy', intersect: false },
        onHover: mostrarLupa,
        onClick: (event, _, chart) => {
          const directes = chart.getElementsAtEventForMode(event.native, 'nearest', { intersect: true }, false);
          if (!directes.length) return;
          const raw = chart.data.datasets[directes[0].datasetIndex].data[directes[0].index];
          if (raw.estat === 'alarma' || raw.estat === 'parada') obrirDetall(raw);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'nearest', intersect: true,
            filter: c => { if (lupa && !lupa.hidden) return false; return (c.raw.x[1] - c.raw.x[0]) >= 4; },
            callbacks: {
              label: c => {
                const d = c.raw.x[1] - c.raw.x[0];
                return etiquetaEstat(c.raw.estat, idioma) + ': ' + formatMinutsHoraPrecisa(c.raw.x[0], d<2) + ' – ' + formatMinutsHoraPrecisa(c.raw.x[1], d<2);
              },
              afterLabel: c => {
                const s = Math.max(0, Math.round((c.raw.x[1]-c.raw.x[0])*60));
                const dur = s < 60 ? s + ' s' : (s/60).toFixed(1) + ' min';
                const ex = [t(idioma,'cronologia_durada') + ': ' + dur];
                if (c.raw.estat==='marxa' && c.raw.referencies?.length) ex.push(t(idioma,'f_referencia') + ': ' + c.raw.referencies.join(', '));
                if (c.raw.estat==='alarma' && c.raw.alarmes?.length) ex.push(...c.raw.alarmes.map(a => a.codi + ' — ' + a.missatge));
                if (c.raw.estat==='parada' && c.raw.parades?.length) ex.push(...c.raw.parades.map(p => p.motiu));
                return ex;
              },
            },
          },
        },
        scales: {
          x: { min: 0, max: 1440, ticks: { color: '#8a95a5', stepSize: 120, callback: formatMinutsHora }, grid: { color: '#2c343f' } },
          y: { ticks: { color: '#8a95a5' }, grid: { display: false } },
        },
      },
    };

    if (chartRef.current) {
      chartRef.current.data.labels = labels;
      chartRef.current.data.datasets = config.data.datasets;
      chartRef.current.update();
    } else if (typeof window !== 'undefined' && window.Chart && canvas) {
      chartRef.current = new window.Chart(canvas, config);
    }
    if (canvas) canvas.onmouseleave = () => programarTancamentLupa();
    if (lupa) {
      lupa.onmouseenter = () => cancelLupa();
      lupa.onmouseleave = () => programarTancamentLupa();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dies, tornsActius, referencia, idioma]);

  useEffect(() => () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } }, []);

  const claus = ['marxa','alarma','parada','incomunicada'];

  return (
    <div>
      <div className="cronologia-llegenda">
        {claus.map(c => (
          <span key={c} className="cronologia-chip">
            <i style={{ background: COLORS_ESTAT[c] }}></i>
            {etiquetaEstat(c, idioma)}
          </span>
        ))}
      </div>
      <div className="grafic-wrap cronologia-grafic-wrap" style={{ position: 'relative' }}>
        <canvas ref={canvasRef} />
        <div className="cronologia-lupa" ref={lupaRef} aria-live="polite">
          <div className="cronologia-lupa-estat" ref={lupaStatRef}></div>
          <div className="cronologia-lupa-hora" ref={lupaHoraRef}></div>
          <div className="cronologia-lupa-trams" ref={lupaTramsRef}></div>
          <div className="cronologia-lupa-extra" ref={lupaExtraRef}></div>
        </div>
      </div>
      {diesProcessats.length > 0 && (
        <div className="kpi-row">
          {diesProcessats.map((dia, i) => (
            <div className="kpi" key={i}>
              <div className="valor" style={{ fontSize: 13 }}>{kpiText(dia, idioma)}</div>
              <div className="etiqueta">{dia.etiqueta}</div>
            </div>
          ))}
        </div>
      )}
      {diesProcessats.length === 0 && dies?.length > 0 && (
        <div className="empty-state">{t(idioma, 'buit_dades')}</div>
      )}
    </div>
  );
});

export default GraficCronologia;
