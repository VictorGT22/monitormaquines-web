'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { MaquinesProvider } from '../lib/useMaquines';
import { ProjectesErpProvider } from '../lib/useProjectesErp';
import { ClientsFacturacioProvider } from '../lib/useClientsFacturacio';
import { t } from '../lib/i18n';

const TABS = [
  { vista: 'maquines', href: '/' },
  { vista: 'projectes', href: '/projectes' },
  { vista: 'clients', href: '/clients' },
  { vista: 'dispositius', href: '/dispositius' },
];

// Rutes restringides a l'admin — el backend ja les rebutja (requereixAdmin,
// 403), però un usuari client que hi escrigui l'URL directament no ha de
// veure ni un instant la pàgina buida esperant l'error: es talla abans de
// muntar-la. Mateixa llista que els botons de nav ocults amb esAdmin.
const PREFIXOS_RUTES_ADMIN = ['/projectes', '/clients', '/dispositius'];

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, sessio, estatSessio, logout, appError, setAppError } = useAuth();
  const esAdmin = sessio?.rol === 'admin';
  const idioma = sessio?.idioma || 'ca';
  const rutaNomesAdmin = PREFIXOS_RUTES_ADMIN.some((p) => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    if (estatSessio !== 'llest') return;
    if (!token) { router.replace('/login'); return; }
    if (sessio && !esAdmin && rutaNomesAdmin) router.replace('/');
  }, [estatSessio, token, sessio, esAdmin, rutaNomesAdmin, router]);

  if (estatSessio === 'comprovant' || !token) return null;
  if (sessio && !esAdmin && rutaNomesAdmin) return null;

  return (
    <MaquinesProvider>
    <ProjectesErpProvider>
    <ClientsFacturacioProvider>
    <div id="app-view">
      <div id="app-header">
        <div className="header-left">
          <span className="header-logo"><img src="https://i.imgur.com/9mcC7UG.png" alt="NEXA" /></span>
          <span className="client-name" id="nom-client">{sessio?.nomClient}</span>
          <nav id="admin-nav" className={esAdmin ? '' : 'hidden'}>
            <button className={'nav-tab' + (pathname === '/' ? ' actiu' : '')} onClick={() => router.push('/')}>Màquines</button>
            <button className={'nav-tab' + (pathname === '/projectes' ? ' actiu' : '')} onClick={() => router.push('/projectes')}>Projectes ERP</button>
            <button className={'nav-tab' + (pathname === '/clients' ? ' actiu' : '')} onClick={() => router.push('/clients')}>Clients</button>
            <button className={'nav-tab' + (pathname === '/dispositius' ? ' actiu' : '')} onClick={() => router.push('/dispositius')}>{t(idioma, 'dispositius_titol')}</button>
          </nav>
        </div>
        <button onClick={logout} id="btn-sortir">{t(idioma, 'sortir')}</button>
      </div>

      <main>
        {appError ? (
          <div id="app-error" className="error-msg" style={{ display: 'block', cursor: 'pointer' }} title="Clica per tancar" onClick={() => setAppError('')}>
            {appError}
          </div>
        ) : null}
        {children}
      </main>
    </div>
    </ClientsFacturacioProvider>
    </ProjectesErpProvider>
    </MaquinesProvider>
  );
}
