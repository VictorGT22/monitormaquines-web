'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useFitxa } from '../../lib/useFitxa';
import * as api from '../../lib/api';
import { t, DICC } from '../../lib/i18n';
import {
  formatarData_,
  formatarDataHora_,
  formatarDurada_,
  formatarHoresMin_,
  formatarNumero_,
  avuiISO_,
  calcularDuradaMin_
} from '../../lib/format';
import { calcularTorn_ } from '../../lib/torns';
import { IconaWifiOff, IconaCabal, IconaConsum } from '../../lib/icons';
import TornChips from '../../components/TornChips';
import TornCell from '../../components/TornCell';
import OeeKpi from '../../components/OeeKpi';
import DatePickerInput from '../../components/DatePickerInput';
import GraficProduccio from '../../components/GraficProduccio';
import GraficHistoric from '../../components/GraficHistoric';
import GraficCronologia from '../../components/GraficCronologia';
import GraficConsums, { KpisConsums } from '../../components/GraficConsums';
import PanellManteniment from '../../components/PanellManteniment';
import AppSelect from '../../components/AppSelect';

const COLORS_TORN = { Matí: '#f6c453', Tarda: '#4da3ff', Nit: '#b582f8' };
const APARTATS_FITXA = ['panell-produccio', 'panell-cronologia', 'panell-parades', 'panell-historic', 'panell-consums', 'panell-manteniment'];
// Es conserva el JSX dels filtres antics per poder recuperar-los ràpidament,
// però Alarmes i Consums fan servir ara els filtres compartits de Producció.
const MOSTRAR_FILTRES_ESPECIFICS = false;

function scrollA(id) {
  const desti = document.getElementById(id);
  if (!desti) return;
  const reduitMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  desti.scrollIntoView({ behavior: reduitMotion ? 'auto' : 'smooth', block: 'start' });
}

function resaltarFila(selectorTaula, timestampInici) {
  if (!timestampInici) return;
  const fila = document.querySelector(selectorTaula + ' tr[data-timestamp="' + timestampInici + '"]');
  if (!fila) return;
  fila.scrollIntoView({ behavior: 'smooth', block: 'center' });
  fila.classList.add('fila-realçada');
  setTimeout(() => fila.classList.remove('fila-realçada'), 2500);
}

// Ritme de producció: mitjana de peces/hora d'avui (peces bones ÷ hores
// actives) i tendència recent — compara el ritme dels últims ~10 min amb la
// mitjana del dia. Es guarda un petit historial de mostres {pecesBones,
// timestamp} en lloc de comparar tick a tick, perquè el refresc SSE arriba
// cada 1-2s i un sol tick sense peces noves donaria un "ritme instantani" 0
// sorollós — la finestra de 10 min allisa aquest soroll.
const FINESTRA_TENDENCIA_MS = 10 * 60000;
const MARGE_TENDENCIA = 0.1; // ±10% es considera "estable"

function useTendenciaProduccio(resumAvui) {
  const historialRef = useRef([]);
  const [tendencia, setTendencia] = useState('estable');

  const pecesBones = resumAvui?.pecesBones;
  const tempsActiuMin = resumAvui?.tempsActiuMin;

  useEffect(() => {
    if (pecesBones === undefined) return;
    const ara = Date.now();
    const historial = historialRef.current;
    historial.push({ pecesBones, ts: ara });
    while (historial.length > 1 && ara - historial[0].ts > FINESTRA_TENDENCIA_MS) historial.shift();

    const mitjanaPerHora = tempsActiuMin > 0 ? (pecesBones / (tempsActiuMin / 60)) : 0;

    if (historial.length < 2 || !mitjanaPerHora) { setTendencia('estable'); return; }
    const primer = historial[0];
    const horesFinestra = (ara - primer.ts) / 3600000;
    if (horesFinestra < 1 / 60) { setTendencia('estable'); return; } // menys d'1 min de mostres, encara no fiable
    const ritmeRecent = (pecesBones - primer.pecesBones) / horesFinestra;

    if (ritmeRecent > mitjanaPerHora * (1 + MARGE_TENDENCIA)) setTendencia('pujant');
    else if (ritmeRecent < mitjanaPerHora * (1 - MARGE_TENDENCIA)) setTendencia('baixant');
    else setTendencia('estable');
  }, [pecesBones, tempsActiuMin]);

  const mitjanaPerHora = tempsActiuMin > 0 ? Math.round(pecesBones / (tempsActiuMin / 60)) : 0;
  return { mitjanaPerHora, tendencia };
}

function FitxaContent() {
  const router = useRouter();
  const machineId = useSearchParams().get('id');
  const { token, sessio, errorSessio } = useAuth();
  const idioma = sessio?.idioma || 'ca';
  const [apartatActiu, setApartatActiu] = useState('panell-produccio');
  const [vistaFitxa, setVistaFitxa] = useState('produccio');
  const [consumsActivatsPerMaquina, setConsumsActivatsPerMaquina] = useState(null);

  const {
    fitxa, produccio, cronologiaDies, carregantCronologia, consums, preus, accesDenegat,
    tornsClient, horariUnic, mostrarReferencia,
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
  } = useFitxa(machineId, { carregarConsums: consumsActivatsPerMaquina === machineId });

  const [mostrarTaulaProduccio, setMostrarTaulaProduccio] = useState(false);
  // Menú superior de la fitxa: Producció (tot el que hi havia fins ara),
  // Manteniment (targetes + futurs elements) i Resum (dades de la màquina,
  // encara per definir). L'antic fitxa-subnav (scroll-spy per ancores) NOMÉS
  // té sentit dins la vista Producció.
  const [mantenimentResum, setMantenimentResum] = useState(null);
  const [consumsResum, setConsumsResum] = useState(null);
  const [diesHistoric, setDiesHistoric] = useState([]);
  const LIMIT_LLISTA = 10;
  const [totesParades, setTotesParades] = useState(false);
  const [totHistoric, setTotHistoric] = useState(false);
  const [mesProduccioMobil, setMesProduccioMobil] = useState(false);
  const [mesParadesMobil, setMesParadesMobil] = useState(false);
  const [mesHistoricMobil, setMesHistoricMobil] = useState(false);
  useEffect(() => {
    setTotesParades(false);
    setTotHistoric(false);
    setMesProduccioMobil(false);
    setMesParadesMobil(false);
    setMesHistoricMobil(false);
    setApartatActiu('panell-produccio');
    setVistaFitxa('produccio');
    setConsumsActivatsPerMaquina(null);
    setMantenimentResum(null);
    setConsumsResum(null);
  }, [machineId]);

  useEffect(() => {
    if (!token || !machineId || vistaFitxa !== 'resum') return;
    let vigent = true;
    const avui = avuiISO_();
    api.getConsums(token, machineId, ['aire', 'electric'], avui, avui).then((dades) => {
      if (vigent) setConsumsResum(dades);
    }).catch((err) => {
      if (err?.status !== 403) errorSessio(err);
    });
    return () => { vigent = false; };
  }, [token, machineId, vistaFitxa, errorSessio]);

  // Accés directe per URL a una màquina no autoritzada (backend 403) ->
  // fora, en lloc de deixar panells buits amb un banner d'error genèric.
  useEffect(() => { if (accesDenegat) router.replace('/'); }, [accesDenegat, router]);

  const graficProduccioRef = useRef(null);
  const graficHistoricRef = useRef(null);
  const graficCronologiaRef = useRef(null);

  useEffect(() => {
    const contenidor = document.getElementById('fitxa-scroll');
    if (!contenidor) return;
    function actualitzarApartat() {
      const limit = contenidor.getBoundingClientRect().top + 72;
      let actiu = APARTATS_FITXA[0];
      for (const id of APARTATS_FITXA) {
        const apartat = document.getElementById(id);
        if (apartat && apartat.getBoundingClientRect().top <= limit) actiu = id;
      }
      setApartatActiu(actiu);
      if (actiu === 'panell-consums' && machineId) setConsumsActivatsPerMaquina(machineId);
    }
    actualitzarApartat();
    contenidor.addEventListener('scroll', actualitzarApartat, { passive: true });
    window.addEventListener('resize', actualitzarApartat);
    return () => {
      contenidor.removeEventListener('scroll', actualitzarApartat);
      window.removeEventListener('resize', actualitzarApartat);
    };
  }, [machineId]);

  function anarApartat(id) {
    setApartatActiu(id);
    if (id === 'panell-consums' && machineId) setConsumsActivatsPerMaquina(machineId);
    scrollA(id);
  }

  const { mitjanaPerHora, tendencia } = useTendenciaProduccio(produccio?.resumAvui);

  function alternarTorn(torn) {
    setFiltreTorn((prev) => (prev.indexOf(torn) !== -1 ? prev.filter((v) => v !== torn) : [...prev, torn]));
  }

  function alternarTornHist(torn) {
    setFiltreTornHist((prev) => (prev.indexOf(torn) !== -1 ? prev.filter((v) => v !== torn) : [...prev, torn]));
  }

  // Durada calculada un sol cop aquí i reutilitzada tant a la taula
  // d'alarmes com al gràfic (GraficHistoric) — evita duplicar el càlcul.
  // Memoritzat sobre fitxa?.incidenciesHistoric (no sobre "fitxa" sencer):
  // cada tick SSE (ferRefetchFitxa_) fa setFitxa(prev => ({...prev, ...}))
  // canviant la referència de "fitxa" però mantenint el MATEIX array
  // incidenciesHistoric — sense aquest useMemo es generava un array nou a
  // cada render igualment, i GraficHistoric (efecte amb deps [historic])
  // reconstruïa tot el gràfic (parpelleig) a cada estat-viu encara que les
  // alarmes no haguessin canviat gens.
  // useMemo abans de qualsevol "return" condicional: React exigeix que
  // TOTS els hooks es cridin sempre en el mateix ordre a cada render — si
  // es queda després d'un "if (...) return", quan la condició es compleix
  // es crida un hook menys que en renders anteriors ("Rendered fewer hooks
  // than expected").
  const incidenciesHistoricAmbDurada = useMemo(() => (fitxa?.incidenciesHistoric || []).map((i) => {
    const d = calcularDuradaMin_(i.timestampInici, i.timestampFi);
    return { ...i, duradaMin: d?.min ?? null, duradaSeg: d?.seg ?? null };
  }), [fitxa?.incidenciesHistoric]);

  // Taula d'alarmes: les actives (sense timestampFi) es mostren a dalt de
  // tot amb "En curs", igual que ja fa la taula de Parades — s'ha eliminat
  // el panell "Incidències actives" separat perquè aquesta llista ja les
  // cobreix totes. No s'afegeixen a incidenciesHistoricAmbDurada (que
  // alimenta el GraficHistoric, pensat per alarmes ja tancades amb durada).
  const incidenciesActivesAmbDurada = useMemo(() => (fitxa?.incidenciesActives || []).map((i) => ({
    ...i, activa: true, duradaMin: null, duradaSeg: null,
  })), [fitxa?.incidenciesActives]);
  const incidenciesTaula = useMemo(() => [...incidenciesActivesAmbDurada, ...incidenciesHistoricAmbDurada],
    [incidenciesActivesAmbDurada, incidenciesHistoricAmbDurada]);

  if (!machineId) {
    return <div className="empty-state">Cap màquina seleccionada.</div>;
  }
  if (accesDenegat) return null;

  const estat = fitxa?.estatActual;
  const clicableEstat = estat === 'alarma' || estat === 'parada';
  const resumAvui = produccio?.resumAvui || null;
  const incidenciesActivesResum = fitxa?.incidenciesActives || [];
  const tasquesMantenimentResum = mantenimentResum?.tasques || [];
  const proximaTascaManteniment = tasquesMantenimentResum.find((tasca) => tasca.vencuda) || [...tasquesMantenimentResum]
    .filter((tasca) => tasca.dataEstimadaProxima)
    .sort((a, b) => new Date(a.dataEstimadaProxima) - new Date(b.dataEstimadaProxima))[0] || null;
  const tornActualResum = horariUnic ? t(idioma, 'torn_unic') : calcularTorn_(new Date().toISOString());
  const percentOeeResum = Math.round((Number(resumAvui?.oee) || 0) * 100);
  const percentQualitatResum = Math.round((Number(resumAvui?.qualitat) || 0) * 100);
  const totalElectricResum = Number(consumsResum?.totalPerTipus?.electric) || 0;
  const totalAireResum = Number(consumsResum?.totalPerTipus?.aire) || 0;

  // Paradas: la taula no tenia cap filtre propi i sempre mostrava el
  // llistat sencer de la màquina. Es reutilitza el mateix abast temporal
  // que ja governa Producció (Avui/Període + Any/Mes/Desde-Fins) en lloc
  // de crear un segon selector redundant — per defecte, doncs, només
  // "avui", igual que Producció.
  const avui_ = avuiISO_();
  function dinsAbastProduccio_(iniciIso) {
    const dataIso = iniciIso.slice(0, 10);
    if (mode === 'avui') return dataIso === avui_;
    if (dataIniciPeriode && dataFiPeriode) return dataIso >= dataIniciPeriode && dataIso <= dataFiPeriode;
    if (filtreAny) {
      if (dataIso.slice(0, 4) !== filtreAny) return false;
      if (filtreMes && Number(dataIso.slice(5, 7)) !== Number(filtreMes)) return false;
    }
    return true;
  }
  const paradasFiltrades = (produccio?.paradas || []).filter((pa) =>
    dinsAbastProduccio_(pa.inici) && (!filtreTorn.length || filtreTorn.includes(calcularTorn_(pa.inici)))
  );

  // Selecció d'una fila (Paradas o Alarmes) -> realça la fila i marca el
  // segment corresponent a la cronologia, desplaçant-hi la vista si cal.
  // Reutilitza el mateix resaltarFila()/scrollA() que ja fa servir el salt
  // invers (cronologia -> taula) a onJumpHistoric/onJumpParades.
  function seleccionarFila_(selectorTaula, timestampInici) {
    resaltarFila(selectorTaula, timestampInici);
    scrollA('panell-cronologia');
    setTimeout(() => graficCronologiaRef.current?.resaltarSegment(timestampInici), 450);
  }

  function seleccionarAlarma_(alarma) {
    if (!alarma) return;
    const index = (fitxa?.incidenciesHistoric || []).findIndex((i) => i.timestampInici === alarma.timestampInici);
    const calCarregarTotes = !totHistoric && index >= LIMIT_LLISTA;
    if (calCarregarTotes) setTotHistoric(true);
    graficHistoricRef.current?.mostrarTooltip(diesHistoric.findIndex((d) => d.data.slice(0, 10) === alarma.timestampInici.slice(0, 10)));
    // Si la fila encara no era al DOM (fora del límit de 10), cal esperar
    // que React pinti la llista sencera abans de poder-la realçar.
    if (calCarregarTotes) setTimeout(() => seleccionarFila_('#historic-taula', alarma.timestampInici), 60);
    else seleccionarFila_('#historic-taula', alarma.timestampInici);
  }

  return (
    <div id="fitxa-view">
      <span className="back-link" onClick={() => router.push('/')}>
        &larr; {t(idioma, 'totesMaquines')}
      </span>

      <div className="fitxa-sticky" id="fitxa-sticky">
        <div className="fitxa-header">
          <div className="img-placeholder">
            {fitxa?.imatgeUrl ? <img src={fitxa.imatgeUrl} alt="" /> : t(idioma, 'senseImatge')}
          </div>
          <div>
            <h2>{fitxa?.nom}</h2>
            {estat && (
              <span
                className={'estat-badge estat-' + estat + (clicableEstat ? ' clicable' : '')}
                onClick={clicableEstat ? () => scrollA(estat === 'alarma' ? 'panell-historic' : 'panell-parades') : undefined}
              >
                {estat === 'incomunicada' && <IconaWifiOff />}
                {t(idioma, 'estat_' + estat)}
              </span>
            )}
          </div>
        </div>

        <nav className="fitxa-vistes">
          <button type="button" className={'nav-tab' + (vistaFitxa === 'resum' ? ' actiu' : '')} onClick={() => setVistaFitxa('resum')}>{t(idioma, 'resum_titol')}</button>
          <button type="button" className={'nav-tab' + (vistaFitxa === 'produccio' ? ' actiu' : '')} onClick={() => setVistaFitxa('produccio')}>{t(idioma, 'produccio_titol')}</button>
          <button type="button" className={'nav-tab' + (vistaFitxa === 'manteniment' ? ' actiu' : '')} onClick={() => setVistaFitxa('manteniment')}>{t(idioma, 'manteniment_titol')}</button>
        </nav>

        {vistaFitxa === 'produccio' && (
          <nav className="fitxa-subnav">
            <a className={apartatActiu === 'panell-produccio' ? 'actiu' : ''} onClick={() => anarApartat('panell-produccio')}>{t(idioma, 'produccio_titol')}</a>
            <a className={apartatActiu === 'panell-cronologia' ? 'actiu' : ''} onClick={() => anarApartat('panell-cronologia')}>{t(idioma, 'cronologia_titol')}</a>
            <a className={apartatActiu === 'panell-parades' ? 'actiu' : ''} onClick={() => anarApartat('panell-parades')}>{t(idioma, 'paradas_titol')}</a>
            <a className={apartatActiu === 'panell-historic' ? 'actiu' : ''} onClick={() => anarApartat('panell-historic')}>{t(idioma, 'historic_titol')}</a>
            <a className={apartatActiu === 'panell-consums' ? 'actiu' : ''} onClick={() => anarApartat('panell-consums')}>{t(idioma, 'consums_titol')}</a>
          </nav>
        )}
      </div>

      <div className="fitxa-scroll" id="fitxa-scroll">

      {/* Sempre muntat (visibilitat per CSS, no per desmuntatge condicional):
          PanellManteniment fa la seva pròpia crida en muntar-se — si es
          desmuntava cada cop que es sortia de la pestanya, tornava a
          demanar les dades a cada visita en lloc de mantenir-les en cache.
          El mateix criteri s'aplica a "resum" i "produccio" més avall. */}
      {(vistaFitxa === 'manteniment' || vistaFitxa === 'resum' || mantenimentResum) && (
        <div className="panell" id="panell-manteniment" style={{ display: vistaFitxa === 'manteniment' ? undefined : 'none' }}>
          <h3>{t(idioma, 'manteniment_titol')}</h3>
          <PanellManteniment machineId={machineId} onDadesCanvi={setMantenimentResum} />
        </div>
      )}

      <div className="resum-dashboard" id="panell-resum" style={{ display: vistaFitxa === 'resum' ? undefined : 'none' }}>
          <section className={'resum-capcalera resum-capcalera-' + (estat || 'incomunicada')}>
            <div>
              <span className="resum-kicker">ESTAT DEL TORN ACTUAL</span>
              <div className="resum-estat-linia">
                <span className="resum-estat-dot" />
                <strong>{estat ? t(idioma, 'estat_' + estat) : 'Sense dades'}</strong>
              </div>
              <p>{tornActualResum}</p>
            </div>
            <div className="resum-actualitzat">
              <span>Actualització</span>
              <strong>{estat === 'incomunicada' ? 'Connexió interrompuda' : 'En temps real'}</strong>
            </div>
          </section>

          <section className="resum-kpis" aria-label="Indicadors principals">
            <article className="resum-kpi resum-kpi-produccio">
              <div className="resum-kpi-head"><span>Producció d’avui</span></div>
              <strong>{formatarNumero_(idioma, resumAvui?.pecesBones || 0)}</strong><small>peces bones</small>
              <p>{formatarNumero_(idioma, resumAvui?.pecesMerma || 0)} peces de merma · {Number(resumAvui?.percentMerma) || 0}%</p>
            </article>
            <article className="resum-kpi">
              <div className="resum-kpi-head"><span>Ritme mitjà</span><em>{tendencia === 'pujant' ? '↑' : tendencia === 'baixant' ? '↓' : '='}</em></div>
              <strong>{formatarNumero_(idioma, mitjanaPerHora)}</strong><small>peces/h</small>
              <p>Tendència {tendencia === 'pujant' ? 'ascendent' : tendencia === 'baixant' ? 'descendent' : 'estable'}</p>
            </article>
            <article className="resum-kpi resum-kpi-oee">
              <div className="resum-kpi-head"><span>OEE</span></div>
              <strong>{percentOeeResum}%</strong><small>eficiència global</small>
              <p>Qualitat {percentQualitatResum}% · Disponibilitat {Math.round((Number(resumAvui?.disponibilitat) || 0) * 100)}%</p>
            </article>
            <article className="resum-kpi resum-kpi-temps">
              <div className="resum-kpi-head"><span>Temps productiu</span><em>{Math.round((Number(resumAvui?.disponibilitat) || 0) * 100)}%</em></div>
              <strong>{formatarHoresMin_(resumAvui?.tempsActiuMin || 0)}</strong><small>en marxa</small>
              <p>{formatarHoresMin_(resumAvui?.tempsParatMin || 0)} de parada acumulada</p>
            </article>
          </section>

          <div className="resum-graella">
            <section className="resum-bloc resum-evolucio">
              <div className="resum-bloc-head">
                <div><span>AVUI</span><h4>Cronologia de la màquina</h4></div>
              </div>
              {cronologiaDies.length ? <GraficCronologia dies={cronologiaDies} tornsActius={[]} referencia={null} idioma={idioma} /> : <div className="empty-state">Encara no hi ha activitat avui.</div>}
            </section>

            <aside className="resum-columna">
              <section className="resum-bloc resum-alertes">
                <div className="resum-bloc-head"><div><span>ATENCIÓ</span><h4>Incidències actives</h4></div><b>{incidenciesActivesResum.length}</b></div>
                {incidenciesActivesResum.length ? incidenciesActivesResum.slice(0, 3).map((incidencia, index) => <div className="resum-alerta resum-alerta-ambre" key={index}><i>!</i><div><strong>{incidencia.codi}</strong><span>{incidencia.missatge}</span></div></div>) : <div className="resum-sense-alertes">Cap incidència activa</div>}
              </section>
              <section className="resum-bloc resum-context">
                <div className="resum-bloc-head"><div><span>CONFIGURACIÓ ACTIVA</span><h4>Context de treball</h4></div></div>
                <dl>
                  <div><dt>Torn</dt><dd>{tornActualResum}</dd></div>
                  {mostrarReferencia && <div><dt>Referència</dt><dd>{filtreReferencia || 'Totes'}</dd></div>}
                  <div><dt>Estat</dt><dd>{estat ? t(idioma, 'estat_' + estat) : 'Sense dades'}</dd></div>
                </dl>
              </section>
            </aside>
          </div>

          <section className="resum-indicadors-extra">
            <article><i className="resum-extra-qualitat">✓</i><div><span>Qualitat</span><strong>{percentQualitatResum}%</strong><small>{formatarNumero_(idioma, resumAvui?.pecesMerma || 0)} peces de merma</small></div></article>
            <article><i className="resum-extra-electric">ϟ</i><div><span>Consum elèctric</span><strong>{formatarNumero_(idioma, totalElectricResum, 2)} kWh</strong><small>Consum acumulat avui</small></div></article>
            <article><i className="resum-extra-aire">◌</i><div><span>Consum pneumàtic</span><strong>{formatarNumero_(idioma, totalAireResum, 2)} m³</strong><small>Consum acumulat avui</small></div></article>
            <article><i className="resum-extra-manteniment">↻</i><div><span>Pròxim manteniment</span><strong>{proximaTascaManteniment ? (proximaTascaManteniment.vencuda ? 'Vençut' : formatarData_(proximaTascaManteniment.dataEstimadaProxima)) : 'Sense tasques'}</strong><small>{proximaTascaManteniment?.nom || 'Cap manteniment configurat'}</small></div></article>
          </section>
      </div>

      <div style={{ display: vistaFitxa === 'produccio' ? undefined : 'none' }}>
        {/* ── Producció ──────────────────────────────────────────── */}
        <div className="panell" id="panell-produccio">
          <h3>{t(idioma, 'produccio_titol')}</h3>

          <div className="subtabs">
            <button type="button" className={'nav-tab' + (mode === 'avui' ? ' actiu' : '')} onClick={() => setMode('avui')}>
              {t(idioma, 'mode_avui')}
            </button>
            <button type="button" className={'nav-tab' + (mode === 'periode' ? ' actiu' : '')} onClick={() => setMode('periode')}>
              {t(idioma, 'mode_periode')}
            </button>
          </div>

          <div className={'filtres-historic filtres-produccio-compactes filtres-produccio-unificats' + (mode === 'periode' ? ' amb-periode' : '') + (!mostrarReferencia ? ' sense-referencia' : '')}>
            {horariUnic ? <div>
              <label>{t(idioma, 'f_torn')}</label>
              <div className="torns-chips"><span className="torn-chip torn-chip-unic actiu">{t(idioma, 'torn_unic')}</span></div>
            </div> : <div>
              <label>{t(idioma, 'f_torn')}</label>
              <TornChips torns={tornsClient} actius={filtreTorn} onToggle={alternarTorn} idioma={idioma} />
            </div>}
            {mostrarReferencia && (
              <div>
                <label>{t(idioma, 'f_referencia')}</label>
                <AppSelect ariaLabel={t(idioma, 'f_referencia')} value={filtreReferencia} onChange={setFiltreReferencia} options={[
                  { value: '', label: t(idioma, 'f_totes') },
                  ...(produccio?.referenciesDisponibles || []).map((r) => ({ value: r, label: r })),
                ]} />
              </div>
            )}
            {mode === 'periode' && produccio?.resum && <>
              <div>
                <label>{t(idioma, 'f_any')}</label>
                <AppSelect ariaLabel={t(idioma, 'f_any')} value={filtreAny} onChange={setFiltreAny} options={[
                  { value: '', label: t(idioma, 'f_tots') },
                  ...(produccio.anysDisponibles || []).map((a) => ({ value: a, label: a })),
                ]} />
              </div>
              <div>
                <label>{t(idioma, 'f_mes')}</label>
                <AppSelect ariaLabel={t(idioma, 'f_mes')} value={filtreMes} onChange={setFiltreMes} options={[
                  { value: '', label: t(idioma, 'f_tots') },
                  ...t(idioma, 'mesos').map((nom, i) => ({ value: i + 1, label: nom })),
                ]} />
              </div>
              <div>
                <label>{t(idioma, 'f_desde')}</label>
                <DatePickerInput value={dataIniciPeriode} onChange={setDataIniciPeriode} placeholder="dd/mm/aaaa" />
              </div>
              <div>
                <label>{t(idioma, 'f_finsA')}</label>
                <DatePickerInput value={dataFiPeriode} onChange={setDataFiPeriode} placeholder="dd/mm/aaaa" />
              </div>
            </>}
          </div>

          {/* ── AVUI ───────────────────────────────────────────── */}
          {mode === 'avui' && produccio?.resumAvui && (
            <div id="bloc-periode-avui">
              <div className="kpi-row">

                <div className="kpi kpi-produccio">
                  <div className="valor">
                    {formatarNumero_(idioma, produccio.resumAvui.pecesBones || 0)}
                  </div>
                  <div className="etiqueta">{t(idioma, 'kpi_peces')}</div>
                </div>

                <div className="kpi kpi-merma">
                  <div className="valor">
                    {formatarNumero_(idioma, produccio.resumAvui.pecesMerma || 0)} ({Math.round(Number(produccio.resumAvui.percentMerma) || 0)}%)
                  </div>
                  <div className="etiqueta">{t(idioma, 'kpi_merma')}</div>
                </div>

                <div className="kpi kpi-actiu-wrap">
                  <div className="valor">
                    {formatarHoresMin_(produccio.resumAvui.tempsActiuMin || 0)} ({Math.round(Number(produccio.resumAvui.disponibilitat) || 0)}%)
                  </div>
                  <div className="etiqueta">{t(idioma, 'kpi_actiu')}</div>
                </div>

                <div className="kpi kpi-parat-wrap">
                  <div className="valor">
                    {formatarHoresMin_(produccio.resumAvui.tempsParatMin || 0)}
                  </div>
                  <div className="etiqueta">{t(idioma, 'kpi_parat')}</div>
                </div>

                <OeeKpi
                  idioma={idioma}
                  disponibilitat={produccio.resumAvui.disponibilitat}
                  qualitat={produccio.resumAvui.qualitat}
                  oee={produccio.resumAvui.oee}
                />

                <div className={'kpi kpi-ritme kpi-ritme-' + tendencia}>
                  <div className="valor">
                    {mitjanaPerHora} <span className="ritme-unitat">peces/h</span>
                  </div>
                  <div className="etiqueta">Ritme de producció</div>
                  <span className={'ritme-fletxa' + (tendencia === 'estable' ? ' ritme-fletxa-igual' : '')} aria-hidden="true">
                    {tendencia === 'pujant' ? '↑' : tendencia === 'baixant' ? '↓' : '='}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── PERIODE ────────────────────────────────────────── */}
          {mode === 'periode' && produccio?.resum && (
            <div id="bloc-periode-total">
              {filtreTorn.length > 0 && (
                <div className="kpi-row resum-torns">
                  {filtreTorn.map((torn) => {
                    const totals = (produccio.perDiaPerTorn || []).reduce((acc, dia) => {
                      const d = dia[torn] || {};
                      acc.bones += d.pecesBones || 0;
                      acc.merma += d.pecesMerma || 0;
                      return acc;
                    }, { bones: 0, merma: 0 });

                    return (
                      <div className="kpi resum-torn" key={torn}>
                        <div className="valor">{formatarNumero_(idioma, totals.bones)}</div>
                        <div className="etiqueta">
                          <i style={{ background: COLORS_TORN[torn] }}></i>
                          {DICC[idioma].torns[torn]}
                          {' · '}
                          {formatarNumero_(idioma, totals.merma)}
                          {' '}
                          {t(idioma, 'kpi_merma')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="kpi-row">
                <div className="kpi kpi-produccio">
                  <div className="valor">{formatarNumero_(idioma, produccio.resum.pecesBones)}</div>
                  <div className="etiqueta">{t(idioma, 'kpi_peces')}</div>
                </div>

                <div className="kpi kpi-merma">
                  <div className="valor">
                    {formatarNumero_(idioma, produccio.resum.pecesMerma)}
                    {' ('}{produccio.resum.percentMerma}{'%)'}
                  </div>
                  <div className="etiqueta">{t(idioma, 'kpi_merma')}</div>
                </div>

                <div className="kpi kpi-actiu-wrap">
                  <div className="valor">
                    {formatarHoresMin_(produccio.resum.tempsActiuMin)}
                    {' ('}{(produccio.resum.disponibilitat * 100).toFixed(0)}{'%)'}
                  </div>
                  <div className="etiqueta">{t(idioma, 'kpi_actiu')}{' (min)'}</div>
                </div>

                <div className="kpi kpi-parat-wrap">
                  <div className="valor">{formatarHoresMin_(produccio.resum.tempsParatMin)}</div>
                  <div className="etiqueta">{t(idioma, 'kpi_parat')}{' (min)'}</div>
                </div>

                <OeeKpi
                  idioma={idioma}
                  disponibilitat={produccio.resum.disponibilitat}
                  qualitat={produccio.resum.qualitat}
                  oee={produccio.resum.oee}
                />

                <div className={'kpi kpi-ritme kpi-ritme-' + tendencia}>
                  <div className="valor">
                    {mitjanaPerHora} <span className="ritme-unitat">peces/h</span>
                  </div>
                  <div className="etiqueta">Ritme de producció</div>
                  <span className={'ritme-fletxa' + (tendencia === 'estable' ? ' ritme-fletxa-igual' : '')} aria-hidden="true">
                    {tendencia === 'pujant' ? '↑' : tendencia === 'baixant' ? '↓' : '='}
                  </span>
                </div>
              </div>

              <div className="grafic-wrap">
                <GraficProduccio
                  ref={graficProduccioRef}
                  perDia={produccio.perDia}
                  perDiaPerTorn={produccio.perDiaPerTorn}
                  tornsActius={filtreTorn}
                  idioma={idioma}
                />
              </div>

              <div className="produccio-taula-head">
                <button type="button" className="secondary-btn" onClick={() => setMostrarTaulaProduccio((v) => !v)}>
                  {mostrarTaulaProduccio ? t(idioma, 'produccio_amagar_taula') : t(idioma, 'produccio_mostrar_taula')}
                </button>
              </div>

              {mostrarTaulaProduccio && (
                <>
                <div className="taula-scroll produccio-table-desktop">
                  <table>
                    <thead>
                      <tr>
                        <th>{t(idioma, 'taula_dia')}</th>
                        {mostrarReferencia && <th>{t(idioma, 'f_referencia')}</th>}
                        <th>{t(idioma, 'taula_pecesbones')}</th>
                        <th>{t(idioma, 'taula_merma')}</th>
                        <th>{t(idioma, 'taula_actiu')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mostrarReferencia && (produccio.perDiaPerReferencia || []).length ? (
                        produccio.perDiaPerReferencia.map((d, i) => {
                          const indexDia = produccio.perDia.findIndex((dd) => dd.data === d.data);
                          return (
                            <tr
                              key={i}
                              className={indexDia !== -1 ? 'fila-clicable' : ''}
                              onClick={indexDia !== -1 ? () => graficProduccioRef.current?.mostrarTooltip(indexDia) : undefined}
                            >
                              <td>{formatarData_(d.data)}</td>
                              <td>{d.referencia}</td>
                              <td>{d.pecesBones}</td>
                              <td>{d.pecesMerma}</td>
                              <td>{d.tempsActiuMin}</td>
                            </tr>
                          );
                        })
                      ) : (produccio.perDia || []).length ? (
                        produccio.perDia.map((d, i) => (
                          <tr key={i} className="fila-clicable" onClick={() => graficProduccioRef.current?.mostrarTooltip(i)}>
                            <td>{formatarData_(d.data)}</td>
                            {mostrarReferencia && <td>-</td>}
                            <td>{d.pecesBones}</td>
                            <td>{d.pecesMerma}</td>
                            <td>{d.tempsActiuMin}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={mostrarReferencia ? 5 : 4} className="empty-state">{t(idioma, 'buit_dades')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="dades-mobile-list produccio-mobile-list" aria-label="Dades de producció">
                  {(mostrarReferencia && (produccio.perDiaPerReferencia || []).length
                    ? produccio.perDiaPerReferencia
                    : (produccio.perDia || [])
                  ).slice(0, mesProduccioMobil ? undefined : 3).map((d, i) => {
                    const indexDia = (produccio.perDia || []).findIndex((dd) => dd.data === d.data);
                    return (
                      <article className="dada-mobile-card" key={`${d.data}-${d.referencia || i}`} onClick={indexDia !== -1 ? () => graficProduccioRef.current?.mostrarTooltip(indexDia) : undefined}>
                        <div className="dada-mobile-cap"><strong>{formatarData_(d.data)}</strong>{mostrarReferencia && <span>{d.referencia || '-'}</span>}</div>
                        <dl>
                          <div><dt>{t(idioma, 'taula_pecesbones')}</dt><dd>{d.pecesBones}</dd></div>
                          <div><dt>{t(idioma, 'taula_merma')}</dt><dd>{d.pecesMerma}</dd></div>
                          <div className="dada-mobile-ampla"><dt>{t(idioma, 'taula_actiu')}</dt><dd>{d.tempsActiuMin} min</dd></div>
                        </dl>
                      </article>
                    );
                  })}
                  {!(mostrarReferencia && (produccio.perDiaPerReferencia || []).length ? produccio.perDiaPerReferencia.length : (produccio.perDia || []).length) && (
                    <div className="empty-state">{t(idioma, 'buit_dades')}</div>
                  )}
                </div>
                {(mostrarReferencia && (produccio.perDiaPerReferencia || []).length ? produccio.perDiaPerReferencia.length : (produccio.perDia || []).length) > 3 && (
                  <button type="button" className="secondary-btn mobile-more-btn" onClick={() => setMesProduccioMobil((v) => !v)}>
                    {mesProduccioMobil ? 'Mostrar menys' : `Mostrar més (${(mostrarReferencia && (produccio.perDiaPerReferencia || []).length ? produccio.perDiaPerReferencia.length : (produccio.perDia || []).length) - 3})`}
                  </button>
                )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Cronologia ────────────────────────────────────────── */}
        <div className={'panell' + (carregantCronologia && cronologiaDies.length > 0 ? ' cronologia-carregant' : '')} id="panell-cronologia">
          <h3>{t(idioma, 'cronologia_titol')}</h3>
          {carregantCronologia && cronologiaDies.length === 0 ? (
            <div className="cronologia-skeleton">
              <div className="skeleton-card cronologia-skeleton-head"></div>
              <div className="skeleton-card cronologia-skeleton-bars"></div>
              <div className="skeleton-card cronologia-skeleton-kpis"></div>
              <div className="empty-state" style={{ marginTop: 10 }}>{t(idioma, 'cronologia_carregant')}</div>
            </div>
          ) : (
            <GraficCronologia
              ref={graficCronologiaRef}
              dies={cronologiaDies}
              tornsActius={filtreTorn}
              referencia={filtreReferencia || null}
              idioma={idioma}
              onJumpHistoric={(ts) => {
                scrollA('panell-historic');
                setTimeout(() => resaltarFila('#historic-taula', ts), 450);
              }}
              onJumpParades={(ts) => {
                scrollA('panell-parades');
                setTimeout(() => resaltarFila('#parades-taula', ts), 450);
              }}
            />
          )}
        </div>

        {/* ── Parades ────────────────────────────────────────────── */}
        <div className="panell" id="panell-parades">
          <div className="parades-panel-head">
            <div><span>{t(idioma, 'paradas_titol')}</span></div>
            <strong>{paradasFiltrades.length} {paradasFiltrades.length === 1 ? 'Registre' : 'Registres'}</strong>
          </div>
          <div className="taula-scroll">
            <table id="parades-taula" className="taula-vores-columnes">
              <thead>
                <tr>
                  <th>{t(idioma, 'taula_causa')}</th>
                  <th>{t(idioma, 'f_torn')}</th>
                  <th>{t(idioma, 'taula_inici')}</th>
                  <th>{t(idioma, 'taula_fi')}</th>
                  <th>{t(idioma, 'taula_durada').replace(/\s*\(min\)$/i, '')}</th>
                </tr>
              </thead>
              <tbody>
                {paradasFiltrades.length ? (
                  (totesParades ? paradasFiltrades : paradasFiltrades.slice(0, LIMIT_LLISTA)).map((pa, i) => (
                    <tr
                      key={i}
                      className={'fila-clicable' + (pa.activa ? ' fila-activa' : '')}
                      data-timestamp={pa.inici}
                      onClick={() => seleccionarFila_('#parades-taula', pa.inici)}
                    >
                      <td>{pa.causa}</td>
                      <td><TornCell torns={pa.torns && pa.torns.length ? pa.torns : [calcularTorn_(pa.inici)]} idioma={idioma} /></td>
                      <td>{formatarDataHora_(pa.inici)}</td>
                      <td>{pa.activa ? <span className="chip-en-curs">En curs</span> : formatarDataHora_(pa.fi)}</td>
                      <td>{pa.activa ? '—' : Number(pa.duradaMin) > 0 ? `${pa.duradaMin} min` : `${pa.duradaSeg || 0} s`}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="empty-state">{t(idioma, 'buit_paradas')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="parades-mobile-list" aria-label="Parades del període">
            {paradasFiltrades.length ? (
              (mesParadesMobil ? paradasFiltrades : paradasFiltrades.slice(0, 3)).map((pa, i) => (
                <article className={'parada-mobile-card' + (pa.activa ? ' activa' : '')} key={i} data-timestamp={pa.inici}>
                  <div className="parada-mobile-cap">
                    <strong>{pa.causa}</strong>
                    {pa.activa && <span className="chip-en-curs">En curs</span>}
                  </div>
                  <dl>
                    <div className="parada-mobile-torns"><dt>{t(idioma, 'f_torn')}</dt><dd><TornCell torns={pa.torns && pa.torns.length ? pa.torns : [calcularTorn_(pa.inici)]} idioma={idioma} /></dd></div>
                    <div><dt>{t(idioma, 'taula_inici')}</dt><dd>{formatarDataHora_(pa.inici)}</dd></div>
                    <div><dt>{t(idioma, 'taula_fi')}</dt><dd>{pa.activa ? '—' : formatarDataHora_(pa.fi)}</dd></div>
                    <div><dt>{t(idioma, 'taula_durada').replace(/\s*\(min\)$/i, '')}</dt><dd>{pa.activa ? '—' : Number(pa.duradaMin) > 0 ? `${pa.duradaMin} min` : `${pa.duradaSeg || 0} s`}</dd></div>
                  </dl>
                </article>
              ))
            ) : <div className="empty-state">{t(idioma, 'buit_paradas')}</div>}
          </div>
          {paradasFiltrades.length > 3 && (
            <button type="button" className="secondary-btn mobile-more-btn" onClick={() => setMesParadesMobil((v) => !v)}>
              {mesParadesMobil ? 'Mostrar menys' : `Mostrar més (${paradasFiltrades.length - 3})`}
            </button>
          )}
          {!totesParades && paradasFiltrades.length > LIMIT_LLISTA && (
            <button type="button" className="secondary-btn desktop-more-btn" onClick={() => setTotesParades(true)} style={{ marginTop: 10 }}>
              Veure més ({paradasFiltrades.length - LIMIT_LLISTA} més)
            </button>
          )}
        </div>

        <div className="panell" id="panell-historic">
          <div className="historic-panel-head">
            <span>{t(idioma, 'historic_titol')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {incidenciesActivesAmbDurada.length > 0 && (
                <span className="chip-en-curs">{incidenciesActivesAmbDurada.length} {t(idioma, 'incidencies_actives_titol').toLowerCase()}</span>
              )}
              <strong>{incidenciesTaula.length} {incidenciesTaula.length === 1 ? 'Incidència' : 'Incidències'}</strong>
            </span>
          </div>

          {MOSTRAR_FILTRES_ESPECIFICS && <div className="filtres-historic">
            <div>
              <label>{t(idioma, 'f_any')}</label>
              <AppSelect ariaLabel={t(idioma, 'f_any')} value={filtreAnyHist} onChange={setFiltreAnyHist} options={[
                { value: '', label: t(idioma, 'f_tots') },
                ...(fitxa?.anysDisponiblesHistoric || []).map((a) => ({ value: a, label: a })),
              ]} />
            </div>
            <div>
              <label>{t(idioma, 'f_mes')}</label>
              <AppSelect ariaLabel={t(idioma, 'f_mes')} value={filtreMesHist} onChange={setFiltreMesHist} options={[
                { value: '', label: t(idioma, 'f_tots') },
                ...t(idioma, 'mesos').map((nom, i) => ({ value: i + 1, label: nom })),
              ]} />
            </div>
            {horariUnic ? <div>
              <label>{t(idioma, 'f_torn')}</label>
              <div className="torns-chips"><span className="torn-chip torn-chip-unic actiu">{t(idioma, 'torn_unic')}</span></div>
            </div> : <div>
              <label>{t(idioma, 'f_torn')}</label>
              <TornChips torns={tornsClient} actius={filtreTornHist} onToggle={alternarTornHist} idioma={idioma} />
            </div>}
            <div>
              <label>{t(idioma, 'f_desde')}</label>
              <DatePickerInput value={dataDesdeHist} onChange={setDataDesdeHist} placeholder="dd/mm/aaaa" />
            </div>
            <div>
              <label>{t(idioma, 'f_finsA')}</label>
              <DatePickerInput value={dataFinsHist} onChange={setDataFinsHist} placeholder="dd/mm/aaaa" />
            </div>
          </div>}

          <div className="kpi-row">
            {(fitxa?.alarmesMesFrequents || []).length ? (
              fitxa.alarmesMesFrequents.map((a, i) => (
                <div className="kpi" key={i}>
                  <div className="valor" style={{ fontSize: 13 }}>{a.codi} — {a.missatge}</div>
                  <div className="etiqueta">{t(idioma, 'alarma_frequent')} ({a.total})</div>
                </div>
              ))
            ) : (
              <div className="kpi">
                <div className="valor">-</div>
                <div className="etiqueta">{t(idioma, 'alarma_frequent')}</div>
              </div>
            )}
          </div>

          <div className="grafic-wrap">
            <GraficHistoric
              ref={graficHistoricRef}
              historic={incidenciesHistoricAmbDurada}
              idioma={idioma}
              onDiesCalculats={setDiesHistoric}
              onSeleccionarAlarma={seleccionarAlarma_}
            />
          </div>

          <div className="taula-scroll historic-table-desktop">
            <table id="historic-taula" className="taula-vores-columnes">
              <thead>
                <tr>
                  <th>{t(idioma, 'taula_codi')}</th>
                  <th>{t(idioma, 'taula_missatge')}</th>
                  <th>{t(idioma, 'f_torn')}</th>
                  <th>{t(idioma, 'taula_inici')}</th>
                  <th>{t(idioma, 'taula_fi')}</th>
                  <th>{t(idioma, 'taula_durada').replace(/\s*\(min\)$/i, '')}</th>
                </tr>
              </thead>
              <tbody>
                {incidenciesTaula.length ? (
                  (totHistoric ? incidenciesTaula : incidenciesTaula.slice(0, LIMIT_LLISTA)).map((i, idx) => (
                    <tr
                      key={idx}
                      className={'fila-clicable' + (i.activa ? ' fila-activa' : '')}
                      data-timestamp={i.timestampInici}
                      onClick={() => {
                        const dia = i.timestampInici.slice(0, 10);
                        const index = diesHistoric.findIndex((d) => d.data.slice(0, 10) === dia);
                        if (index !== -1) graficHistoricRef.current?.mostrarTooltip(index);
                        seleccionarFila_('#historic-taula', i.timestampInici);
                      }}
                    >
                      <td><span className="historic-code-chip">{i.codi}</span></td>
                      <td>{i.missatge}</td>
                      <td><TornCell torns={i.torns && i.torns.length ? i.torns : [i.torn]} idioma={idioma} /></td>
                      <td>{formatarDataHora_(i.timestampInici)}</td>
                      <td>{i.activa ? <span className="chip-en-curs">En curs</span> : formatarDataHora_(i.timestampFi)}</td>
                      <td>{i.activa ? '—' : i.duradaMin != null ? Number(i.duradaMin) > 0 ? `${i.duradaMin} min` : `${i.duradaSeg || 0} s` : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="empty-state">{t(idioma, 'buit_incidencies')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="dades-mobile-list historic-mobile-list" aria-label="Històric d'incidències">
            {incidenciesTaula.length ? (
              (mesHistoricMobil ? incidenciesTaula : incidenciesTaula.slice(0, 3)).map((i, idx) => (
                <article className={'dada-mobile-card' + (i.activa ? ' activa' : '')} key={`${i.timestampInici}-${idx}`}>
                  <div className="dada-mobile-cap"><span className="historic-code-chip">{i.codi}</span><strong>{i.missatge}</strong></div>
                  <dl>
                    <div className="dada-mobile-ampla"><dt>{t(idioma, 'f_torn')}</dt><dd><TornCell torns={i.torns && i.torns.length ? i.torns : [i.torn]} idioma={idioma} /></dd></div>
                    <div><dt>{t(idioma, 'taula_inici')}</dt><dd>{formatarDataHora_(i.timestampInici)}</dd></div>
                    <div><dt>{t(idioma, 'taula_fi')}</dt><dd>{i.activa ? 'En curs' : formatarDataHora_(i.timestampFi)}</dd></div>
                    <div className="dada-mobile-ampla"><dt>{t(idioma, 'taula_durada').replace(/\s*\(min\)$/i, '')}</dt><dd>{i.activa ? '—' : i.duradaMin != null ? Number(i.duradaMin) > 0 ? `${i.duradaMin} min` : `${i.duradaSeg || 0} s` : '—'}</dd></div>
                  </dl>
                </article>
              ))
            ) : <div className="empty-state">{t(idioma, 'buit_incidencies')}</div>}
          </div>
          {incidenciesTaula.length > 3 && (
            <button type="button" className="secondary-btn mobile-more-btn" onClick={() => setMesHistoricMobil((v) => !v)}>
              {mesHistoricMobil ? 'Mostrar menys' : `Mostrar més (${incidenciesTaula.length - 3})`}
            </button>
          )}
          {!totHistoric && incidenciesTaula.length > LIMIT_LLISTA && (
            <button type="button" className="secondary-btn desktop-more-btn" onClick={() => setTotHistoric(true)} style={{ marginTop: 10 }}>
              Veure més ({incidenciesTaula.length - LIMIT_LLISTA} més)
            </button>
          )}
        </div>

        {/* ── Consums ───────────────────────────────────────────── */}
        <div className="panell" id="panell-consums">
          <h3>{t(idioma, 'consums_titol')}</h3>

          <div className="projecte-pills" id="tipus-consum">
            {['aire', 'electric'].map((tipus) => (
              <button
                key={tipus} type="button"
                className={'control-pill consum-type-pill consum-type-' + tipus + (tipusConsumActius.includes(tipus) ? ' actiu' : '')}
                onClick={() => alternarTipusConsum(tipus)}
              >
                {tipus === 'electric' ? <IconaConsum /> : <IconaCabal />}
                {t(idioma, tipus === 'electric' ? 'consum_electric' : 'consum_aire')}
              </button>
            ))}
          </div>

          {MOSTRAR_FILTRES_ESPECIFICS && <div className="filtres-historic">
            <div>
              <label>{t(idioma, 'f_desde')}</label>
              <DatePickerInput value={dataDesdeConsum} onChange={setDataDesdeConsum} placeholder="dd/mm/aaaa" />
            </div>
            <div>
              <label>{t(idioma, 'f_finsA')}</label>
              <DatePickerInput value={dataFinsConsum} onChange={setDataFinsConsum} placeholder="dd/mm/aaaa" />
            </div>
          </div>}

          <KpisConsums consums={consums} preus={preus} idioma={idioma} />

          <div className="grafic-wrap">
            <GraficConsums consums={consums} idioma={idioma} />
          </div>
        </div>

      </div>

      </div>
    </div>
  );
}

export default function FitxaPage() {
  return (
    <Suspense fallback={null}>
      <FitxaContent />
    </Suspense>
  );
}
