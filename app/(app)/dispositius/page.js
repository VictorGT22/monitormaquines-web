'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { t } from '../../lib/i18n';
import { formatarDataHora_ } from '../../lib/format';

function horaLabel(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ca', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function GraficConnectivitat({ serie }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Chart || !canvasRef.current) return;
    const etiquetes = (serie || []).map(s => {
      const d = new Date(s.timestamp);
      return d.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });
    });
    const connectats = (serie || []).map(s => s.connectats);
    const inactius = (serie || []).map(s => s.inactius);

    if (chartRef.current) {
      chartRef.current.data.labels = etiquetes;
      chartRef.current.data.datasets[0].data = connectats;
      chartRef.current.data.datasets[1].data = inactius;
      chartRef.current.update();
      return;
    }
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: etiquetes,
        datasets: [
          {
            label: 'Connectats',
            data: connectats,
            borderColor: '#34d17a',
            backgroundColor: 'rgba(52,209,122,0.08)',
            tension: 0.3, fill: true, pointRadius: 2,
          },
          {
            label: 'Inactius',
            data: inactius,
            borderColor: '#8a95a5',
            backgroundColor: 'rgba(138,149,165,0.07)',
            tension: 0.3, fill: true, pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { ticks: { color: '#8a95a5', maxTicksLimit: 8 }, grid: { color: '#2c343f' } },
          y: { ticks: { color: '#8a95a5', precision: 0 }, grid: { color: '#2c343f' }, beginAtZero: true },
        },
      },
    });
  }, [serie]);

  useEffect(() => () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } }, []);

  return (
    <div className="grafic-connectivitat-wrap" style={{ position: 'relative', height: 160 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function DispositiusPage() {
  const { token, sessio, errorSessio } = useAuth();
  const idioma = sessio?.idioma || 'ca';
  const [dades, setDades] = useState(null);
  const [carregant, setCarregant] = useState(true);

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      setDades(await api.getDispositiusLog(token));
    } catch (err) {
      errorSessio(err);
    } finally {
      setCarregant(false);
    }
  }, [token, errorSessio]);

  useEffect(() => { carregar(); }, [carregar]);

  const dispositius = dades?.dispositius || [];
  const sessionsUsuaris = dades?.sessionsUsuaris || [];
  const serie = dades?.serie || [];
  const dies = dades?.dies || 5;

  return (
    <div id="dispositius-view">
      <div className="dispositius-titol-row">
        <h2>{t(idioma, 'dispositius_titol')}</h2>
        <span className="dispositius-dies-badge">Últims {dies} dies</span>
      </div>

      {/* Chart legend */}
      <div className="dispositius-llegenda">
        <span className="llegenda-item">
          <span className="llegenda-dot" style={{ background: '#34d17a' }} />
          {t(idioma, 'dispositius_connectats')}
        </span>
        <span className="llegenda-item">
          <span className="llegenda-dot" style={{ background: '#8a95a5' }} />
          {t(idioma, 'dispositius_inactius')}
        </span>
      </div>

      {carregant ? (
        <div className="skeleton-card" style={{ height: 160 }} />
      ) : (
        <GraficConnectivitat serie={serie} />
      )}

      {/* Màquines table */}
      <h3 className="dispositius-seccio">{t(idioma, 'dispositius_maquines_titol')}</h3>
      {carregant ? (
        <div className="skeleton-card" style={{ height: 100 }} />
      ) : !dispositius.length ? (
        <div className="empty-state">{t(idioma, 'buit_dades')}</div>
      ) : (
        <div className="taula-scroll">
          <table className="taula-dispositius">
            <thead>
              <tr>
                <th>{t(idioma, 'dispositius_maquina')}</th>
                <th>{t(idioma, 'dispositius_client')}</th>
                <th>{t(idioma, 'dispositius_estat')}</th>
                <th>{t(idioma, 'dispositius_inactiu_5d')}</th>
                <th>{t(idioma, 'dispositius_ultima_connexio')}</th>
              </tr>
            </thead>
            <tbody>
              {dispositius.map(d => (
                <tr key={d.machineId + '_' + d.tenantId}>
                  <td>
                    <span className="dispositiu-nom">{d.nom}</span>
                    <span className="dispositiu-id">{d.machineId}</span>
                  </td>
                  <td>{d.clientNom}</td>
                  <td>
                    <span className={'estat-badge estat-' + (d.estatActual || 'incomunicada')}>
                      {d.estatActual || 'incomunicada'}
                    </span>
                  </td>
                  <td>
                    {d.horesInactiu != null ? (
                      <span className={d.horesInactiu > 24 ? 'text-warning' : ''}>
                        {Math.round(d.horesInactiu)}h
                      </span>
                    ) : '—'}
                  </td>
                  <td>{d.ultimaConnexio ? horaLabel(d.ultimaConnexio) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Usuaris table */}
      {sessionsUsuaris.length > 0 && (
        <>
          <h3 className="dispositius-seccio">{t(idioma, 'dispositius_usuaris_titol')}</h3>
          <div className="taula-scroll">
            <table className="taula-dispositius">
              <thead>
                <tr>
                  <th>{t(idioma, 'dispositius_usuari')}</th>
                  <th>{t(idioma, 'dispositius_client')}</th>
                  <th>{t(idioma, 'dispositius_actius')}</th>
                  <th>{t(idioma, 'dispositius_ultima_activitat')}</th>
                </tr>
              </thead>
              <tbody>
                {sessionsUsuaris.map(s => (
                  <tr key={s.email + '_' + s.tenantId}>
                    <td>
                      <span className="dispositiu-nom">{s.email}</span>
                      {s.rol && <span className="chip-rol">{s.rol}</span>}
                    </td>
                    <td>{s.clientNom}</td>
                    <td>{s.dispositiusActius ?? 0}</td>
                    <td>{s.ultimaActivitat ? horaLabel(s.ultimaActivitat) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
