import { t } from '../lib/i18n';

// Port dels botons de filtre-torn/filtre-torn-h.
export default function TornChips({ torns, actius, onToggle, idioma }) {
  return (
    <div className="filtres-torn" role="group">
      {torns.map((v) => (
        <button
          key={v}
          type="button"
          className={'filtre-torn-btn' + (actius.indexOf(v) !== -1 ? ' actiu' : '')}
          onClick={() => onToggle(v)}
        >
          {t(idioma, 'torns')[v] || v}
        </button>
      ))}
    </div>
  );
}
