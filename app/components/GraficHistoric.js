'use client';

import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { formatarData_ } from '../lib/format';
import { DICC } from '../lib/i18n';

const COLORS_TORN = { Matí: '#f6c453', Tarda: '#4da3ff', Nit: '#b582f8' };

// Port de renderGraficHistoric_ — barres apilades per torn, una barra per
// dia amb incidències. Retorna els dies agregats via onDiesCalculats perquè
// la pàgina pugui fer clic a una fila de la taula i saltar al dia correcte
// (mostrarTooltipHistoric_/realçarSegmentCronologia_).
const GraficHistoric = forwardRef(function GraficHistoric({ historic, idioma, onDiesCalculats }, ref) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const tooltipTimeoutRef = useRef(null);

  useImperativeHandle(ref, () => ({
    mostrarTooltip(index) {
      const chart = chartRef.current;
      if (!chart || !chart.data.datasets.length || index < 0) return;
      const elements = chart.data.datasets.map((ds, datasetIndex) => ({ datasetIndex, index }));
      const punt = chart.getDatasetMeta(0).data[index];
      chart.setActiveElements(elements);
      chart.tooltip.setActiveElements(elements, { x: punt ? punt.x : 0, y: punt ? punt.y : 0 });
      chart.update();
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = setTimeout(() => {
        chart.setActiveElements([]);
        chart.tooltip.setActiveElements([], { x: 0, y: 0 });
        chart.update();
      }, 2500);
    },
  }));

  useEffect(() => {
    const torns = Object.keys(COLORS_TORN);
    const perDiaMap = {};
    (historic || []).forEach((i) => {
      const key = i.timestampInici.slice(0, 10);
      if (!perDiaMap[key]) perDiaMap[key] = { data: i.timestampInici };
      (i.torns && i.torns.length ? i.torns : [i.torn]).forEach((t) => {
        perDiaMap[key][t] = (perDiaMap[key][t] || 0) + 1;
      });
    });
    const dies = Object.values(perDiaMap).sort((a, b) => new Date(a.data) - new Date(b.data));
    onDiesCalculats?.(dies);
    const etiquetes = dies.map((d) => formatarData_(d.data));
    const datasets = torns.map((torn) => ({
      label: DICC[idioma].torns[torn],
      data: dies.map((d) => d[torn] || 0),
      backgroundColor: COLORS_TORN[torn], borderRadius: 4, stack: 'incidencies', maxBarThickness: 40,
    }));

    if (chartRef.current) {
      chartRef.current.data.labels = etiquetes;
      chartRef.current.data.datasets = datasets;
      chartRef.current.update();
      return;
    }
    if (typeof window === 'undefined' || !window.Chart || !canvasRef.current) return;
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: { labels: etiquetes, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8a95a5', boxWidth: 12, boxHeight: 12 } } },
        scales: {
          x: { stacked: true, ticks: { color: '#8a95a5' }, grid: { color: '#2c343f' } },
          y: { stacked: true, ticks: { color: '#8a95a5', precision: 0 }, grid: { color: '#2c343f' }, beginAtZero: true },
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historic, idioma]);

  useEffect(() => () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } }, []);

  return <canvas ref={canvasRef} height="90" />;
});

export default GraficHistoric;
