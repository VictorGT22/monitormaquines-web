'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as api from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useClientsFacturacio } from '../../../lib/useClientsFacturacio';

// Mateixos colors que --plan a .plan-card-{silver,gold,diamond} — es
// reutilitzen a la capçalera perquè la insígnia "Pla contractat" es llegeixi
// com el mateix llenguatge visual, no com una etiqueta de text solta.
const PLAN_COLORS = { silver: '#aeb8c5', gold: '#e5b94f', diamond: '#6bc7f5' };

const PLANS = [
  { id: 'silver', nom: 'Silver', subtitol: 'Nivell bàsic', descripcio: 'Per a equips petits', dispositius: 2, usuaris: 1, admins: 1 },
  { id: 'gold', nom: 'Gold', subtitol: 'Recomanat', descripcio: 'Per a operacions en creixement', dispositius: 5, usuaris: 4, admins: 2 },
  { id: 'diamond', nom: 'Diamond', subtitol: 'Empresarial', descripcio: 'Per a estructures avançades', dispositius: 10, usuaris: 9, admins: 3 },
];

function PlanIcon({ tipus }) {
  if (tipus === 'diamond') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5 7.5 4h9L20 8.5 12 20 4 8.5Z"/><path d="m4 8.5 8 3 8-3M7.5 4 12 11.5 16.5 4"/></svg>;
  if (tipus === 'gold') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 8 4 3 4-6 4 6 4-3-2 10H6L4 8Z"/><path d="M7 18h10"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-5"/></svg>;
}

function nomRol(rol) {
  if (rol === 'supervisor') return 'Administrador client';
  if (rol === 'manteniment') return 'Manteniment';
  return 'Usuari normal';
}

function ConfiguracioClient() {
  const router = useRouter();
  const params = useSearchParams();
  const tenantId = params.get('id') || '';
  const { token, errorSessio } = useAuth();
  // Llista de clients ja al Provider del layout — no cal tornar a
  // descarregar-la sencera per trobar-ne un; només es demanen aquí els
  // usuaris (dada pròpia d'aquesta pàgina, no del llistat general).
  const { clientsFacturacio, carregantClientsFacturacio, actualitzarClientFacturacio } = useClientsFacturacio();
  const client = clientsFacturacio.find(c => c.tenantId === tenantId) || null;
  // Clau del client en un ref (no com a dependència de carregarUsuaris):
  // aquesta funció actualitza clientsFacturacio, així que si en depengués
  // directament es retriggeraria a si mateixa cada vegada (bucle infinit) —
  // mateix parany que ja s'ha trobat abans amb altres efectes d'aquesta app.
  const clauClientRef = useRef(null);
  useEffect(() => { clauClientRef.current = client?.client ?? null; }, [client]);
  const [usuaris, setUsuaris] = useState([]);
  const [carregantUsuaris, setCarregantUsuaris] = useState(true);
  const carregant = carregantClientsFacturacio || carregantUsuaris;
  const [guardantPla, setGuardantPla] = useState(false);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');

  const carregarUsuaris = useCallback(async () => {
    if (!token || !tenantId) return;
    try {
      const llista = await api.getUsuarisClient(token, tenantId);
      setUsuaris(llista);
      // Els comptadors "Usuaris normals"/"Administradors" venien del
      // llistat sencer de clients (recarregat abans amb cada mutació) —
      // ara que la llista de clients ja no es torna a descarregar, es
      // deriven directament d'aquesta mateixa resposta perquè no quedin
      // desactualitzats després de crear/modificar un usuari.
      const administradorsClient = llista.filter(u => u.rol === 'supervisor').length;
      const usuarisNormals = llista.length - administradorsClient;
      if (clauClientRef.current) actualitzarClientFacturacio(clauClientRef.current, { usuarisNormals, administradorsClient });
    } catch (err) { errorSessio(err); }
    finally { setCarregantUsuaris(false); }
  }, [token, tenantId, errorSessio, actualitzarClientFacturacio]);

  useEffect(() => {
    const timer = setTimeout(carregarUsuaris, 0);
    return () => clearTimeout(timer);
  }, [carregarUsuaris]);

  async function seleccionarPla(pla) {
    if (!client || client.pla === pla || guardantPla) return;
    setError(''); setGuardantPla(true);
    try {
      const resultat = await api.actualitzarPlaClient(token, tenantId, pla);
      actualitzarClientFacturacio(client.client, { pla: resultat.pla, limits: resultat.limits });
    } catch (err) { setError(err.message || 'No s’ha pogut canviar el pla.'); }
    finally { setGuardantPla(false); }
  }

  function obrirUsuari(usuari = null) {
    setError('');
    setModal({ email: usuari?.email || '', emailOriginal: usuari?.email || '', rol: usuari?.rol || 'client', password: '', editant: Boolean(usuari), visible: false });
  }

  async function guardarUsuari(e) {
    e.preventDefault(); setError('');
    try {
      await api.guardarUsuariClient(token, tenantId, { email: modal.email, emailOriginal: modal.editant ? modal.emailOriginal : undefined, rol: modal.rol, password: modal.password });
      setModal(null);
      await carregarUsuaris();
    } catch (err) { setError(err.message || 'No s’ha pogut guardar l’usuari.'); }
  }

  if (carregant) return <div className="skeleton-card" style={{ height: 420 }} />;
  if (!client) return <div className="empty-state">Client no trobat.</div>;

  return <div className="client-config-view">
    <button className="config-back" type="button" onClick={() => router.push('/clients')}>← Tornar a clients</button>
    <header className="client-config-header" style={{ '--plan': PLAN_COLORS[client.pla] }}>
      <div><span className="config-eyebrow">Configuració del client</span><h2>{client.client}</h2><p>Selecciona el nivell operatiu i gestiona els comptes d’accés.</p></div>
      <div className="client-config-estat">
        <span>Pla contractat</span>
        <span className="client-config-estat-badge">
          <span className="client-config-estat-icon"><PlanIcon tipus={client.pla} /></span>
          <strong>{client.pla}</strong>
        </span>
      </div>
    </header>

    <section className="config-panel client-plans-section">
      <div className="config-section-heading"><div><h3>Selecciona el pla</h3><p>Compara la capacitat disponible per a aquest client.</p></div>{guardantPla && <span className="config-saving">Guardant…</span>}</div>
      <div className="plans-grid">
        {PLANS.map(p => <button type="button" key={p.id} disabled={guardantPla} className={'plan-card plan-card-' + p.id + ' ' + (client.pla === p.id ? 'selected' : '')} onClick={() => seleccionarPla(p.id)}>
          {p.id === 'gold' && <span className="plan-recommended">Recomanat</span>}
          <span className="plan-card-top"><span className="plan-icon"><PlanIcon tipus={p.id} /></span>{client.pla === p.id && <span className="plan-current">Pla actual</span>}</span>
          <strong>{p.nom}</strong><span className="plan-subtitle">{p.subtitol}</span><span className="plan-description">{p.descripcio}</span>
          <span className="plan-features">
            <span className="plan-feature"><b>{p.dispositius}</b> dispositius simultanis</span><span className="plan-feature"><b>{p.admins}</b> administrador{p.admins === 1 ? '' : 's'}</span><span className="plan-feature"><b>{p.usuaris}</b> usuari{p.usuaris === 1 ? '' : 's'} estàndard</span>
          </span>
          <span className="plan-select-cta">{client.pla === p.id ? 'Pla actual' : `Seleccionar ${p.nom}`}</span>
        </button>)}
      </div>

    </section>

    <section className="config-panel client-users-section">
      <div className="config-section-heading"><div><h3>Gestió d’usuaris del client</h3><p>Pla {client.pla} · {client.administradorsClient} <i>/</i> {client.limits.administradors} administradors · {client.usuarisNormals} <i>/</i> {client.limits.usuaris} usuaris</p></div><button type="button" className="btn-primary" onClick={() => obrirUsuari()}>+ Registrar usuari</button></div>
      <div className="taula-scroll client-users-table"><table className="taula-dispositius"><thead><tr><th>Usuari</th><th>Rol assignat</th><th>Accions</th></tr></thead><tbody>
        {usuaris.map(u => <tr key={u.email}><td className="client-user-cell"><span className={'client-user-avatar' + (u.rol === 'supervisor' ? ' client-user-avatar-admin' : u.rol === 'manteniment' ? ' client-user-avatar-maintenance' : '')}>{u.email.slice(0, 2).toUpperCase()}</span><div><strong>{u.email}</strong></div></td><td><span className={'chip-rol ' + (u.rol === 'supervisor' ? 'chip-admin' : u.rol === 'manteniment' ? 'chip-maintenance' : '')}>{nomRol(u.rol)}</span></td><td className="table-actions"><button type="button" className="client-user-edit" onClick={() => obrirUsuari(u)}>Modificar usuari</button></td></tr>)}
        {!usuaris.length && <tr><td colSpan="3">Encara no hi ha usuaris.</td></tr>}
      </tbody></table></div>
    </section>
    {error && !modal && <div className="form-error">{error}</div>}

    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null); }}><div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
      <div className="modal-heading"><div><h3 id="user-modal-title">{modal.editant ? 'Modificar usuari' : 'Registrar usuari'}</h3><p>{modal.editant ? 'Deixa la contrasenya buida per conservar l’actual.' : 'La contrasenya ha de tenir com a mínim 8 caràcters.'}</p></div><button type="button" className="modal-close" onClick={() => setModal(null)}>×</button></div>
      <form onSubmit={guardarUsuari} className="user-form">
        <label>Nom d’usuari<input type="text" required minLength={3} maxLength={100} autoComplete="username" value={modal.email} onChange={e => setModal(m => ({ ...m, email: e.target.value }))} /></label>
        <div className="user-field"><span>Rol</span><div className={'role-select-field' + (modal.rolObert ? ' open' : '')}>
          <button type="button" className="role-select-trigger" aria-haspopup="listbox" aria-expanded={Boolean(modal.rolObert)} onClick={() => setModal(m => ({ ...m, rolObert: !m.rolObert }))}>
            <span>{nomRol(modal.rol)}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
          </button>
          {modal.rolObert && <div className="role-select-menu" role="listbox" aria-label="Rol">
            {[['client', 'Usuari normal'], ['manteniment', 'Manteniment'], ['supervisor', 'Administrador client']].map(([valor, etiqueta]) => <button type="button" role="option" aria-selected={modal.rol === valor} className={modal.rol === valor ? 'selected' : ''} key={valor} onClick={() => setModal(m => ({ ...m, rol: valor, rolObert: false }))}><span>{etiqueta}</span>{modal.rol === valor && <b>✓</b>}</button>)}
          </div>}
        </div></div>
        <label>Contrasenya<div className="password-field"><input type={modal.visible ? 'text' : 'password'} required={!modal.editant} minLength={8} autoComplete="new-password" value={modal.password} onChange={e => setModal(m => ({ ...m, password: e.target.value }))} /><button type="button" onClick={() => setModal(m => ({ ...m, visible: !m.visible }))}>{modal.visible ? 'Ocultar' : 'Mostrar'}</button></div></label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions"><button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel·lar</button><button type="submit" className="btn-primary">Guardar usuari</button></div>
      </form>
    </div></div>}
  </div>;
}

export default function ClientConfiguracioPage() {
  return <Suspense fallback={<div className="skeleton-card" style={{ height: 420 }} />}><ConfiguracioClient /></Suspense>;
}
