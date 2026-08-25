'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useFitxa } from '../../lib/useFitxa';
import { t, DICC } from '../../lib/i18n';
import { formatarData_, formatarDataHora_, formatarDurada_, formatarHoresMin_, formatarNumero_ } from '../../lib/format';
import { IconaWifiOff } from '../../lib/icons';
import TornChips from '../../components/TornChips';
import OeeKpi from '../../components/OeeKpi';
import DatePickerInput from '../../components/DatePickerInput';
import GraficProduccio from '../../components/GraficProduccio';
import GraficHistoric from '../../components/GraficHistoric';
import GraficCronologia from '../../components/GraficCronologia';
import GraficConsums, { KpisConsums } from '../../components/GraficConsums';

const COLORS_TORN = { Matí: '#f6c453', Tarda: '#4da3ff', Nit: '#b582f8' };

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

function FitxaContent() {
  const router = useRouter();
  const machineId = useSearchParams().get('id');
  const { sessio, errorSessio } = useAuth();
  const idioma = sessio?.idioma || 'ca';

  const {
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
  } = useFitxa(machineId);

  const [mostrarTaulaProduccio, setMostrarTaulaProduccio] = useState(false);
  const [diesHistoric, setDiesHistoric] = useState([]);

  const graficProduccioRef = useRef(null);
  const graficHistoricRef = useRef(null);
  const graficCronologiaRef = useRef(null);

  function alternarTorn(torn) {
    setFiltreTorn((prev) => (prev.indexOf(torn) !== -1 ? prev.filter((v) => v !== torn) : [...prev, torn]));
  }
  function alternarTornHist(torn) {
    setFiltreTornHist((prev) => (prev.indexOf(torn) !== -1 ? prev.filter((v) => v !== torn) : [...prev, torn]));
  }

  if (!machineId) {
    return <div className="empty-state">Cap màquina seleccionada.</div>;
  }

  const estat = fitxa?.estatActual;
  const clicableEstat = estat === 'alarma' || estat === 'parada';

  return (
    <div id="fitxa-view">
      <span className="back-link" onClick={() => router.push('/')}>&larr; {t(idioma, 'totesMaquines')}</span>

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
                onClick={clicableEstat ? () => scrollA(estat === 'alarma' ? 'panell-actives' : 'panell-parades') : undefined}
              >
                {estat === 'incomunicada' && <IconaWifiOff />}
                {t(idioma, 'estat_' + estat)}
              </span>
            )}
          </div>
        </div>

        <nav className="fitxa-subnav">
          <a onClick={(e) => { e.preventDefault(); scrollA('panell-produccio'); }}>{t(idioma, 'produccio_titol')}</a>
          <a onClick={(e) => { e.preventDefault(); scrollA('panell-parades'); }}>{t(idioma, 'paradas_titol')}</a>
          <a onClick={(e) => { e.preventDefault(); scrollA('panell-actives'); }}>{t(idioma, 'incidencies_actives_titol')}</a>
          <a onClick={(e) => { e.preventDefault(); scrollA('panell-historic'); }}>{t(idioma, 'historic_titol')}</a>
          <a onClick={(e) => { e.preventDefault(); scrollA('panell-cronologia'); }}>{t(idioma, 'cronologia_titol')}</a>
          <a onClick={(e) => { e.preventDefault(); scrollA('panell-consums'); }}>{t(idioma, 'consums_titol')}</a>
        </nav>
      </div>

      <div className="fitxa-scroll" id="fitxa-scroll">
        {/* ── Producció ──────────────────────────────────────────── */}
        <div className="panell" id="panell-produccio">
          <h3>{t(idioma, 'produccio_titol')}</h3>
          <div className="subtabs">
            <button type="button" className={'nav-tab' + (mode === 'avui' ? ' actiu' : '')} onClick={() => setMode('avui')}>{t(idioma, 'mode_avui')}</button>
            <button type="button" className={'nav-tab' + (mode === 'periode' ? ' actiu' : '')} onClick={() => setMode('periode')}>{t(idioma, 'mode_periode')}</button>
          </div>
          <div className="filtres-historic filtres-produccio-compactes">
            <div>
              <label>{t(idioma, 'f_torn')}</label>
              <TornChips torns={tornsClient} actius={filtreTorn} onToggle={alternarTorn} idioma={idioma} />
            </div>
            {mostrarReferencia && (
              <div>
                <label>{t(idioma, 'f_referencia')}</label>
                <select value={filtreReferencia} onChange={(e) => setFiltreReferencia(e.target.value)}>
                  <option value="">{t(idioma, 'f_totes')}</option>
                  {(produccio?.referenciesDisponibles || []).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
          </div>

          {mode === 'avui' && produccio?.resumAvui && (
            <div id="bloc-periode-avui">
              <div className="kpi-row">
                <div className="kpi kpi-produccio"><div className="valor">{formatarNumero_(idioma, produccio.resumAvui.pecesBones)}</div><div className="etiqueta">{t(idioma, 'kpi_peces')}</div></div>
                <div className="kpi kpi-merma"><div className="valor">{formatarNumero_(idioma, produccio.resumAvui.pecesMerma)} ({produccio.resumAvui.percentMerma}%)</div><div className="etiqueta">{t(idioma, 'kpi_merma')}</div></div>
                <div className="kpi kpi-actiu-wrap"><div className="valor">{formatarHoresMin_(produccio.resumAvui.tempsActiuMin)} ({(produccio.resumAvui.disponibilitat * 100).toFixed(0)}%)</div><div className="etiqueta">{t(idioma, 'kpi_actiu')}</div></div>
                <div className="kpi kpi-parat-wrap"><div className="valor">{formatarHoresMin_(produccio.resumAvui.tempsParatMin)}</div><div className="etiqueta">{t(idioma, 'kpi_parat')}</div></div>
                <OeeKpi idioma={idioma} disponibilitat={produccio.resumAvui.disponibilitat} qualitat={produccio.resumAvui.qualitat} oee={produccio.resumAvui.oee} />
              </div>
            </div>
          )}

          {mode === 'periode' && produccio?.resum && (
            <div id="bloc-periode-total">
              <div className="filtres-historic">
                <div>
                  <label>{t(idioma, 'f_any')}</label>
                  <select value={filtreAny} onChange={(e) => setFiltreAny(e.target.value)}>
                    <option value="">{t(idioma, 'f_tots')}</option>
                    {(produccio.anysDisponibles || []).map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label>{t(idioma, 'f_mes')}</label>
                  <select value={filtreMes} onChange={(e) => setFiltreMes(e.target.value)}>
                    <option value="">{t(idioma, 'f_tots')}</option>
                    {t(idioma, 'mesos').map((nom, i) => <option key={i} value={i + 1}>{nom}</option>)}
                  </select>
                </div>
                <div>
                  <label>{t(idioma, 'f_desde')}</label>
                  <DatePickerInput value={dataIniciPeriode} onChange={setDataIniciPeriode} placeholder="dd/mm/aaaa" />
                </div>
                <div>
                  <label>{t(idioma, 'f_finsA')}</label>
                  <DatePickerInput value={dataFiPeriode} onChange={setDataFiPeriode} placeholder="dd/mm/aaaa" />
                </div>
              </div>

              {filtreTorn.length > 0 && (
                <div className="kpi-row resum-torns">
                  {filtreTorn.map((torn) => {
                    const totals = (produccio.perDiaPerTorn || []).reduce((acc, dia) => {
                      const d = dia[torn] || {};
                      acc.bones += d.pecesBones || 0; acc.merma += d.pecesMerma || 0;
                      return acc;
                    }, { bones: 0, merma: 0 });
                    return (
                      <div className="kpi resum-torn" key={torn}>
                        <div className="valor">{formatarNumero_(idioma, totals.bones)}</div>
                        <div className="etiqueta"><i style={{ background: COLORS_TORN[torn] }}></i>{DICC[idioma].torns[torn]} · {formatarNumero_(idioma, totals.merma)} {t(idioma, 'kpi_merma')}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="kpi-row">
                <div className="kpi kpi-produccio"><div className="valor">{formatarNumero_(idioma, produccio.resum.pecesBones)}</div><div className="etiqueta">{t(idioma, 'kpi_peces')}</div></div>
                <div className="kpi kpi-merma"><div className="valor">{formatarNumero_(idioma, produccio.resum.pecesMerma)} ({produccio.resum.percentMerma}%)</div><div className="etiqueta">{t(idioma, 'kpi_merma')}</div></div>
                <div className="kpi kpi-actiu-wrap"><div className="valor">{formatarHoresMin_(produccio.resum.tempsActiuMin)} ({(produccio.resum.disponibilitat * 100).toFixed(0)}%)</div><div className="etiqueta">{t(idioma, 'kpi_actiu')} (min)</div></div>
                <div className="kpi kpi-parat-wrap"><div className="valor">{formatarHoresMin_(produccio.resum.tempsParatMin)}</div><div className="etiqueta">{t(idioma, 'kpi_parat')} (min)</div></div>
                <OeeKpi idioma={idioma} disponibilitat={produccio.resum.disponibilitat} qualitat={produccio.resum.qualitat} oee={produccio.resum.oee} />
              </div>

              <div className="grafic-wrap">
                <GraficProduccio ref={graficProduccioRef} perDia={produccio.perDia} perDiaPerTorn={produccio.perDiaPerTorn} tornsActius={filtreTorn} idioma={idioma} />
              </div>

              <div className="produccio-taula-head">
                <button type="button" className="secondary-btn" onClick={() => setMostrarTaulaProduccio((v) => !v)}>
                  {mostrarTaulaProduccio ? t(idioma, 'produccio_amagar_taula') : t(idioma, 'produccio_mostrar_taula')}
                </button>
              </div>
              {mostrarTaulaProduccio && (
                <div className="taula-scroll">
                  <table>
                    <thead><tr>
                      <th>{t(idioma, 'taula_dia')}</th>
                      {mostrarReferencia && <th>{t(idioma, 'f_referencia')}</th>}
                      <th>{t(idioma, 'taula_pecesbones')}</th><th>{t(idioma, 'taula_merma')}</th><th>{t(idioma, 'taula_actiu')}</th>
                    </tr></thead>
                    <tbody>
                      {mostrarReferencia && (produccio.perDiaPerReferencia || []).length ? (
                        produccio.perDiaPerReferencia.map((d, i) => {
                          const indexDia = produccio.perDia.findIndex((dd) => dd.data === d.data);
                          return (
                            <tr key={i} className={indexDia !== -1 ? 'fila-clicable' : ''} onClick={indexDia !== -1 ? () => graficProduccioRef.current?.mostrarTooltip(indexDia) : undefined}>
                              <td>{formatarData_(d.data)}</td><td>{d.referencia}</td><td>{d.pecesBones}</td><td>{d.pecesMerma}</td><td>{d.tempsActiuMin}</td>
                            </tr>
                          );
                        })
                      ) : (produccio.perDia || []).length ? produccio.perDia.map((d, i) => (
                        <tr key={i} className="fila-clicable" onClick={() => graficProduccioRef.current?.mostrarTooltip(i)}>
                          <td>{formatarData_(d.data)}</td>
                          {mostrarReferencia && <td>-</td>}
                          <td>{d.pecesBones}</td><td>{d.pecesMerma}</td><td>{d.tempsActiuMin}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={mostrarReferencia ? 5 : 4} className="empty-state">{t(idioma, 'buit_dades')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Parades ────────────────────────────────────────────── */}
        <div className="panell" id="panell-parades">
          <h3>{t(idioma, 'paradas_titol')}</h3>
          <div className="taula-scroll">
            <table id="parades-taula">
              <thead><tr><th>{t(idioma, 'taula_inici')}</th><th>{t(idioma, 'taula_fi')}</th><th>{t(idioma, 'taula_durada')}</th><th>{t(idioma, 'taula_causa')}</th></tr></thead>
              <tbody>
                {(produccio?.paradas || []).length ? produccio.paradas.map((pa, i) => (
                  <tr key={i} className={pa.activa ? 'fila-activa' : ''} data-timestamp={pa.inici}>
                    <td>{formatarDataHora_(pa.inici)}</td>
                    <td>{pa.activa ? <span className="chip-en-curs">En curs</span> : formatarDataHora_(pa.fi)}</td>
                    <td>{pa.activa ? '—' : formatarDurada_(pa.duradaMin, pa.duradaSeg)}</td>
                    <td>{pa.causa}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="empty-state">{t(idioma, 'buit_paradas')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Incidències actives ───────────────────────────────── */}
        <div className="panell" id="panell-actives">
          <h3>{t(idioma, 'incidencies_actives_titol')}</h3>
          <div>
            {(fitxa?.incidenciesActives || []).length ? fitxa.incidenciesActives.map((i, idx) => (
              <div key={idx} style={{ marginBottom: 8 }}>
                <span className="incidencia-activa">{i.codi}</span> — {i.missatge}
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t(idioma, 'desde_h')} {formatarDataHora_(i.timestampInici)}</div>
              </div>
            )) : <div className="empty-state">{t(idioma, 'incidencies_cap')}</div>}
          </div>
        </div>

        {/* ── Històric ───────────────────────────────────────────── */}
        <div className="panell" id="panell-historic">
          <h3>{t(idioma, 'historic_titol')}</h3>
          <div className="filtres-historic">
            <div>
              <label>{t(idioma, 'f_any')}</label>
              <select value={filtreAnyHist} onChange={(e) => setFiltreAnyHist(e.target.value)}>
                <option value="">{t(idioma, 'f_tots')}</option>
                {(fitxa?.anysDisponiblesHistoric || []).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label>{t(idioma, 'f_mes')}</label>
              <select value={filtreMesHist} onChange={(e) => setFiltreMesHist(e.target.value)}>
                <option value="">{t(idioma, 'f_tots')}</option>
                {t(idioma, 'mesos').map((nom, i) => <option key={i} value={i + 1}>{nom}</option>)}
              </select>
            </div>
            <div>
              <label>{t(idioma, 'f_torn')}</label>
              <TornChips torns={tornsClient} actius={filtreTornHist} onToggle={alternarTornHist} idioma={idioma} />
            </div>
            <div>
              <label>{t(idioma, 'f_desde')}</label>
              <DatePickerInput value={dataDesdeHist} onChange={setDataDesdeHist} placeholder="dd/mm/aaaa" />
            </div>
            <div>
              <label>{t(idioma, 'f_finsA')}</label>
              <DatePickerInput value={dataFinsHist} onChange={setDataFinsHist} placeholder="dd/mm/aaaa" />
            </div>
          </div>

          <div className="kpi-row">
            {(fitxa?.alarmesMesFrequents || []).length ? fitxa.alarmesMesFrequents.map((a, i) => (
              <div className="kpi" key={i}><div className="valor">{a.codi} ({a.total})</div><div className="etiqueta">{t(idioma, 'alarma_frequent')}</div></div>
            )) : <div className="kpi"><div className="valor">-</div><div className="etiqueta">{t(idioma, 'alarma_frequent')}</div></div>}
          </div>

          <div className="grafic-wrap">
            <GraficHistoric ref={graficHistoricRef} historic={fitxa?.incidenciesHistoric || []} idioma={idioma} onDiesCalculats={setDiesHistoric} />
          </div>

          <div className="taula-scroll">
            <table id="historic-taula">
              <thead><tr>
                <th>{t(idioma, 'taula_codi')}</th><th>{t(idioma, 'taula_missatge')}</th><th>{t(idioma, 'f_torn')}</th><th>{t(idioma, 'taula_inici')}</th><th>{t(idioma, 'taula_fi')}</th>
              </tr></thead>
              <tbody>
                {(fitxa?.incidenciesHistoric || []).length ? fitxa.incidenciesHistoric.map((i, idx) => (
                  <tr
                    key={idx}
                    className="fila-clicable"
                    data-timestamp={i.timestampInici}
                    onClick={() => {
                      const dia = i.timestampInici.slice(0, 10);
                      const index = diesHistoric.findIndex((d) => d.data.slice(0, 10) === dia);
                      graficHistoricRef.current?.mostrarTooltip(index);
                    }}
                  >
                    <td>{i.codi}</td>
                    <td>{i.missatge}</td>
                    <td>{(i.torns && i.torns.length ? i.torns : [i.torn]).map((tn) => (
                      <span key={tn}><span className="torn-dot" style={{ background: COLORS_TORN[tn] || '#8a95a5' }}></span>{DICC[idioma].torns[tn] || tn}</span>
                    ))}</td>
                    <td>{formatarDataHora_(i.timestampInici)}</td>
                    <td>{formatarDataHora_(i.timestampFi)}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="empty-state">{t(idioma, 'buit_incidencies')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Cronologia ─────────────────────────────────────────── */}
        <div className="panell" id="panell-cronologia">
          <h3>{t(idioma, 'cronologia_titol')}</h3>
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
        </div>

        {/* ── Consums ────────────────────────────────────────────── */}
        <div className="panell" id="panell-consums">
          <h3>{t(idioma, 'consums_titol')}</h3>
          <div className="projecte-pills" id="tipus-consum">
            {['aire', 'electric'].map(tipus => (
              <button
                key={tipus}
                type="button"
                className={'control-pill' + (tipusConsumActius.includes(tipus) ? ' actiu' : '')}
                onClick={() => alternarTipusConsum(tipus)}
              >
                {t(idioma, tipus === 'electric' ? 'consum_electric' : 'consum_aire')}
              </button>
            ))}
          </div>
          <div className="filtres-historic">
            <div>
              <label>{t(idioma, 'f_desde')}</label>
              <DatePickerInput value={dataDesdeConsum} onChange={setDataDesdeConsum} placeholder="dd/mm/aaaa" />
            </div>
            <div>
              <label>{t(idioma, 'f_finsA')}</label>
              <DatePickerInput value={dataFinsConsum} onChange={setDataFinsConsum} placeholder="dd/mm/aaaa" />
            </div>
          </div>
          <KpisConsums consums={consums} preus={preus} idioma={idioma} />
          <div className="grafic-wrap">
            <GraficConsums consums={consums} idioma={idioma} />
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
