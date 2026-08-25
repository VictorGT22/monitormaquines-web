'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api';
import { useAuth } from './auth-context';

const TOTS_TORNS = ['Matí', 'Tarda', 'Nit'];

/**
 * Port de l'estat/flux de dades de la vista Fitxa (obrirFitxa/carregarDetallMaquina/
 * carregarProduccio/carregarFitxa/carregarHistoric_). A l'original hi ha 4 funcions
 * de càrrega imperatives lleugerament redundants entre elles (veure auditoria de
 * la migració); aquí es simplifiquen a 2 fluxos observablement equivalents:
 *  - "fitxa": capçalera + incidències actives + històric — depèn dels filtres
 *    d'Històric (any/mes/torn/desde/fins).
 *  - "producció": KPIs/gràfic/taula de producció — depèn dels filtres de
 *    Producció (any/mes/torn/referència/rang de dates del període).
 */
export function useFitxa(machineId) {
  const { token, errorSessio } = useAuth();

  const [fitxa, setFitxa] = useState(null);
  const [produccio, setProduccio] = useState(null);
  const [tornsClient, setTornsClient] = useState(TOTS_TORNS);
  const [mostrarReferencia, setMostrarReferencia] = useState(false);

  // Filtres — Producció
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

  const produccioCacheRef = useRef({});
  const anysPoblatsRef = useRef(false);
  const referenciaPoblatRef = useRef(false);
  const anysHistoricPoblatsRef = useRef(false);

  // Reinicia tots els filtres en obrir una màquina diferent — port de la
  // part inicial d'obrirFitxa().
  useEffect(() => {
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
    setFitxa(null);
    setProduccio(null);
    produccioCacheRef.current = {};
    anysPoblatsRef.current = false;
    referenciaPoblatRef.current = false;
    anysHistoricPoblatsRef.current = false;
  }, [machineId]);

  // Flux "fitxa": capçalera + incidències actives + històric.
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

  // Flux "producció": KPIs/gràfic/taula, amb la mateixa cache per combinació
  // de filtres que produccioCache_ a l'original (evita repetir la mateixa
  // petició en tornar a passar pels mateixos filtres).
  useEffect(() => {
    if (!token || !machineId) return;
    const clau = [machineId, filtreAny, filtreMes, filtreTorn.join(','), filtreReferencia, dataIniciPeriode, dataFiPeriode].join('|');
    if (produccioCacheRef.current[clau]) {
      setProduccio(produccioCacheRef.current[clau]);
      return;
    }
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
      referenciaPoblatRef.current = true;
    }).catch(errorSessio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, machineId, filtreAny, filtreMes, filtreTorn, filtreReferencia, dataIniciPeriode, dataFiPeriode]);

  return {
    fitxa, produccio, tornsClient, mostrarReferencia,
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
    anysHistoricPoblatsRef,
  };
}
