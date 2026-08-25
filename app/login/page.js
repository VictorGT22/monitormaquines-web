'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

// Dibuixa/actualitza el contorn SVG animat del botó — port 1:1 de
// _loginBtnTrace() a index.html (mides dinàmiques segons offsetWidth/Height
// del botó real, no es pot fer amb CSS pur).
function actualitzarTraceBoto_(btn) {
  const ns = 'http://www.w3.org/2000/svg';
  let svg = btn.querySelector('.btn-trace');
  let r;
  if (!svg) {
    svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'btn-trace');
    r = document.createElementNS(ns, 'rect');
    svg.appendChild(r);
    btn.appendChild(svg);
  } else {
    r = svg.querySelector('rect');
  }
  const w = btn.offsetWidth || 120;
  const h = btn.offsetHeight || 36;
  const bw = parseFloat(getComputedStyle(btn).borderTopWidth) || 0;
  const rad = parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 8;
  const sw = 1.5;
  svg.style.position = 'absolute';
  svg.style.left = -bw + 'px';
  svg.style.top = -bw + 'px';
  svg.style.setProperty('width', w + 'px', 'important');
  svg.style.setProperty('height', h + 'px', 'important');
  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  r.setAttribute('x', sw / 2);
  r.setAttribute('y', sw / 2);
  r.setAttribute('width', w - sw);
  r.setAttribute('height', h - sw);
  r.setAttribute('rx', rad);
  r.setAttribute('ry', rad);
  r.setAttribute('pathLength', '100');
}

export default function LoginPage() {
  const router = useRouter();
  const { login, estatSessio, token, emailDesat } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [estatBoto, setEstatBoto] = useState('normal'); // normal | tracing | done | error
  const [shake, setShake] = useState(false);

  const botoRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    setEmail(emailDesat());
  }, [emailDesat]);

  // Si ja hi ha sessió vàlida (comprovada per AuthProvider), saltem directes
  // a l'app — mateix comportament que ocultar #login-view via localStorage.
  useEffect(() => {
    if (estatSessio === 'llest' && token) router.replace('/');
  }, [estatSessio, token, router]);

  async function gestionarLogin() {
    setError('');
    setEstatBoto('tracing');
    if (botoRef.current) actualitzarTraceBoto_(botoRef.current);
    try {
      await login(email, password);
      setEstatBoto('done');
      setTimeout(() => router.replace('/'), 200);
    } catch (err) {
      if (botoRef.current) actualitzarTraceBoto_(botoRef.current);
      setEstatBoto('error');
      setError(err.message);
      // Reflow forçat perquè el shake es repeteixi en errors consecutius
      // (igual que a l'original: remove -> offsetWidth -> add).
      setShake(false);
      requestAnimationFrame(() => setShake(true));
      setTimeout(() => setEstatBoto('normal'), 1300);
    }
  }

  if (estatSessio === 'comprovant' || (estatSessio === 'llest' && token)) return null;

  return (
    <div id="login-view">
      <div className={'login-box' + (shake ? ' shake' : '')} onAnimationEnd={() => setShake(false)}>
        <div className="login-logo-circle"><img src="https://i.imgur.com/9mcC7UG.png" alt="NEXA" /></div>
        <h1>Nexa Control</h1>
        <span className="subtitle">Accés client</span>
        <div className="error-msg" id="login-error">{error}</div>
        <div className="login-input-wrap">
          <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8a95a5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          <input
            type="text"
            id="login-email"
            placeholder="Nom d'usuari"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') passwordRef.current?.focus(); }}
          />
        </div>
        <div className="login-input-wrap">
          <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8a95a5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
          <input
            ref={passwordRef}
            type={mostrarPassword ? 'text' : 'password'}
            id="login-password"
            placeholder="Contrasenya"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') gestionarLogin(); }}
          />
          <button
            type="button"
            className={'login-toggle-pw' + (mostrarPassword ? ' showing' : '')}
            id="toggle-pw"
            title="Mostrar contrasenya"
            tabIndex={-1}
            onClick={() => setMostrarPassword((v) => !v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8a95a5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
          </button>
        </div>
        <button
          ref={botoRef}
          type="button"
          className={estatBoto === 'normal' ? '' : estatBoto}
          disabled={estatBoto === 'tracing'}
          onClick={gestionarLogin}
        >
          Entrar
        </button>
      </div>
    </div>
  );
}
