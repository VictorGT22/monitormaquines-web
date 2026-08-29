'use client';

import { useAuth } from '../lib/auth-context';
import { useMaquines } from '../lib/useMaquines';
import { useConsumXarxa } from '../lib/useConsumXarxa';
import { t } from '../lib/i18n';
import { IconaWifiOff } from '../lib/icons';
import MaquinaCard from '../components/MaquinaCard';

const ESTATS_CHIP = ['marxa', 'parada', 'alarma', 'incomunicada', 'desactivada'];

export default function HomePage() {
  const { sessio } = useAuth();
  const esAdmin = sessio?.rol === 'admin';
  const idioma = sessio?.idioma || 'ca';
  const {
    maquines, carregant, comptesEstat, filtresAdmin,
    filtreEstat, setFiltreEstat,
    filtreClient, setFiltreClient,
    filtreAny, setFiltreAny,
    filtreText, setFiltreText,
    alertaCaigudaMultiple,
  } = useMaquines();

  const consum = useConsumXarxa();

  return (
    <div id="home-view">
      {alertaCaigudaMultiple ? (
        <div className="error-msg" style={{ display: 'block' }}>
          ⚠ {t(idioma, 'alerta_caiguda_multiple').replace('{n}', alertaCaigudaMultiple.length)}{' '}
          {alertaCaigudaMultiple.join(', ')}
        </div>
      ) : null}

      <div id="consum-xarxa-chip" title={`${consum.peticions} peticions\n\n${consum.detallText}`}>
        <span>Consum d’aquesta sessió</span>
        <strong>{consum.text}</strong>
      </div>

      {esAdmin && (
        <div id="admin-filtres" className="filtres-historic">
          <div>
            <label>{t(idioma, 'admin_client')}</label>
            <select value={filtreClient} onChange={(e) => setFiltreClient(e.target.value)}>
              <option value="">{t(idioma, 'admin_totsClients')}</option>
              {(filtresAdmin?.clients || []).map((c) => (
                <option key={c.tenantId} value={c.tenantId}>{c.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label>{t(idioma, 'f_any')}</label>
            <select value={filtreAny} onChange={(e) => setFiltreAny(e.target.value)}>
              <option value="">{t(idioma, 'f_tots')}</option>
              {(filtresAdmin?.anys || []).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>{t(idioma, 'admin_cercarLbl')}</label>
            <input
              type="text"
              placeholder={t(idioma, 'admin_cercar')}
              value={filtreText}
              onChange={(e) => setFiltreText(e.target.value)}
            />
          </div>
        </div>
      )}

      {esAdmin && (
        <div id="chips-estat-maquines" className="chips-estat-maquines">
          {ESTATS_CHIP.map((estat) => (
            <button
              key={estat}
              type="button"
              className={'estat-badge estat-' + estat + ' clicable' + (filtreEstat === estat ? ' actiu' : '')}
              onClick={() => setFiltreEstat((prev) => (prev === estat ? null : estat))}
            >
              {estat === 'incomunicada' && <span className="estat-icona-wifi"><IconaWifiOff /></span>}
              <span className="estat-nom">{t(idioma, 'estat_' + estat)}</span>
              <span className="estat-comptador">{comptesEstat[estat]}</span>
            </button>
          ))}
        </div>
      )}

      <div id="maquines-grid">
        {carregant ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card" style={{ height: 210 }} />)
        ) : !maquines.length ? (
          <div className="empty-state">{t(idioma, 'buit_dades')}</div>
        ) : (
          maquines.map((m) => <MaquinaCard key={m.machineId} maquina={m} />)
        )}
      </div>
    </div>
  );
}
