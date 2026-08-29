'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

// Consum de xarxa REAL d'aquesta sessió de navegador (no una estimació) —
// suma transferSize (bytes reals sobre la xarxa, incloent capçaleres) de
// cada petició a l'API via la Resource Timing API. transferSize només és
// visible entre orígens si el servidor envia "Timing-Allow-Origin" (afegit
// a api-server.js) — sense això el navegador el retorna sempre a 0 per
// privacitat. Fallback a encodedBodySize si transferSize no està disponible
// (p.ex. resposta servida des de la bfcache).
function midaEntrada_(entry) {
  if (entry.transferSize > 0) return entry.transferSize;
  if (entry.encodedBodySize > 0) return entry.encodedBodySize;
  return 0;
}

export function formatarBytes_(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function useConsumXarxa() {
  const [bytes, setBytes] = useState(0);
  const [peticions, setPeticions] = useState(0);
  const [detall, setDetall] = useState([]);

  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined' || !API_BASE) return;
    let totalBytes = 0;
    let totalPeticions = 0;
    const vistes = new Set();
    const perEndpoint = new Map();

    function processar(entries) {
      let canvi = false;
      entries.forEach((entry) => {
        if (!entry.name.startsWith(API_BASE)) return;
        // startTime+name no és únic (poden repetir-se peticions idèntiques
        // en poc temps) — cal l'entrada sencera com a clau per no comptar
        // la mateixa petició dos cops si l'observer la reprocessa.
        const clau = entry.name + '|' + entry.startTime + '|' + entry.duration;
        if (vistes.has(clau)) return;
        vistes.add(clau);
        const mida = midaEntrada_(entry);
        totalBytes += mida;
        totalPeticions += 1;
        let endpoint = entry.name;
        try {
          const url = new URL(entry.name);
          endpoint = url.pathname.replace(/^\/app/, '') || '/';
        } catch (e) {}
        const anterior = perEndpoint.get(endpoint) || { endpoint, bytes: 0, peticions: 0 };
        anterior.bytes += mida;
        anterior.peticions += 1;
        perEndpoint.set(endpoint, anterior);
        canvi = true;
      });
      if (canvi) {
        setBytes(totalBytes);
        setPeticions(totalPeticions);
        setDetall(Array.from(perEndpoint.values()).sort((a, b) => b.bytes - a.bytes));
      }
    }

    // "buffered: true" recupera també les peticions fetes ABANS de muntar
    // aquest hook (p.ex. la càrrega inicial de la pàgina) — sense això el
    // comptador només veuria trànsit a partir d'ara.
    const observer = new PerformanceObserver((list) => processar(list.getEntries()));
    try { observer.observe({ type: 'resource', buffered: true }); }
    catch (e) { observer.observe({ entryTypes: ['resource'] }); processar(performance.getEntriesByType('resource')); }

    return () => observer.disconnect();
  }, []);

  const detallText = detall.slice(0, 8)
    .map((d) => `${d.endpoint}: ${formatarBytes_(d.bytes)} · ${d.peticions} peticions`)
    .join('\n');
  return { bytes, peticions, text: formatarBytes_(bytes), detall, detallText };
}
