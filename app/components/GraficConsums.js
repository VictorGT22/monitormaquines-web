'use client';

import { useEffect, useRef, forwardRef } from 'react';
import { formatarData_, formatarNumero_ } from '../lib/format';
import { t } from '../lib/i18n';

const COLORS_CONSUM = { aire: '#4da3ff', electric: '#f6c453' };

const GraficConsums = forwardRef(function GraficConsums({ consums, idioma }, ref) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !consums) return;
    const { consumPerTipus, produccioPerDia, tipusActius } = consums;
    const actius = tipusActius || [];
    const totsDies = actius.flatMap(tp => (consumPerTipus?.[tp] || []).map(d => d.data));
    const etiquetesData = [...new Set(totsDies.concat((produccioPerDia || []).map(d => d.data)))].sort();
    const etiquetes = etiquetesData.map(formatarData_);
    const prodPerData = {};
    (produccioPerDia || []).forEach(d => { prodPerData[d.data] = d.pecesBones; });

    const datasets = actius.map(tipus => {
      const perData = {};
      (consumPerTipus?.[tipus] || []).forEach(d => { perData[d.data] = d.valor; });
      return {
        label: t(idioma, tipus === 'electric' ? 'consum_electric' : 'consum_aire'),
        data: etiquetesData.map(d => perData[d] || 0),
        borderColor: COLORS_CONSUM[tipus],
        backgroundColor: COLORS_CONSUM[tipus] + '20',
        tension: .3, fill: true, pointRadius: 2, yAxisID: 'yConsum',
      };
    });
    datasets.push({
      label: t(idioma, 'kpi_peces'),
      data: etiquetesData.map(d => prodPerData[d] || 0),
      borderColor: '#34d17a', backgroundColor: 'transparent',
      tension: .3, fill: false, pointRadius: 2, yAxisID: 'yProduccio',
    });

    if (chartRef.current) {
      chartRef.current.data.labels = etiquetes;
      chartRef.current.data.datasets = datasets;
      chartRef.current.update();
      return;
    }
    if (typeof window === 'undefined' || !window.Chart) return;
    chartRef.current = new window.Chart(canvas, {
      type: 'line',
      data: { labels: etiquetes, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { color: '#8a95a5', usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
        },
        scales: {
          x: { ticks: { color: '#8a95a5' }, grid: { color: '#2c343f' } },
          yConsum: { position: 'left', ticks: { color: '#8a95a5' }, grid: { color: '#2c343f' }, beginAtZero: true },
          yProduccio: { position: 'right', ticks: { color: '#8a95a5' }, grid: { display: false }, beginAtZero: true },
        },
      },
    });
  }, [consums, idioma]);

  useEffect(() => () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } }, []);

  return <canvas ref={canvasRef} height="90" />;
});

export function KpisConsums({ consums, preus, idioma }) {
  if (!consums || !(consums.tipusActius || []).length) {
    return <div className="empty-state">{t(idioma, 'buit_dades')}</div>;
  }
  const { totalPerTipus, totalPecesBones, tipusActius } = consums;
  const peces = totalPecesBones || 0;
  return (
    <div className="kpi-row">
      {(tipusActius || []).map(tipus => {
        const total = (totalPerTipus?.[tipus]) || 0;
        const perPeca = peces ? total / peces : 0;
        const preu = (preus && preus[tipus]) || 0;
        const unitat = t(idioma, tipus === 'electric' ? 'unitat_electric' : 'unitat_aire');
        const valor = formatarNumero_(idioma, perPeca, 2) + ' ' + unitat + ' / ' + t(idioma, 'mitjana_peca');
        const sota = preu
          ? (perPeca * preu).toFixed(3) + ' € / ' + t(idioma, 'mitjana_peca')
          : t(idioma, tipus === 'electric' ? 'consum_electric' : 'consum_aire');
        return (
          <div className="kpi" key={tipus}>
            <div className="valor">{valor}</div>
            <div className="etiqueta">{sota}</div>
          </div>
        );
      })}
    </div>
  );
}

export default GraficConsums;
