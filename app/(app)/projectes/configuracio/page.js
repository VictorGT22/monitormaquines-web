'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useProjectesErp } from '../../../lib/useProjectesErp';
import DatePickerInput from '../../../components/DatePickerInput';
import TimePickerInput from '../../../components/TimePickerInput';

const TOTS_TORNS = ['Matí', 'Tarda', 'Nit'];
const DIES_SETMANA = [
  { id: 1, curt: 'DL', nom: 'Dilluns' }, { id: 2, curt: 'DT', nom: 'Dimarts' },
  { id: 3, curt: 'DC', nom: 'Dimecres' }, { id: 4, curt: 'DJ', nom: 'Dijous' },
  { id: 5, curt: 'DV', nom: 'Divendres' }, { id: 6, curt: 'DS', nom: 'Dissabte' },
  { id: 7, curt: 'DG', nom: 'Diumenge' },
];
const ICONES_APARTAT = {
  'Referència màquina client': '⌁',
  'Data d’implementació a la fàbrica': '◷',
  'Torns': '↻',
  'Sistema de referències': '◇',
  'Control de cabal pneumàtic': '◌',
  'Control de consum elèctric': 'ϟ',
  'Manteniment': '⌘',
};

function Toggle({ actiu, onChange, label }) {
  return <button type="button" className={'config-toggle' + (actiu ? ' actiu' : '')} role="switch" aria-checked={actiu} aria-label={label} onClick={() => onChange(!actiu)}><span /></button>;
}

function Apartat({ titol, descripcio, actiu, onToggle, children, senseToggle = false }) {
  return <section className={'config-apartat' + (!senseToggle && !actiu ? ' desactivat' : '')}>
    <div className="config-apartat-cap"><div className="config-apartat-titol"><span className="config-apartat-icona" aria-hidden="true">{ICONES_APARTAT[titol] || '•'}</span><div><h2>{titol}</h2><p>{descripcio}</p></div></div>{!senseToggle && <Toggle actiu={actiu} onChange={onToggle} label={titol} />}</div>
    {(senseToggle || actiu) && children ? <div className="config-apartat-contingut">{children}</div> : null}
  </section>;
}

export default function ConfiguracioProjectePage() {
  const router = useRouter();
  const [projecteId, setProjecteId] = useState('');
  const { token, errorSessio } = useAuth();
  // El llistat ja viu al Provider del layout (useProjectesErp) i es carrega
  // un sol cop per sessió — aquí NOMÉS es busca el projecte dins d'aquest
  // mateix llistat compartit, no es torna a descarregar tot el ERP per
  // trobar-ne un.
  const { projectes, carregantProjectes: carregant, actualitzarProjecte } = useProjectesErp();
  const [estatGuardat, setEstatGuardat] = useState('');
  const [errorFranja, setErrorFranja] = useState(null);
  const projecte = projectes.find(p => p.id === projecteId) || null;

  useEffect(() => {
    // La ruta és estàtica (output: export); l'identificador viatja a la query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjecteId(new URLSearchParams(window.location.search).get('id') || '');
  }, []);

  function setProjecte(actualitzaCamps) {
    const nou = actualitzaCamps(projecte);
    actualitzarProjecte(projecteId, nou);
  }

  async function guardar(camps) {
    const anterior = { ...projecte };
    actualitzarProjecte(projecteId, camps); setEstatGuardat('Guardant…');
    try {
      await api.actualitzarConfiguracioProjecte(token, projecteId, camps);
      setEstatGuardat('Guardat'); window.setTimeout(() => setEstatGuardat(''), 1800);
    } catch (err) {
      actualitzarProjecte(projecteId, anterior);
      if (Object.prototype.hasOwnProperty.call(camps, 'frangesTurnUnic') && err?.status === 400) {
        setEstatGuardat('');
        setErrorFranja({ index: 0, camp: 'inici', missatge: err.message || 'Hora no vàlida.' });
        return;
      }
      setEstatGuardat('No s’ha pogut guardar');
      errorSessio(err);
    }
  }

  async function guardarData(novaData) {
    const anterior = projecte.dataImplementacio;
    actualitzarProjecte(projecteId, { dataImplementacio: novaData }); setEstatGuardat('Guardant…');
    try { await api.actualitzarDataImplementacio(token, projecteId, novaData || null); setEstatGuardat('Guardat'); }
    catch (err) { actualitzarProjecte(projecteId, { dataImplementacio: anterior }); errorSessio(err); }
  }

  async function canviarTorn(torn) {
    const actius = projecte.torns || TOTS_TORNS;
    const nous = actius.includes(torn) ? actius.filter(t => t !== torn) : [...actius, torn];
    if (!nous.length) return;
    const anterior = actius;
    setProjecte(p => ({ ...p, torns: nous })); setEstatGuardat('Guardant…');
    try { await api.canviarTornsProjecte(token, projecteId, nous); setEstatGuardat('Guardat'); }
    catch (err) { setProjecte(p => ({ ...p, torns: anterior })); errorSessio(err); }
  }

  function canviarDia(dia) {
    const actuals = projecte.diesLaborables?.length ? projecte.diesLaborables : [1, 2, 3, 4, 5];
    const nous = actuals.includes(dia) ? actuals.filter(d => d !== dia) : [...actuals, dia].sort((a, b) => a - b);
    if (!nous.length) return;
    guardar({ diesLaborables: nous });
  }

  function canviarFranja(index, camp, valor) {
    const noves = projecte.frangesTurnUnic.map((f, i) => i === index ? { ...f, [camp]: valor } : f);
    const franjaInvalida = noves.some(f => f.inici >= f.fi);
    const ordreInvalid = noves.length === 2 && noves[0].fi > noves[1].inici;
    if (franjaInvalida || ordreInvalid) {
      setErrorFranja({
        index, camp,
        missatge: franjaInvalida
          ? 'L’inici ha de ser anterior al fi.'
          : 'Ha de ser posterior al final de la franja 1.'
      });
      return;
    }
    setErrorFranja(null);
    setProjecte(p => ({ ...p, frangesTurnUnic: noves }));
    guardar({ frangesTurnUnic: noves });
  }

  if (carregant) return <div className="config-projecte"><div className="skeleton-card" style={{ height: 520 }} /></div>;
  if (!projecte || !projecte.nexaControlActiu) return <div className="empty-state">Projecte no trobat o encara no activat.<br /><button className="btn btn-neutral" onClick={() => router.push('/projectes')}>Tornar als projectes</button></div>;

  const franges = projecte.frangesTurnUnic?.length ? projecte.frangesTurnUnic : [{ inici: '08:00', fi: '13:00' }];
  return <div className="config-projecte">
    <div className="config-projecte-nav"><button type="button" className="back-link config-back" onClick={() => router.push('/projectes')}>← Projectes ERP</button><span className="config-estat-guardat" aria-live="polite">{estatGuardat}</span></div>
    <header className="config-projecte-header"><div><span className="config-kicker">Màquina {projecte.id}</span><h1>Configuració del projecte</h1></div><div className="config-client"><span>Client</span><strong>{projecte.client}</strong></div></header>
    <div className="config-identificacio">
      <label htmlFor="descripcio-monitor">Descripció al Monitor de Màquines</label>
      <input id="descripcio-monitor" type="text" maxLength={160} value={projecte.descripcio || ''} onChange={e => setProjecte(p => ({ ...p, descripcio: e.target.value }))} onBlur={e => guardar({ descripcioMonitor: e.target.value })} />
      <small>Aquesta descripció és pròpia del monitor i no modifica la descripció de l’ERP.</small>
    </div>
    <div className="config-apartats">
      <Apartat titol="Referència màquina client" actiu={projecte.referenciaMaquinaClientActiva} onToggle={valor => guardar({ referenciaMaquinaClientActiva: valor })} descripcio="Referència descriptiva pròpia del client per identificar la màquina.">
        <input type="text" maxLength={120} placeholder="Ex. Línia d’envasat 2" value={projecte.referenciaMaquinaClient || ''} onChange={e => setProjecte(p => ({ ...p, referenciaMaquinaClient: e.target.value }))} onBlur={e => guardar({ referenciaMaquinaClient: e.target.value })} />
      </Apartat>
      <Apartat titol="Data d’implementació a la fàbrica" senseToggle descripcio="Data prevista o real de posada en marxa a les instal·lacions del client."><div className="config-data"><DatePickerInput value={projecte.dataImplementacio ? projecte.dataImplementacio.substring(0, 10) : ''} placeholder="dd/mm/aaaa" onChange={guardarData} /></div></Apartat>
      <Apartat titol="Torns" actiu={projecte.tornsActius !== false} onToggle={valor => guardar({ tornsActius: valor })} descripcio="Defineix les franges de treball que corresponen a aquesta màquina.">
        <div className="config-mode-selector"><button type="button" className={projecte.modeTorns === 'unic' ? 'actiu' : ''} onClick={() => guardar({ modeTorns: 'unic' })}>Torn únic</button><button type="button" className={projecte.modeTorns !== 'unic' ? 'actiu' : ''} onClick={() => guardar({ modeTorns: 'sistema' })}>Sistema de torns</button></div>
        {projecte.modeTorns === 'unic' ? <div className="config-franges">
          {franges.map((franja, index) => <div className="config-franja" key={index}><span>Franja {index + 1}</span><TimePickerInput value={franja.inici} ariaLabel={`Inici franja ${index + 1}`} error={errorFranja?.index === index && errorFranja?.camp === 'inici' ? errorFranja.missatge : ''} onChange={valor => canviarFranja(index, 'inici', valor)} /><span>a</span><TimePickerInput value={franja.fi} ariaLabel={`Fi franja ${index + 1}`} error={errorFranja?.index === index && errorFranja?.camp === 'fi' ? errorFranja.missatge : ''} onChange={valor => canviarFranja(index, 'fi', valor)} />{index === 1 && <button type="button" className="config-eliminar-franja" onClick={() => { setErrorFranja(null); guardar({ frangesTurnUnic: [franges[0]] }); }}>Eliminar</button>}</div>)}
          {franges.length === 1 && <button type="button" className="secondary-btn config-afegir-franja" onClick={() => guardar({ frangesTurnUnic: [...franges, { inici: '15:00', fi: '18:00' }] })}>+ Afegir segona franja</button>}
        </div> : <div className="torns-chips config-torns-chips">{TOTS_TORNS.map(torn => <button key={torn} type="button" className={'torn-chip' + ((projecte.torns || TOTS_TORNS).includes(torn) ? ' actiu' : '')} onClick={() => canviarTorn(torn)}>{torn}</button>)}</div>}
        <div className="config-dies-setmana">
          <span className="config-dies-label">Dies laborables</span>
          <div className="config-dies-grid">{DIES_SETMANA.map(dia => {
            const actiu = (projecte.diesLaborables?.length ? projecte.diesLaborables : [1, 2, 3, 4, 5]).includes(dia.id);
            return <button key={dia.id} type="button" className={'config-dia' + (actiu ? ' actiu' : '')} aria-pressed={actiu} title={dia.nom} onClick={() => canviarDia(dia.id)}><strong>{dia.curt}</strong><small>{dia.nom}</small></button>;
          })}</div>
        </div>
      </Apartat>
      <Apartat titol="Sistema de referències" actiu={projecte.mostrarReferencia} onToggle={valor => guardar({ mostrarReferencia: valor })} descripcio="Classifica i filtra la producció mitjançant el sistema de referències." />
      <Apartat titol="Control de cabal pneumàtic" actiu={projecte.controlCabal} onToggle={valor => guardar({ controlCabal: valor })} descripcio="Activa la monitorització del cabal i del consum d’aire pneumàtic." />
      <Apartat titol="Control de consum elèctric" actiu={projecte.controlConsumElectric} onToggle={valor => guardar({ controlConsumElectric: valor })} descripcio="Activa el seguiment energètic i els indicadors de consum elèctric." />
      <Apartat titol="Manteniment" actiu={projecte.mantenimentActiu} onToggle={valor => guardar({ mantenimentActiu: valor })} descripcio="Activa el control i la gestió del manteniment preventiu de la màquina." />
    </div>
  </div>;
}
