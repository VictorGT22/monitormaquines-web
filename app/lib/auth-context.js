'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from './api';

const AuthContext = createContext(null);

// Mateixes claus de localStorage que gas-bridge.js/index.html original —
// no canviar sense migrar les sessions ja desades als dispositius dels clients.
const CLAU_TOKEN = 'monitor_token';
const CLAU_EMAIL = 'monitor_email';
const CLAU_DEVICE_ID = 'monitor_device_id';

function obtenirInfoDispositiu_() {
  let deviceId = '';
  try {
    deviceId = localStorage.getItem(CLAU_DEVICE_ID) || '';
    if (!deviceId) {
      deviceId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem(CLAU_DEVICE_ID, deviceId);
    }
  } catch (e) {
    deviceId = 'temporal-' + Math.random().toString(36).slice(2);
  }
  const ua = navigator.userAgent || '';
  const esAndroid = /Android/i.test(ua);
  const esIOS = /iPhone|iPad|iPod/i.test(ua);
  const esWindows = /Windows/i.test(ua);
  const plataforma = esAndroid ? 'android' : esIOS ? 'ios' : esWindows ? 'windows' : 'web';
  const dispositiuNom = esAndroid ? 'Android' : esIOS ? 'iPhone / iPad' : esWindows ? 'Web · Windows' : 'Navegador web';
  return { deviceId, plataforma, dispositiuNom };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [sessio, setSessio] = useState(null); // { rol, idioma, nomClient }
  const [appError, setAppError] = useState('');
  // 'comprovant' evita un flash de la vista de login mentre es valida un
  // token ja desat — 'llest' vol dir "ja sabem si hi ha sessió o no".
  const [estatSessio, setEstatSessio] = useState('comprovant');

  useEffect(() => {
    let desat = null;
    try { desat = localStorage.getItem(CLAU_TOKEN); } catch (e) {}
    if (!desat) { setEstatSessio('llest'); return; }
    setToken(desat);
    api.getSessioActual(desat)
      .then((resp) => {
        setSessio({ rol: resp.rol, idioma: resp.idioma || 'ca', nomClient: resp.nomClient });
        setEstatSessio('llest');
      })
      .catch(() => {
        try { localStorage.removeItem(CLAU_TOKEN); } catch (e) {}
        setToken(null);
        setEstatSessio('llest');
      });
  }, []);

  const login = useCallback(async (email, password) => {
    const resp = await api.login(email, password, obtenirInfoDispositiu_());
    try { localStorage.setItem(CLAU_EMAIL, email); } catch (e) {}
    try { localStorage.setItem(CLAU_TOKEN, resp.token); } catch (e) {}
    setToken(resp.token);
    setSessio({ rol: resp.rol, idioma: resp.idioma || 'ca', nomClient: resp.nomClient });
    return resp;
  }, []);

  const logout = useCallback(() => {
    if (token) api.logout(token).catch(() => {});
    try { localStorage.removeItem(CLAU_TOKEN); } catch (e) {}
    setToken(null);
    setSessio(null);
    setAppError('');
  }, [token]);

  function emailDesat() {
    try { return localStorage.getItem(CLAU_EMAIL) || ''; } catch (e) { return ''; }
  }

  // Port de errorSessio_(): sessió realment invàlida (401) -> torna a login
  // en lloc de deixar l'app mig oberta amb un banner vermell; qualsevol
  // altre error es mostra com a banner (#app-error).
  const errorSessio = useCallback((err) => {
    const missatge = (err && err.message) || String(err) || 'Error desconegut.';
    console.error('Error API:', missatge);
    if (err && err.status === 401) { logout(); return; }
    setAppError(missatge);
  }, [logout]);

  const value = { token, sessio, estatSessio, login, logout, emailDesat, appError, setAppError, errorSessio };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() ha d\'anar dins de <AuthProvider>');
  return ctx;
}
