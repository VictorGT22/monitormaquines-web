'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api';
import { useAuth } from './auth-context';
import { formatarData_ } from './format';

const TOTS_TORNS = ['Matí', 'Tarda', 'Nit'];

function formatIso(data) {
  return data.toISOString().slice(0, 10);
}

function carregarTipusConsumDesat() {
  try {
    const desat = JSON.parse(localStorage.getItem('monitor_consum_tipus') || 'null');
    if (Array.isArray(desat) && desat.length) return desat;
  } catch (_) {}
  return ['aire'];
}

export function useFitxa(machineId) {
  const { token, errorSessio } = useAuth();

  const [fitxa, setFitxa] = useState(null);
  const [produccio, setProduccio] = useState(null);
  const [cronologiaDies, setCronologiaDies] = useState([]);
  const [consums, setConsums] = useState(null);
  const [preus, setPreus] = useState(null);
  const [tornsClient, setTornsClient] = useState(TOTS_TORNS);
  const [mostrarReferencia, setMostrarReferencia] = useState(false);

  // Filtres — Producció / Cronologia (mode compartit)
  const [mode, setMode] = useState('avui');
  const [filtreTorn, setFiltreTorn] = useState([]);
  const [filtreReferencia, setFiltreReferencia] = useState('');
  const [filtreAny, setFiltreAny] = useState('');
  const [filtreMes, setFiltreMes] = useState(String(new Date().getMonth() + 1));
  const [dataIniciPeriode, setDataIniciPeriode] = useState('');
  const [dataFiPeriode, setDataFiPeriode] = useState('');

  // Filtres — Històric
  const [filtreTornHist, setFiltreTornHist] = useState([]);
  const [filtreAnyHist, setFiltreAnyHist] = useState('');
  const [filtreMesHist, setFiltreMesHist] = useState('');
  const [dataDesdeHist, setDataDesdeHist] = useState('');
  const [dataFinsHist, setDataFinsHist] = useState('');

  // Filtres — Consums
  const [tipusConsumActius, setTipusConsumActius] = useState(() => {
    if (typeof window !== 'undefined') return carregarTipusConsumDesat();
    return ['aire'];
  });
  const [dataDesdeConsum, setDataDesdeConsum] = useState('');
  const [dataFinsConsum, setDataFinsConsum] = useState('');

  const produccioCacheRef = useRef({});
  const anysPoblatsRef = useRef(false);
  const anysHistoricPoblatsRef = useRef(false);

  // Reinicia en canviar màquina
  useEffect(() => {
    setMode('avui');
    setFiltreTorn([]);
    setFiltreReferencia('');
    setFiltreAny('');
    setFiltreMes(String(new Date().getMonth() + 1));
    setDataIniciPeriode('');
    setDataFiPeriode('');
    setFiltreTornHist([]);
    setFiltreAnyHist('');
    setFiltreMesHist('');
    setDataDesdeHist('');
    setDataFinsHist('');
    setDataDesdeConsum('');
    setDataFinsConsum('');
    setFitxa(null);
    setProduccio(null);
    setCronologiaDies([]);
    setConsums(null);
    produccioCacheRef.current = {};
    anysPoblatsRef.current = false;
    anysHistoricPoblatsRef.current = false;
  }, [machineId]);

  // Flux "fitxa": capçalera + incidències actives + històric
  useEffect(() => {
    if (!token || !machineId) return;
    api.getFitxaMaquina(token, machineId, dataDesdeHist || null, dataFinsHist || null, {
      any: filtreAnyHist || null, mes: filtreMesHist || null, torns: filtreTornHist,
    }).then((f) => {
      setFitxa(f);
      setTornsClient((f.tornsClient && f.tornsClient.length) ? f.tornsClient : TOTS_TORNS);
      setMostrarReferencia(!!f.mostrarReferencia);
    }).catch(errorSessio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, machineId, dataDesdeHist, dataFinsHist, filtreAnyHist, filtreMesHist, filtreTornHist]);

  // Flux "producció"
  useEffect(() => {
    if (!token || !machineId) return;
    const clau = [machineId, filtreAny, filtreMes, filtreTorn.join(','), filtreReferencia, dataIniciPeriode, dataFiPeriode].join('|');
    if (produccioCacheRef.current[clau]) { setProduccio(produccioCacheRef.current[clau]); return; }
    api.getProduccio(token, machineId, {
      any: filtreAny || null, mes: filtreMes || null, torns: filtreTorn,
      referencia: filtreReferencia || null, dataInici: dataIniciPeriode || null, dataFi: dataFiPeriode || null,
    }).then((p) => {
      produccioCacheRef.current[clau] = p;
      setProduccio(p);
      if (!anysPoblatsRef.current) {
        anysPoblatsRef.current = true;
        const actual = new Date().getFullYear();
        if (!filtreAny && (p.anysDisponibles || []).includes(actual)) setFiltreAny(String(actual));
      }
    }).catch(errorSessio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, machineId, filtreAny, filtreMes, filtreTorn, filtreReferencia, dataIniciPeriode, dataFiPeriode]);

  // Flux "cronologia": un dia (avui) o rang (période), max 30 dies
  useEffect(() => {
    if (!token || !machineId) return;
    if (mode === 'avui') {
      const avui = formatIso(new Date());
      api.getCronologia(token, machineId, avui).then((dia) => {
        setCronologiaDies([{ dia: dia.data || avui, etiqueta: formatarData_(dia.data || avui), segments: dia.segments || [] }]);
      }).catch(errorSessio);
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
      const dies = (Array.isArray(dades.dies) ? dades.dies : [])
        .map(dia => ({ dia: dia.data, etiqueta: formatarData_(dia.data), segments: dia.segments || [] }))
        .filter(dia => dia.segments.length > 0)
        .slice(-30);
      setCronologiaDies(dies);
    }).catch(errorSessio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, machineId, mode, filtreAny, filtreMes, dataIniciPeriode, dataFiPeriode]);

  // Flux "consums"
  useEffect(() => {
    if (!token || !machineId) return;
    if (!tipusConsumActius.length) {
      setConsums({ consumPerTipus: {}, totalPerTipus: {}, totalPecesBones: 0, produccioPerDia: [], tipusActius: [] });
      return;
    }
    api.getConsums(token, machineId, tipusConsumActius, dataDesdeConsum || null, dataFinsConsum || null).then((c) => {
      setConsums({ ...c, tipusActius: tipusConsumActius });
    }).catch(errorSessio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, machineId, tipusConsumActius, dataDesdeConsum, dataFinsConsum]);

  // Preus (admin, per mostrar cost/peça)
  useEffect(() => {
    if (!token) return;
    api.getPreusConsum(token).then(setPreus).catch(() => {});
  }, [token]);

  function alternarTipusConsum(tipus) {
    setTipusConsumActius(prev => {
      const nou = prev.includes(tipus) ? prev.filter(t => t !== tipus) : [...prev, tipus];
      try { localStorage.setItem('monitor_consum_tipus', JSON.stringify(nou)); } catch (_) {}
      return nou;
    });
  }

  return {
    fitxa, produccio, cronologiaDies, consums, preus,
    tornsClient, mostrarReferencia,
    mode, setMode,
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
