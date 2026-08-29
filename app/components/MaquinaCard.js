'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { t } from '../lib/i18n';
import { IconaWifiOff, IconaPeces } from '../lib/icons';
import BarraDades from './BarraDades';

const COLORS_TORN = { Matí: '#f6c453', Tarda: '#4da3ff', Nit: '#b582f8' };

// Recorda l'últim valor de peces pintat per màquina (àmbit de mòdul, com
// valorsPecesAnteriors_ a l'original): és l'únic "abans" que <number-flow>
// té per animar la transició, ja que cada repintat no reutilitza el node DOM.
const valorsPecesAnteriors = {};

export default function MaquinaCard({ maquina: m }) {
  const router = useRouter();
  const { sessio } = useAuth();
  const idioma = sessio?.idioma || 'ca';
  const numFlowRef = useRef(null);

  const incomunicada = m.estatActual === 'incomunicada';
  const desactivada = m.estatActual === 'desactivada';
  const clicable = !incomunicada && !desactivada;

  useEffect(() => {
    const node = numFlowRef.current;
    if (!node) return;
    // Durada més curta que el cicle de refresc perquè l'animació sempre
    // acabi abans del proper valor — veure comentari equivalent a
    // maquines/page.js (useNumberFlowAvui).
    const timing = { duration: 450, easing: 'ease-out' };
    node.transformTiming = timing;
    node.spinTiming = timing;
    node.opacityTiming = { duration: 300, easing: 'ease-out' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // un sol cop en muntar — sense l'array buit, reassignar-ho a cada
  // render (p.ex. cada refresc de la llista) reinicialitzava number-flow i
  // els valors deixaven de pintar-se.

  useEffect(() => {
    const node = numFlowRef.current;
    if (!node || !clicable) return;
    const anterior = valorsPecesAnteriors[m.machineId];
    node.update?.(anterior !== undefined ? anterior : m.pecesBonesAvui);
    if (anterior !== undefined && anterior !== m.pecesBonesAvui) {
      requestAnimationFrame(() => node.update?.(m.pecesBonesAvui));
    }
    valorsPecesAnteriors[m.machineId] = m.pecesBonesAvui;
  }, [m.machineId, m.pecesBonesAvui, clicable]);

  function activar() {
    // Query string (no path dinàmic /maquines/[id]): amb output:'export' cap
    // servidor pot renderitzar un segment dinàmic amb un id desconegut en
    // temps de build — una única pàgina estàtica llegint ?id= al client
    // funciona igual dins el build d'Electron/Capacitor.
    if (clicable) router.push('/maquines?id=' + m.machineId);
  }

  return (
    <div
      className={'maquina-card' + (incomunicada ? ' incomunicada' : '') + (desactivada ? ' desactivada' : '')}
      onClick={clicable ? activar : undefined}
      tabIndex={clicable ? 0 : undefined}
      role={clicable ? 'button' : undefined}
      aria-label={clicable ? m.nom : undefined}
      onKeyDown={clicable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activar(); } } : undefined}
    >
      <div className="img-placeholder">
        {m.imatgeUrl ? <img src={m.imatgeUrl} alt={m.nom} /> : t(idioma, 'senseImatge')}
        <div className="img-badge">
          <span className={'estat-badge estat-' + m.estatActual}>
            {incomunicada && <IconaWifiOff />}
            {t(idioma, 'estat_' + m.estatActual)}
          </span>
        </div>
      </div>
      <div className="maquina-info">
        <div className="maquina-top">
          {m.clientNom ? <div className="client-tag">{m.clientNom}</div> : null}
          <span className="nom">{m.nom}</span>
          <span className="maquina-num">{m.machineId}</span>
          {m.visiblePelClient === false ? <span className="chip-postamarxa">{t(idioma, 'chip_postamarxa')}</span> : null}
        </div>
        <div className="barres-dades">
          <BarraDades etiqueta={t(idioma, 'barra_produccio')} classeOmpliment="fill-produccio" hores={m.horesProduccio} />
          <BarraDades etiqueta={t(idioma, 'barra_alarma')} classeOmpliment="fill-alarma" hores={m.horesAlarma} />
          <BarraDades etiqueta={t(idioma, 'barra_parada')} classeOmpliment="fill-parada" hores={m.horesParada} />
        </div>
        {clicable && (
          <div className="peces-avui-row">
            <span className="torn-punt" style={{ background: COLORS_TORN[m.tornActual] || 'var(--text-muted)' }} />
            <IconaPeces />
            <number-flow ref={numFlowRef} class="peces-avui-valor"></number-flow>
          </div>
        )}
      </div>
    </div>
  );
}
