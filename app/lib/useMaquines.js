'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import * as api from './api';
import { useAuth } from './auth-context';
import { useLiveEvents } from './useLiveEvents';

// Ràfegues d'avisos SSE (diverses màquines gairebé de cop) es col·lapsen en
// un sol refetch — evita disparar getMaquines() N cops seguits. El llindar
// entre refetchs reals es manté baix (800ms) perquè el number-flow rebi
// actualitzacions gairebé contínues i no faci salts grossos i espaiats —
// abans (2500ms) es notava poc fluid. Amb la consulta ja consolidada
// (~500-900ms per petició, no els 3-4s d'abans), un llindar baix no torna a
// saturar Mongo.
// Les targetes no necessiten seguir cada escriptura PLC individual. S'acumulen
// els ids durant una finestra real i es resolen en una sola petició. Amb 57
// màquines, el llindar anterior (<1 s) generava diversos MB en pocs minuts.
const PRIMER_REFRESC_LIVE_MS = 1000;
const INTERVAL_REFRESC_LIVE_MS = 10000;
const TTL_CACHE_MAQUINES_MS = 6 * 60 * 60 * 1000;
const VERSIO_CACHE_MAQUINES = 1;

function clauCacheMaquines_(sessio) {
  if (!sessio) return null;
  return `monitor_maquines_v${VERSIO_CACHE_MAQUINES}_${sessio.rol || 'usuari'}_${sessio.nomClient || 'client'}`;
}

function llegirCacheMaquines_(sessio) {
  const clau = clauCacheMaquines_(sessio);
  if (!clau || typeof window === 'undefined') return null;
  try {
    const cache = JSON.parse(localStorage.getItem(clau) || 'null');
    if (!cache || !Array.isArray(cache.maquines) || Date.now() - Number(cache.desaA || 0) > TTL_CACHE_MAQUINES_MS) {
      if (cache) localStorage.removeItem(clau);
      return null;
    }
    return cache.maquines;
  } catch (e) { return null; }
}

function desarCacheMaquines_(sessio, maquines) {
  const clau = clauCacheMaquines_(sessio);
  if (!clau || !Array.isArray(maquines)) return;
  try { localStorage.setItem(clau, JSON.stringify({ desaA: Date.now(), maquines })); } catch (e) {}
}

const MaquinesContext = createContext(null);

// Muntat un sol cop al layout de (app) — no a la pàgina Home. Home i Fitxa
// són rutes diferents a Next.js: navegar entre elles desmunta el component
// de la ruta anterior. Si aquest estat visqués dins de HomePage (com abans),
// cada tornada a "/" perdia la llista carregada i tornava a mostrar
// l'skeleton — encara que la SSE ja tingués tot al dia. Vivint al layout,
// sobreviu a la navegació entre pestanyes.
export function MaquinesProvider({ children }) {
  const { token, sessio, errorSessio } = useAuth();
  const esAdmin = sessio?.rol === 'admin';
  const pathname = usePathname();
  const esHomeRef = useRef(pathname === '/');
  useEffect(() => { esHomeRef.current = pathname === '/'; }, [pathname]);

  const cacheInicialRef = useRef(undefined);
  if (cacheInicialRef.current === undefined) cacheInicialRef.current = llegirCacheMaquines_(sessio);
  const [maquines, setMaquines] = useState(cacheInicialRef.current); // null = ni cache ni càrrega de xarxa
  const calValidarCacheRef = useRef(!!cacheInicialRef.current);
  const [alertaCaigudaMultiple, setAlertaCaigudaMultiple] = useState(null);

  const [filtreClient, setFiltreClient] = useState('');
  const [filtreAny, setFiltreAny] = useState('');
  const [filtreText, setFiltreText] = useState('');
  const [filtreEstat, setFiltreEstat] = useState(null);

  const maquinesRef = useRef(maquines);
  const carregaEnCursRef = useRef(false);

  useEffect(() => { maquinesRef.current = maquines; }, [maquines]);

  // Ids marcats "bruts" pels avisos SSE des de l'última càrrega — permet
  // demanar només aquestes màquines a /app/maquines (machineIds=...) en
  // lloc de recalcular base+estat+producció de TOTES cada cop. La primera
  // càrrega (maquinesRef.current === null) sempre és completa.
  const idsBrutsRef = useRef(new Set());

  const carregarMaquines = useCallback(async (silencios) => {
    if (carregaEnCursRef.current) return;
    carregaEnCursRef.current = true;
    try {
      const anteriors = maquinesRef.current;
      const idsCandidats = anteriors && idsBrutsRef.current.size ? Array.from(idsBrutsRef.current) : null;
      // Si l'avís correspon a una màquina nova encara absent de la cache,
      // cal una càrrega completa per obtenir-ne també nom/imatge/client.
      const idsParcial = idsCandidats && idsCandidats.every((id) => anteriors.some((m) => m.machineId === id))
        ? idsCandidats
        : null;
      idsBrutsRef.current = new Set();
      const resposta = await api.getMaquines(token, idsParcial ? { machineIds: idsParcial.join(','), live: 1 } : {});
      if (!Array.isArray(resposta)) throw new Error('Resposta inesperada a /maquines');

      // Fetch parcial: substitueix només les màquines demanades dins la
      // llista ja carregada — la resta es queda tal com estava, no cal
      // tornar-les a calcular ni retransmetre-les per xarxa.
      let noves;
      if (idsParcial) {
        const actualitzadesPerId = new Map(resposta.map((m) => [m.machineId, m]));
        // La resposta live només conté camps dinàmics. Es fusiona amb la
        // base en cache perquè noms, imatges i dades administratives no
        // tornin a viatjar a cada refresc.
        noves = anteriors.map((m) => {
          const canvi = actualitzadesPerId.get(m.machineId);
          return canvi ? { ...m, ...canvi } : m;
        });
      } else {
        noves = resposta;
        // Només una resposta completa renova la cache estàtica. Els ticks
        // live no han d'escriure desenes de KB a localStorage cada 10 s.
        desarCacheMaquines_(sessio, noves);
      }

      if (anteriors) {
        const perId = new Map(anteriors.map((m) => [m.machineId, m.estatActual]));
        const novesCaigudes = resposta.filter((m) => m.estatActual === 'incomunicada' && perId.get(m.machineId) !== 'incomunicada');
        if (novesCaigudes.length >= 2) setAlertaCaigudaMultiple(novesCaigudes.map((m) => m.nom));
      }
      setMaquines(noves);
    } catch (e) {
      errorSessio(e);
    } finally {
      carregaEnCursRef.current = false;
    }
  }, [token, sessio, errorSessio]);

  useEffect(() => {
    if (!token || pathname !== '/') return;
    if (maquinesRef.current === null) {
      carregarMaquines();
      return;
    }
    if (calValidarCacheRef.current) {
      // En reobrir: conserva base/imatges/client de la cache i baixa només
      // els camps live de totes les màquines (pocs KB comprimides).
      calValidarCacheRef.current = false;
      maquinesRef.current.forEach((m) => idsBrutsRef.current.add(m.machineId));
      carregarMaquines(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pathname]);

  // Únic mecanisme de refresc després de la càrrega inicial: avís SSE ->
  // refetch dirigit (amb debounce+llindar). Sense poll de reserva — decisió
  // explícita per no duplicar càrrega contra Mongo; si SSE cau, la vista es
  // queda congelada fins recarregar la pàgina.
  //
  // Aquest Provider viu al layout, no a la pàgina Home — està muntat SEMPRE,
  // també quan l'usuari és a la Fitxa d'una màquina. Sense la guarda de
  // pathname, cada avís SSE (d'una màquina qualsevol) disparava un refetch
  // de LA LLISTA SENCERA fins i tot mirant la fitxa d'una sola màquina —
  // tràfic de xarxa i càrrega a Mongo totalment desaprofitats perquè Home
  // ni tan sols és visible. Mentre no s'hi és s'ignoren aquests avisos: en
  // tornar es reutilitza la cache i els avisos nous la posen al dia de
  // manera dirigida, màquina per màquina.
  const liveDebounceRef = useRef(null);
  const ultimLiveFetchRef = useRef(0);
  useLiveEvents(token, useCallback((dades) => {
    // Mentre Home no és visible no s'acumulen ids. Amb moltes màquines
    // emetent, al tornar s'havien acumulat pràcticament totes i el refetch
    // "parcial" acabava sent una altra descàrrega completa (~150 KB).
    // La llista del Provider ja queda en cache: es mostra instantàniament
    // al tornar i els avisos següents actualitzen cada màquina de forma
    // dirigida, sense una ràfega inicial massiva.
    if (!esHomeRef.current || document.visibilityState === 'hidden') return;
    // dades = { tenant_id, machine_id } — es guarda per demanar només
    // aquesta màquina al refetch (veure idsBrutsRef a carregarMaquines).
    if (dades?.machine_id) idsBrutsRef.current.add(dades.machine_id);
    // No reiniciar el timeout amb cada avís: això crea una finestra de
    // batching estable. Tots els ids que arriben mentre és obert queden al
    // Set i es demanen junts quan venç.
    if (liveDebounceRef.current) return;
    const transcorregut = Date.now() - ultimLiveFetchRef.current;
    const espera = Math.max(PRIMER_REFRESC_LIVE_MS, INTERVAL_REFRESC_LIVE_MS - transcorregut);
    liveDebounceRef.current = setTimeout(() => {
      liveDebounceRef.current = null;
      if (!esHomeRef.current || document.visibilityState === 'hidden') {
        idsBrutsRef.current.clear();
        return;
      }
      ultimLiveFetchRef.current = Date.now();
      carregarMaquines(true);
    }, espera);
  }, [carregarMaquines]));

  useEffect(() => () => clearTimeout(liveDebounceRef.current), []);

  useEffect(() => {
    if (pathname === '/' && maquinesRef.current === null) {
      carregarMaquines();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Filtres (client/any/text): 100% al client, mateix motiu que l'original
  // — fer-ho al servidor recalculava producció/parades/incidències sencers
  // a cada tecla i anava molt lent comparat amb filtrar en memòria.
  const maquinesFiltradesAbansEstat = useMemo(() => {
    if (!maquines) return null;
    const q = filtreText.trim().toLowerCase();
    return maquines.filter((m) => {
      if (esAdmin && filtreClient && m.tenantId !== filtreClient) return false;
      if (esAdmin && filtreAny && Number(m.anyAlta) !== Number(filtreAny)) return false;
      if (q && !(m.nom || '').toLowerCase().includes(q) && !(m.clientNom || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [maquines, filtreClient, filtreAny, filtreText, esAdmin]);

  const comptesEstat = useMemo(() => {
    const comptes = { marxa: 0, parada: 0, alarma: 0, incomunicada: 0, desactivada: 0 };
    (maquinesFiltradesAbansEstat || []).forEach((m) => { if (comptes[m.estatActual] !== undefined) comptes[m.estatActual]++; });
    return comptes;
  }, [maquinesFiltradesAbansEstat]);

  // La resposta de /maquines ja inclou tenantId/clientNom/anyAlta per a
  // l'administrador. Derivar-ne els desplegables evita una segona petició
  // /filtres-admin i, sobretot, una altra lectura dels catàlegs a Mongo.
  const filtresAdmin = useMemo(() => {
    if (!esAdmin || !maquines) return { clients: [], anys: [] };
    const clientsPerId = new Map();
    const anys = new Set();
    maquines.forEach((m) => {
      if (m.tenantId) clientsPerId.set(m.tenantId, m.clientNom || m.tenantId);
      if (Number(m.anyAlta)) anys.add(Number(m.anyAlta));
    });
    return {
      clients: Array.from(clientsPerId, ([tenantId, nom]) => ({ tenantId, nom }))
        .sort((a, b) => a.nom.localeCompare(b.nom)),
      anys: Array.from(anys).sort((a, b) => a - b),
    };
  }, [esAdmin, maquines]);

  const maquinesVisibles = useMemo(() => {
    if (!maquinesFiltradesAbansEstat) return null;
    if (!filtreEstat) return maquinesFiltradesAbansEstat;
    return maquinesFiltradesAbansEstat.filter((m) => m.estatActual === filtreEstat);
  }, [maquinesFiltradesAbansEstat, filtreEstat]);

  const value = {
    maquines: maquinesVisibles,
    carregant: maquines === null,
    comptesEstat,
    filtresAdmin,
    filtreEstat, setFiltreEstat,
    filtreClient, setFiltreClient,
    filtreAny, setFiltreAny,
    filtreText, setFiltreText,
    alertaCaigudaMultiple, setAlertaCaigudaMultiple,
  };
  return <MaquinesContext.Provider value={value}>{children}</MaquinesContext.Provider>;
}

export function useMaquines() {
  const ctx = useContext(MaquinesContext);
  if (!ctx) throw new Error('useMaquines() ha d\'anar dins de <MaquinesProvider>');
  return ctx;
}
