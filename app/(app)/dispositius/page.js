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

function MetricIcon({ tipus }) {
  const paths = {
    usuaris: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6M16 7h5M18.5 4.5v5"/></>,
    dispositius: <><rect x="4" y="3" width="16" height="13" rx="2"/><path d="M9 21h6M12 16v5"/></>,
    clients: <><path d="M4 20V8l8-5 8 5v12"/><path d="M9 20v-6h6v6"/></>,
    maquines: <><path d="M4 20V9l5 3V8l5 3V5h6v15H4Z"/><path d="M8 16h2M14 16h2"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[tipus]}</svg>;
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

  useEffect(() => {
    const inici = setTimeout(carregar, 0);
    const interval = setInterval(carregar, 15000);
    return () => { clearTimeout(inici); clearInterval(interval); };
  }, [carregar]);

  const dispositius = dades?.dispositius || [];
  const sessionsUsuaris = dades?.sessionsUsuaris || [];
  const serie = dades?.serie || [];
  const dies = dades?.dies || 5;
  const totalDispositius = sessionsUsuaris.reduce((n, s) => n + (s.dispositiusActius || 0), 0);
  const clientsConnectats = new Set(sessionsUsuaris.map(s => s.tenantId).filter(Boolean)).size;

  return (
    <div id="dispositius-view">
      <div className="dispositius-titol-row">
        <div><span className="config-eyebrow">Control d’accés</span><h2>{t(idioma, 'dispositius_titol')}</h2><p className="page-subtitle">Supervisa les connexions actives, els límits de cada client i l’estat de les màquines.</p></div>
        <span className="dispositius-dies-badge">Últims {dies} dies</span>
      </div>

      <div className="device-kpis">
        <div className="device-kpi kpi-users"><span className="device-kpi-icon"><MetricIcon tipus="usuaris" /></span><span>Usuaris connectats</span><strong>{sessionsUsuaris.length}</strong></div>
        <div className="device-kpi kpi-devices"><span className="device-kpi-icon"><MetricIcon tipus="dispositius" /></span><span>Dispositius simultanis</span><strong>{totalDispositius}</strong></div>
        <div className="device-kpi kpi-clients"><span className="device-kpi-icon"><MetricIcon tipus="clients" /></span><span>Clients amb activitat</span><strong>{clientsConnectats}</strong></div>
        <div className="device-kpi kpi-machines"><span className="device-kpi-icon"><MetricIcon tipus="maquines" /></span><span>Màquines monitoritzades</span><strong>{dispositius.length}</strong></div>
      </div>

      <div className="dispositius-grafic-header">
        <div>
          <span className="dispositius-section-label">Activitat</span>
          <h3>Connectivitat recent</h3>
        </div>
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
      </div>

      {carregant ? (
        <div className="skeleton-card" style={{ height: 160 }} />
      ) : (
        <GraficConnectivitat serie={serie} />
      )}

      {/* Usuaris connectats */}
      <div className="section-title-row"><div><h3 className="dispositius-seccio">Usuaris connectats</h3><p>Una fila per usuari, amb tots els seus dispositius i l’origen aproximat de la connexió.</p></div><span className="live-chip"><i /> En directe</span></div>
      {carregant ? <div className="skeleton-card" style={{ height: 180 }} /> : !sessionsUsuaris.length ? <div className="empty-state">No hi ha usuaris connectats ara mateix.</div> : (
        <div className="taula-scroll connection-table-wrap"><table className="taula-dispositius connection-table"><thead><tr><th>Usuari</th><th>Client / pla</th><th>Dispositius</th><th>IP</th><th>Zona aproximada</th><th>Última activitat</th></tr></thead><tbody>
          {sessionsUsuaris.map(s => <tr key={s.email + '_' + s.tenantId}>
            <td><span className="dispositiu-nom">{s.email}</span><span className="chip-rol">{s.rol === 'supervisor' ? 'Administrador client' : s.rol === 'manteniment' ? 'Manteniment' : s.rol === 'admin' ? 'Administrador Nexa' : 'Usuari'}</span></td>
            <td><span className="dispositiu-nom">{s.clientNom}</span>{s.pla && <span className={'pla-badge pla-' + s.pla}>{s.pla}</span>}</td>
            <td><strong className="device-count">{s.dispositiusActius ?? 0}{s.dispositiusMaxims ? ` / ${s.dispositiusMaxims}` : ''}</strong></td>
            <td><div className="connection-stack">{s.dispositius.map(d => <span key={d.deviceId}>{d.ip || 'IP no disponible'}{d.seguretatIp?.etiqueta && <small className="ip-risk">{d.seguretatIp.etiqueta}</small>}</span>)}</div></td>
            <td><div className="connection-stack">{s.dispositius.map(d => <span key={d.deviceId}>{d.ubicacioAprox || 'Pendent de geolocalització'}{d.proveidorXarxa ? <small>{d.proveidorXarxa}</small> : null}</span>)}</div></td>
            <td>{s.ultimaActivitat ? horaLabel(s.ultimaActivitat) : '—'}</td>
          </tr>)}
        </tbody></table></div>
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

    </div>
  );
}
