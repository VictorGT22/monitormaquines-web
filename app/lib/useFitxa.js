'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api';
import { useAuth } from './auth-context';
import { formatarData_, avuiISO_ } from './format';
import { useLiveEvents } from './useLiveEvents';

const TOTS_TORNS = ['Matí', 'Tarda', 'Nit'];

function formatIso(data) {
  return data.toISOString().slice(0, 10);
}

function rangDatesProduccio_(mode, any, mes, dataInici, dataFi) {
  if (mode === 'avui') {
    const avui = avuiISO_();
    return { inici: avui, fi: avui };
  }
  if (dataInici || dataFi) return { inici: dataInici || null, fi: dataFi || null };
  const anyNum = Number(any);
  if (!anyNum) return { inici: null, fi: null };
  const mesNum = Number(mes);
  if (mesNum) {
    return {
      inici: formatIso(new Date(Date.UTC(anyNum, mesNum - 1, 1))),
      fi: formatIso(new Date(Date.UTC(anyNum, mesNum, 0))),
    };
  }
  return { inici: `${anyNum}-01-01`, fi: `${anyNum}-12-31` };
}

function ultimsSetDiesLaborables_(diesConfigurats) {
  const permesos = new Set(Array.isArray(diesConfigurats) && diesConfigurats.length ? diesConfigurats : [1, 2, 3, 4, 5]);
  const fi = avuiISO_();
  const cursor = new Date(fi + 'T12:00:00Z');
  let inici = fi;
  let trobats = 0;
  for (let guard = 0; guard < 31 && trobats < 7; guard++) {
    const diaJs = cursor.getUTCDay();
    const diaIso = diaJs === 0 ? 7 : diaJs;
    if (permesos.has(diaIso)) {
      trobats++;
      inici = formatIso(cursor);
    }
    if (trobats < 7) cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return { inici, fi };
}

// Comparació estructural senzilla (objectes/arrays plans de valors
// primitius, com resumAvui o incidenciesActives) — evita aplicar un tick
// SSE que no canvia res de visible.
function iguals_(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

// El backend de /fitxa compara "dataFi" com a mitjanit exacta d'aquell dia
// (t > fi), no com a final de dia — qualsevol incidència més tard aquell
// mateix dia quedava exclosa. Es corregeix des del frontend enviant
// l'endemà com a límit (exclusiu), sense tocar el backend.
function dataFiInclusiva_(dataFi) {
  if (!dataFi) return null;
  // Aritmètica en UTC pur (Z), no en hora local: barrejar Date local amb
  // toISOString() (UTC) pot fer que "+1 dia" torni al mateix dia si el
  // fus horari local va per davant d'UTC (p.ex. Madrid a l'estiu).
  const ms = new Date(dataFi + 'T00:00:00Z').getTime() + 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function carregarTipusConsumDesat() {
  try {
    const desat = JSON.parse(localStorage.getItem('monitor_consum_tipus') || 'null');
    if (Array.isArray(desat) && desat.length) return desat;
  } catch (_) {}
  return ['aire'];
}

export function useFitxa(machineId, opcions = {}) {
  const { token, errorSessio } = useAuth();
  const carregarConsums = !!opcions.carregarConsums;

  const [fitxa, setFitxa] = useState(null);
  const [produccio, setProduccio] = useState(null);
  // Accés directe per URL a una màquina no autoritzada: el backend ja
  // rebutja amb 403 (trobarMaquinaAmbAccess_), aquest flag només permet a
  // la pàgina redirigir en lloc de deixar veure panells buits amb un banner
  // d'error genèric.
  const [accesDenegat, setAccesDenegat] = useState(false);
  const [cronologiaDies, setCronologiaDies] = useState([]);
  const [carregantCronologia, setCarregantCronologia] = useState(true);
  const [consums, setConsums] = useState(null);
  const [preus, setPreus] = useState(null);
  const [tornsClient, setTornsClient] = useState(TOTS_TORNS);
  const [horariUnic, setHorariUnic] = useState(false);
  const [diesLaborables, setDiesLaborables] = useState([1, 2, 3, 4, 5]);
  const [mostrarReferencia, setMostrarReferencia] = useState(false);

  // Filtres — Producció / Cronologia (mode compartit)
  const [mode, setMode] = useState('avui');
  const [filtreTorn, setFiltreTorn] = useState([]);
  const [filtreReferencia, setFiltreReferencia] = useState('');
  const [filtreAny, setFiltreAny] = useState(String(new Date().getFullYear()));
  const [filtreMes, setFiltreMes] = useState(String(new Date().getMonth() + 1));
  const [dataIniciPeriode, setDataIniciPeriode] = useState('');
  const [dataFiPeriode, setDataFiPeriode] = useState('');

  // Filtres — Històric. Per defecte només "avui" (com Producció): l'usuari
  // pot ampliar el rang triant Any/Mes/Desde/Fins, però sense cap selecció
  // no ha de veure tot l'historial de la màquina barrejat.
  const [filtreTornHist, setFiltreTornHist] = useState([]);
  const [filtreAnyHist, setFiltreAnyHist] = useState('');
  const [filtreMesHist, setFiltreMesHist] = useState('');
  const [dataDesdeHist, setDataDesdeHist] = useState(avuiISO_());
  const [dataFinsHist, setDataFinsHist] = useState(avuiISO_());

  // Filtres — Consums
  const [tipusConsumActius, setTipusConsumActius] = useState(() => {
    if (typeof window !== 'undefined') return carregarTipusConsumDesat();
    return ['aire'];
  });
  const [dataDesdeConsum, setDataDesdeConsum] = useState('');
  const [dataFinsConsum, setDataFinsConsum] = useState('');

  // 403 del backend (màquina d'un altre tenant) -> marca accés denegat en
  // lloc de tractar-ho com un error genèric; qualsevol altre error segueix
  // el camí normal (errorSessio_).
  const gestionaErrorFitxa_ = useCallback((err) => {
    if (err && err.status === 403) { setAccesDenegat(true); return; }
    errorSessio(err);
  }, [errorSessio]);

  const produccioCacheRef = useRef({});
  const clauProduccioVigentRef = useRef('');
  const clauFitxaVigentRef = useRef('');
  const anysPoblatsRef = useRef(false);
  const anysHistoricPoblatsRef = useRef(false);

  // Reinicia en canviar màquina
  //
  // React (Suspense/Activity) pot "reconnectar" els passive effects d'aquest
  // arbre —p.ex. en tornar-se a mostrar després d'estar offscreen— sense que
  // el component s'hagi desmuntat ni machineId hagi canviat de veritat. Quan
  // això passava, aquest efecte es re-executava igualment (les deps [machineId]
  // no ho eviten: un "reconnect" torna a córrer TOTS els efectes de muntatge)
  // i esborrava en silenci els filtres que l'usuari acabava de triar (torn,
  // referència...) uns segons després de seleccionar-los. Es guarda l'últim
  // machineId processat i només es reinicia si ha canviat de veritat.
  const machineIdProcessatRef = useRef(null);
  useEffect(() => {
    if (machineIdProcessatRef.current === machineId) return;
    machineIdProcessatRef.current = machineId;
    setMode('avui');
    setFiltreTorn([]);
    setFiltreReferencia('');
    setFiltreAny(String(new Date().getFullYear()));
    setFiltreMes(String(new Date().getMonth() + 1));
    setDataIniciPeriode('');
    setDataFiPeriode('');
    setFiltreTornHist([]);
    setFiltreAnyHist('');
    setFiltreMesHist('');
    setDataDesdeHist(avuiISO_());
    setDataFinsHist(avuiISO_());
    setDataDesdeConsum('');
    setDataFinsConsum('');
    setFitxa(null);
    setProduccio(null);
    setCronologiaDies([]);
    setCarregantCronologia(true);
    setConsums(null);
    setAccesDenegat(false);
    produccioCacheRef.current = {};
    anysPoblatsRef.current = false;
    anysHistoricPoblatsRef.current = false;
  }, [machineId]);

  // Flux "fitxa": capçalera + incidències actives + històric — mateixa
  // protecció contra respostes obsoletes que el flux "producció".
  useEffect(() => {
    if (!token || !machineId) return;
    const avui = avuiISO_();
    const dataDesdeCompartida = mode === 'avui' ? avui : (dataIniciPeriode || null);
    const dataFinsCompartida = mode === 'avui' ? avui : (dataFiPeriode || null);
    const teDatesExplicites = mode !== 'avui' && !!(dataIniciPeriode || dataFiPeriode);
    const anyCompartit = mode === 'avui' || teDatesExplicites ? null : (filtreAny || null);
    const mesCompartit = mode === 'avui' || teDatesExplicites ? null : (filtreMes || null);
    const clau = [machineId, mode, dataDesdeCompartida, dataFinsCompartida, anyCompartit, mesCompartit, filtreTorn.join(',')].join('|');
    clauFitxaVigentRef.current = clau;
    api.getFitxaMaquina(token, machineId, dataDesdeCompartida, dataFiInclusiva_(dataFinsCompartida), {
      any: anyCompartit, mes: mesCompartit, torns: filtreTorn,
    }).then((f) => {
      if (clauFitxaVigentRef.current !== clau) return; // resposta obsoleta
      setFitxa(f);
      setHorariUnic(!!f.horariUnic);
      setTornsClient(f.horariUnic ? [] : ((f.tornsClient && f.tornsClient.length) ? f.tornsClient : TOTS_TORNS));
      setDiesLaborables(Array.isArray(f.diesLaborables) && f.diesLaborables.length ? f.diesLaborables : [1, 2, 3, 4, 5]);
      // Bucle infinit: filtreTorn/filtreTornHist són deps d'aquest mateix
      // efecte — cridar setFiltreTornHist([]) SEMPRE (array nou cada cop)
      // encara que ja estigués buit feia que l'efecte es re-disparés
      // perpètuament. Només cal netejar-los si de veritat tenien contingut.
      if (f.horariUnic) {
        setFiltreTorn((prev) => (prev.length ? [] : prev));
        setFiltreTornHist((prev) => (prev.length ? [] : prev));
      }
      setMostrarReferencia(!!f.mostrarReferencia);
    }).catch(gestionaErrorFitxa_);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, machineId, mode, filtreAny, filtreMes, filtreTorn, dataIniciPeriode, dataFiPeriode]);

  // Flux "producció"
  //
  // Petició en curs ignorada si obsoleta: si l'usuari canvia el filtre de
  // torn (o qualsevol altre) abans que la petició anterior hagi tornat,
  // arribaven totes dues respostes i la que resolia MÉS TARD guanyava —
  // fins i tot si era la petició vella (sense el filtre nou). Es guarda
  // quina és la "clau" vigent en un ref; en resoldre's, si ja no coincideix
  // amb la vigent, es descarta la resposta en lloc d'aplicar-la.
  useEffect(() => {
    if (!token || !machineId) return;
    // En mode "Avui" la pàgina només pinta les dades d'AVUI (KPIs del dia i
    // la taula de parades, que igualment es retalla a avui) — però es
    // demanava el MES sencer de produccio+paradas+incidencies i es filtrava
    // després al navegador. Amb màquines actives són milers de documents
    // per pintar-ne uns pocs. El mes només es demana quan l'usuari entra de
    // veritat a "Període". Els desplegables (anys/referències) no depenen
    // d'aquest rang: el backend els calcula a part amb una agregació.
    const avuiIso_ = avuiISO_();
    const nomesAvui = mode === 'avui';
    const teDatesExplicites = !!(dataIniciPeriode || dataFiPeriode);
    const paramsRang = nomesAvui
      ? { any: null, mes: null, dataInici: avuiIso_, dataFi: avuiIso_ }
      : { any: teDatesExplicites ? null : (filtreAny || null), mes: teDatesExplicites ? null : (filtreMes || null), dataInici: dataIniciPeriode || null, dataFi: dataFiPeriode || null };
    const clau = [machineId, mode, paramsRang.any, paramsRang.mes, filtreTorn.join(','), filtreReferencia, paramsRang.dataInici, paramsRang.dataFi].join('|');
    clauProduccioVigentRef.current = clau;
    if (produccioCacheRef.current[clau]) { setProduccio(produccioCacheRef.current[clau]); return; }
    api.getProduccio(token, machineId, {
      ...paramsRang, torns: filtreTorn, referencia: filtreReferencia || null,
    }).then((p) => {
      produccioCacheRef.current[clau] = p;
      if (clauProduccioVigentRef.current !== clau) return; // resposta obsoleta
      setProduccio(p);
      if (!anysPoblatsRef.current) anysPoblatsRef.current = true;
    }).catch(gestionaErrorFitxa_);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, machineId, mode, filtreAny, filtreMes, filtreTorn, filtreReferencia, dataIniciPeriode, dataFiPeriode]);

  // Flux "cronologia": un dia (avui) o rang (période), max 30 dies
  //
  // React StrictMode (dev) munta cada efecte dues vegades en entrar a la
  // fitxa — sense guarda, arribaven les dues respostes i cadascuna cridava
  // setCronologiaDies amb un array NOU, fent que GraficCronologia es
  // reconstruís (i "parpellegés") dues vegades seguides. Mateix patró de
  // "clau vigent" que ja fan servir els fluxos fitxa/producció: només
  // s'aplica la resposta de la petició MÉS RECENT.
  const clauCronologiaVigentRef = useRef(0);
  useEffect(() => {
    if (!token || !machineId) return;
    const id = ++clauCronologiaVigentRef.current;
    setCarregantCronologia(true);
    if (mode === 'avui') {
      const avui = formatIso(new Date());
      api.getCronologia(token, machineId, avui).then((dia) => {
        if (clauCronologiaVigentRef.current !== id) return; // resposta obsoleta
        setCronologiaDies([{ dia: dia.data || avui, etiqueta: formatarData_(dia.data || avui), segments: dia.segments || [] }]);
        setCarregantCronologia(false);
      }).catch((err) => { if (clauCronologiaVigentRef.current === id) setCarregantCronologia(false); gestionaErrorFitxa_(err); });
      return;
    }
    // Mode periode: usa el rang de producció, limitat a 30 dies
    let dataInici = dataIniciPeriode;
    let dataFi = dataFiPeriode;
    if (!dataInici || !dataFi) {
      const any = Number(filtreAny || new Date().getFullYear());
      const mes = Number(filtreMes || (new Date().getMonth() + 1));
      dataInici = formatIso(new Date(any, mes - 1, 1));
      dataFi = formatIso(new Date(any, mes, 0));
    }
    // Clamp to 30 days
    const msInici = new Date(dataInici + 'T12:00:00').getTime();
    const msFi = new Date(dataFi + 'T12:00:00').getTime();
    if ((msFi - msInici) / 86400000 > 29) {
      dataInici = formatIso(new Date(msFi - 29 * 86400000));
    }
    api.getCronologiaRang(token, machineId, dataInici, dataFi).then((dades) => {
      if (clauCronologiaVigentRef.current !== id) return; // resposta obsoleta
      const dies = (Array.isArray(dades.dies) ? dades.dies : [])
        .map(dia => ({ dia: dia.data, etiqueta: formatarData_(dia.data), segments: dia.segments || [] }))
        .filter(dia => dia.segments.length > 0)
        .slice(-30);
      setCronologiaDies(dies);
      setCarregantCronologia(false);
    }).catch((err) => { if (clauCronologiaVigentRef.current === id) setCarregantCronologia(false); gestionaErrorFitxa_(err); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, machineId, mode, filtreAny, filtreMes, dataIniciPeriode, dataFiPeriode]);

  // Flux "consums"
  useEffect(() => {
    if (!token || !machineId || !carregarConsums) return;
    if (!tipusConsumActius.length) {
      setConsums({ consumPerTipus: {}, totalPerTipus: {}, totalPecesBones: 0, produccioPerDia: [], tipusActius: [] });
      return;
    }
    const rangCompartit = rangDatesProduccio_(mode, filtreAny, filtreMes, dataIniciPeriode, dataFiPeriode);
    api.getConsums(token, machineId, tipusConsumActius, rangCompartit.inici, rangCompartit.fi).then((c) => {
      setConsums({ ...c, tipusActius: tipusConsumActius });
    }).catch(gestionaErrorFitxa_);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, machineId, carregarConsums, tipusConsumActius, mode, filtreAny, filtreMes, dataIniciPeriode, dataFiPeriode]);

  // Preus (admin, per mostrar cost/peça)
  useEffect(() => {
    if (!token || !carregarConsums) return;
    api.getPreusConsum(token).then(setPreus).catch(() => {});
  }, [token, carregarConsums]);

  // Push instantani (SSE): si arriba un avís de LA màquina oberta, refetch
  // NOMÉS dels camps volàtils (estatActual, incidenciesActives, resumAvui)
  // via /estat-viu — mai la fitxa/producció senceres (nom, imatge, torns,
  // historial d'alarmes, paradas...), que ja estan en cache local des de la
  // càrrega inicial i no canvien a cada tick de producció. Merge superficial
  // sobre l'estat existent, no una substitució completa.
  const liveFitxaDebounceRef = useRef(null);
  const ultimLiveFetchRef = useRef(0);
  const ferRefetchFitxa_ = useCallback(() => {
    ultimLiveFetchRef.current = Date.now();
    api.getEstatViuMaquina(token, machineId, filtreReferencia || null, filtreTorn).then((v) => {
      // El simulador emet un tick SSE a cada cicle encara que els valors
      // visibles no hagin canviat (p.ex. entre peces senceres o mentre la
      // màquina està parada). Si res ha canviat de veritat, es retorna el
      // MATEIX objecte "prev" (no una còpia) — React (Object.is) es salta
      // el re-render sencer en lloc de refer-lo amb valors idèntics.
      setFitxa((prev) => {
        if (!prev) return prev;
        if (prev.estatActual === v.estatActual && iguals_(prev.incidenciesActives, v.incidenciesActives)) return prev;
        return { ...prev, estatActual: v.estatActual, incidenciesActives: v.incidenciesActives };
      });
      setProduccio((prev) => {
        if (!prev) return prev;
        if (iguals_(prev.resumAvui, v.resumAvui)) return prev;
        return { ...prev, resumAvui: v.resumAvui };
      });
      const clau = [machineId, filtreAny, filtreMes, filtreTorn.join(','), filtreReferencia, dataIniciPeriode, dataFiPeriode].join('|');
      if (produccioCacheRef.current[clau]) {
        produccioCacheRef.current[clau] = { ...produccioCacheRef.current[clau], resumAvui: v.resumAvui };
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, machineId, filtreAny, filtreMes, filtreTorn, filtreReferencia, dataIniciPeriode, dataFiPeriode]);

  useLiveEvents(token, useCallback((dades) => {
    if (!token || !machineId || dades?.machine_id !== machineId) return;
    clearTimeout(liveFitxaDebounceRef.current);
    const transcorregut = Date.now() - ultimLiveFetchRef.current;
    const espera = Math.max(400, 800 - transcorregut);
    liveFitxaDebounceRef.current = setTimeout(ferRefetchFitxa_, espera);
  }, [token, machineId, ferRefetchFitxa_]));

  function alternarTipusConsum(tipus) {
    setTipusConsumActius(prev => {
      const nou = prev.includes(tipus) ? prev.filter(t => t !== tipus) : [...prev, tipus];
      try { localStorage.setItem('monitor_consum_tipus', JSON.stringify(nou)); } catch (_) {}
      return nou;
    });
  }

  function canviarMode(nouMode) {
    if (nouMode === 'periode' && mode !== 'periode') {
      const rang = ultimsSetDiesLaborables_(diesLaborables);
      setDataIniciPeriode(rang.inici);
      setDataFiPeriode(rang.fi);
    }
    setMode(nouMode);
  }

  return {
    fitxa, produccio, cronologiaDies, carregantCronologia, consums, preus, accesDenegat,
    tornsClient, horariUnic, mostrarReferencia,
    mode, setMode: canviarMode,
    filtreTorn, setFiltreTorn,
    filtreReferencia, setFiltreReferencia,
    filtreAny, setFiltreAny,
    filtreMes, setFiltreMes,
    dataIniciPeriode, setDataIniciPeriode,
    dataFiPeriode, setDataFiPeriode,
    filtreTornHist, setFiltreTornHist,
    filtreAnyHist, setFiltreAnyHist,
    filtreMesHist, setFiltreMesHist,
    dataDesdeHist, setDataDesdeHist,
    dataFinsHist, setDataFinsHist,
    tipusConsumActius, alternarTipusConsum,
    dataDesdeConsum, setDataDesdeConsum,
    dataFinsConsum, setDataFinsConsum,
    anysHistoricPoblatsRef,
  };
}
