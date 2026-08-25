'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api';
import { useAuth } from './auth-context';

// Mateixos intervals que index.html (REFRESC_MAQUINES_*_MS_): l'estat
// (marxa/parada/alarma) canvia sovint i cal refrescar-lo cada 5s, la
// producció d'avui cada 15s, i la llista base de màquines (poc canviant)
// cada 60s. El poll de /versio cada 2s decideix si toca fer-ho ja.
const REFRESC_BASE_MS = 60000;
const REFRESC_ESTAT_MS = 5000;
const REFRESC_PRODUCCIO_MS = 15000;
const POLL_VERSIO_MS = 2000;

function clauFitxaCachePersistent_() {
  let email = '';
  try { email = localStorage.getItem('monitor_email') || ''; } catch (e) {}
  return 'monitor_fitxaCache_' + email;
}

export function useMaquines() {
  const { token, sessio, errorSessio } = useAuth();
  const esAdmin = sessio?.rol === 'admin';

  const [maquines, setMaquines] = useState(null); // null = encara no ha carregat mai
  const [alertaCaigudaMultiple, setAlertaCaigudaMultiple] = useState(null);

  const [filtreClient, setFiltreClient] = useState('');
  const [filtreAny, setFiltreAny] = useState('');
  const [filtreText, setFiltreText] = useState('');
  const [filtreEstat, setFiltreEstat] = useState(null);

  const maquinesRef = useRef(null);
  const versioClientRef = useRef(null);
  const ultimRefrescBase = useRef(0);
  const ultimRefrescEstat = useRef(0);
  const ultimRefrescProduccio = useRef(0);
  const carregaEnCursRef = useRef(false);
  const pollIntervalRef = useRef(null);
  const fitxaCacheRef = useRef({});
  const fitxaVersionsCacheRef = useRef({});

  useEffect(() => { maquinesRef.current = maquines; }, [maquines]);

  // Persistència de la cache de fitxes (usada per la vista Fitxa, que es
  // migra al pas següent) — es recupera un cop en obrir sessió perquè la
  // primera obertura de fitxa d'un dia ja tingui dades instantànies.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(clauFitxaCachePersistent_());
      if (!raw) return;
      const desat = JSON.parse(raw);
      fitxaCacheRef.current = desat.dades || {};
      fitxaVersionsCacheRef.current = desat.versions || {};
    } catch (e) {}
  }, []);

  function desarFitxaCachePersistent_() {
    try {
      localStorage.setItem(clauFitxaCachePersistent_(), JSON.stringify({
        dades: fitxaCacheRef.current, versions: fitxaVersionsCacheRef.current,
      }));
    } catch (e) {}
  }

  // Carrega en silenci la fitxa de totes les màquines rellevants (any
  // actual) just quan es pinten les targetes, perquè obrir-la després
  // sigui instantani — primer demana les versions (barat) i només baixa
  // amb la crida bulk (cara) les que han canviat des de l'última vegada.
  const precarregarFitxesMaquines_ = useCallback(async (llista) => {
    const idsRellevants = llista
      .filter((m) => m.estatActual !== 'incomunicada' && m.estatActual !== 'desactivada')
      .map((m) => m.machineId);
    if (!idsRellevants.length || !token) return;
    try {
      const versions = await api.getFitxesMaquinesVersions(token);
      const canviats = idsRellevants.filter((id) =>
        !fitxaCacheRef.current[id] || fitxaVersionsCacheRef.current[id] !== versions[id]);
      if (!canviats.length) return;
      const bulk = await api.getFitxesMaquinesBulk(token, { any: new Date().getFullYear(), machineIds: canviats });
      canviats.forEach((id) => {
        if (bulk[id]) {
          fitxaCacheRef.current[id] = bulk[id];
          fitxaVersionsCacheRef.current[id] = versions[id];
        }
      });
      desarFitxaCachePersistent_();
    } catch (e) { /* precàrrega silenciosa, no cal mostrar error */ }
  }, [token]);

  const carregarMaquines = useCallback(async (silencios) => {
    if (carregaEnCursRef.current) return;
    carregaEnCursRef.current = true;
    try {
      const noves = await api.getMaquines(token, {});
      if (!Array.isArray(noves)) throw new Error('Resposta inesperada a /maquines');
      const anteriors = maquinesRef.current;
      if (anteriors) {
        const perId = new Map(anteriors.map((m) => [m.machineId, m.estatActual]));
        const novesCaigudes = noves.filter((m) => m.estatActual === 'incomunicada' && perId.get(m.machineId) !== 'incomunicada');
        if (novesCaigudes.length >= 2) setAlertaCaigudaMultiple(novesCaigudes.map((m) => m.nom));
      }
      setMaquines(noves);
      precarregarFitxesMaquines_(noves);
    } catch (e) {
      errorSessio(e);
    } finally {
      carregaEnCursRef.current = false;
    }
  }, [token, errorSessio, precarregarFitxesMaquines_]);

  // Fusiona un bloc parcial (base/estat/producció) a la cache existent —
  // port d'actualitzarBlocMaquines_.
  function actualitzarBloc_(bloc) {
    setMaquines((prev) => {
      if (!prev) return prev;
      const perId = new Map(prev.map((m) => [m.machineId, { ...m }]));
      (bloc || []).forEach((m) => perId.set(m.machineId, { ...(perId.get(m.machineId) || { machineId: m.machineId }), ...m }));
      return Array.from(perId.values());
    });
  }

  useEffect(() => {
    if (!token) return;
    carregarMaquines();
    ultimRefrescBase.current = Date.now();
    ultimRefrescEstat.current = Date.now();
    ultimRefrescProduccio.current = Date.now();

    pollIntervalRef.current = setInterval(async () => {
      if (!token) return;
      try {
        const v = await api.versioDades(token);
        const ara = Date.now();
        const versioCanviada = versioClientRef.current !== null && v !== versioClientRef.current;
        const tocaBase = ara - ultimRefrescBase.current >= REFRESC_BASE_MS;
        const tocaEstat = ara - ultimRefrescEstat.current >= REFRESC_ESTAT_MS;
        const tocaProduccio = ara - ultimRefrescProduccio.current >= REFRESC_PRODUCCIO_MS;
        if (tocaBase) ultimRefrescBase.current = ara;
        if (tocaEstat) ultimRefrescEstat.current = ara;
        if (tocaProduccio) ultimRefrescProduccio.current = ara;
        if (versioCanviada || tocaBase || tocaEstat || tocaProduccio) {
          if (tocaBase) actualitzarBloc_(await api.getMaquinesBase(token, {}));
          if (tocaEstat) actualitzarBloc_(await api.getMaquinesEstat(token, {}));
          if (tocaProduccio) actualitzarBloc_(await api.getMaquinesProduccioAvui(token, {}));
        }
        versioClientRef.current = v;
      } catch (e) { /* poll silenciós: no interromp la vista per un error puntual */ }
    }, POLL_VERSIO_MS);

    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  const maquinesVisibles = useMemo(() => {
    if (!maquinesFiltradesAbansEstat) return null;
    if (!filtreEstat) return maquinesFiltradesAbansEstat;
    return maquinesFiltradesAbansEstat.filter((m) => m.estatActual === filtreEstat);
  }, [maquinesFiltradesAbansEstat, filtreEstat]);

  return {
    maquines: maquinesVisibles,
    carregant: maquines === null,
    comptesEstat,
    filtreEstat, setFiltreEstat,
    filtreClient, setFiltreClient,
    filtreAny, setFiltreAny,
    filtreText, setFiltreText,
    alertaCaigudaMultiple, setAlertaCaigudaMultiple,
  };
}
