'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { t } from '../lib/i18n';

const TABS = [
  { vista: 'maquines', href: '/' },
  { vista: 'projectes', href: '/projectes' },
  { vista: 'clients', href: '/clients' },
  { vista: 'dispositius', href: '/dispositius' },
];

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, sessio, estatSessio, logout, appError, setAppError } = useAuth();
  const esAdmin = sessio?.rol === 'admin';
  const idioma = sessio?.idioma || 'ca';

  useEffect(() => {
    if (estatSessio === 'llest' && !token) router.replace('/login');
  }, [estatSessio, token, router]);

  if (estatSessio === 'comprovant' || !token) return null;

  return (
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
  );
}
