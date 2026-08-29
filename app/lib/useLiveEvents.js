'use client';

import { useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const subscriptors_ = new Set();
let eventSourceCompartit_ = null;
let tokenCompartit_ = null;
let temporitzadorTancament_ = null;

function assegurarConnexio_(token) {
  if (eventSourceCompartit_ && tokenCompartit_ === token) return;
  if (eventSourceCompartit_) eventSourceCompartit_.close();
  tokenCompartit_ = token;
  eventSourceCompartit_ = new EventSource(API_BASE + '/events?token=' + encodeURIComponent(token));
  eventSourceCompartit_.addEventListener('maquina', (e) => {
    try {
      const dades = JSON.parse(e.data);
      subscriptors_.forEach((avisar) => avisar(dades));
    } catch (err) { /* event malformat, ignorat */ }
  });
}

// Notificacions push del Bridge (SSE) — quan una màquina canvia (heartbeat,
// producció, parada, incidència), s'avisa amb { tenant_id, machine_id } i qui
// escolta decideix què fer-ne (Home fa un refetch dirigit, Fitxa idem si és
// la màquina oberta). Reconnexió automàtica: EventSource ho fa nadiu, no cal
// codi manual.
export function useLiveEvents(token, onCanviMaquina) {
  // La connexió SSE només s'obre un cop per token (no es vol reconnectar a
  // cada canvi de filtre). Però onCanviMaquina SÍ canvia (p.ex. tanca sobre
  // filtreTorn) — si el listener el capturés directament quedaria fixat per
  // sempre amb la primera versió (filtres buits), i cada tick SSE tornaria a
  // sobreescriure les dades ja filtrades amb un refetch sense filtrar. Per
  // això es crida sempre a través d'un ref, actualitzat a cada render.
  const onCanviMaquinaRef = useRef(onCanviMaquina);
  useEffect(() => { onCanviMaquinaRef.current = onCanviMaquina; }, [onCanviMaquina]);

  useEffect(() => {
    if (!token || !API_BASE) return;
    clearTimeout(temporitzadorTancament_);
    const avisar = (dades) => onCanviMaquinaRef.current?.(dades);
    subscriptors_.add(avisar);
    assegurarConnexio_(token);
    return () => {
      subscriptors_.delete(avisar);
      if (!subscriptors_.size) {
        // Petit marge perquè el doble muntatge de desenvolupament de React
        // reutilitzi el mateix canal en lloc d'obrir-ne dos consecutius.
        temporitzadorTancament_ = setTimeout(() => {
          if (subscriptors_.size || !eventSourceCompartit_) return;
          eventSourceCompartit_.close();
          eventSourceCompartit_ = null;
          tokenCompartit_ = null;
        }, 100);
      }
    };
  }, [token]);
}
