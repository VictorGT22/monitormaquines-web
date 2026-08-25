'use client';

import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { formatarData_ } from '../lib/format';
import { t, DICC } from '../lib/i18n';

const COLORS_TORN = { Matí: '#f6c453', Tarda: '#4da3ff', Nit: '#b582f8' };

// Quadradet ple (o mig blanc partit en diagonal per "Merma") per al tooltip
// del gràfic — es dibuixa com a <canvas> perquè els CanvasPattern no els
// accepta el color del tooltip de Chart.js, però un canvas com a pointStyle sí.
function quadratTooltip_(color, diagonal) {
  const mida = 12;
  const c = document.createElement('canvas');
  c.width = mida; c.height = mida;
  const cx = c.getContext('2d');
  if (diagonal) {
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, mida, mida);
    cx.fillStyle = color;
    cx.beginPath();
    cx.moveTo(0, mida); cx.lineTo(mida, mida); cx.lineTo(mida, 0); cx.closePath(); cx.fill();
  } else {
    cx.fillStyle = color;
    cx.fillRect(0, 0, mida, mida);
  }
  return c;
}

// Port de renderGraficProduccio_ + mostrarTooltipDia_ — línia de peces
// bones/merma per dia, desglossada per torn quan n'hi ha algun de seleccionat.
const GraficProduccio = forwardRef(function GraficProduccio({ perDia, perDiaPerTorn, tornsActius, idioma }, ref) {
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
    const etiquetes = (perDia || []).map((d) => formatarData_(d.data));
    const dadesBones = (perDia || []).map((d) => d.pecesBones);
    const dadesMerma = (perDia || []).map((d) => d.pecesMerma);
    const datasets = tornsActius.length
      ? tornsActius.flatMap((torn) => [
        {
          label: DICC[idioma].torns[torn] + ' — ' + t(idioma, 'kpi_peces'),
          data: (perDiaPerTorn || []).map((d) => (d[torn] || {}).pecesBones || 0),
          borderColor: COLORS_TORN[torn], backgroundColor: 'transparent', tension: .3, fill: false, pointRadius: 2,
        },
        {
          label: DICC[idioma].torns[torn] + ' — ' + t(idioma, 'kpi_merma'),
          data: (perDiaPerTorn || []).map((d) => (d[torn] || {}).pecesMerma || 0),
          borderColor: COLORS_TORN[torn], backgroundColor: 'transparent', borderDash: [6, 4], tension: .3, fill: false, pointRadius: 2,
        },
      ])
      : [
        { label: t(idioma, 'kpi_peces'), data: dadesBones, borderColor: '#34d17a', backgroundColor: 'rgba(52,209,122,.12)', tension: .3, fill: true, pointRadius: 2 },
        { label: t(idioma, 'kpi_merma'), data: dadesMerma, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.1)', tension: .3, fill: true, pointRadius: 2 },
      ];

    if (chartRef.current) {
      chartRef.current.data.labels = etiquetes;
      chartRef.current.data.datasets = datasets;
      chartRef.current.update();
      return;
    }
    if (typeof window === 'undefined' || !window.Chart || !canvasRef.current) return;
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'line',
      data: { labels: etiquetes, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            usePointStyle: true, boxWidth: 12, boxHeight: 12,
            callbacks: {
              labelPointStyle: (context) => {
                const esMerma = (context.dataset.label || '').indexOf(t(idioma, 'kpi_merma')) !== -1;
                return { pointStyle: quadratTooltip_(context.dataset.borderColor, esMerma), rotation: 0 };
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: '#8a95a5' }, grid: { color: '#2c343f' } },
          y: { ticks: { color: '#8a95a5' }, grid: { color: '#2c343f' }, beginAtZero: true },
        },
      },
    });
  }, [perDia, perDiaPerTorn, tornsActius, idioma]);

  useEffect(() => () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } }, []);

  return <canvas ref={canvasRef} height="90" />;
});

export default GraficProduccio;
