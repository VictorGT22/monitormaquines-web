'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import * as api from './api';
import { useAuth } from './auth-context';

const ProjectesErpContext = createContext(null);

// Mateix motiu que MaquinesProvider (useMaquines.js): muntat un sol cop al
// layout, no dins la pàgina — Next.js desmunta el component de la ruta
// anterior en navegar, així que si la llista visqués a ProjectesPage cada
// tornada a /projectes tornava a descarregar-ho TOT del ERP encara que no
// hagués canviat res. Aquí la llista es carrega un sol cop per sessió i es
// manté en memòria mentre l'usuari navega per l'app.
export function ProjectesErpProvider({ children }) {
  const { token, sessio, errorSessio } = useAuth();
  const esAdmin = sessio?.rol === 'admin';
  const pathname = usePathname();
  const [projectes, setProjectes] = useState(null); // null = encara no carregat
  const [carregant, setCarregant] = useState(false);
  const carregatRef = useRef(false);

  const carregar = useCallback(async (forçar) => {
    if (!token || !esAdmin) return;
    if (carregatRef.current && !forçar) return; // ja el tenim — no tornar a demanar tot el llistat
    setCarregant(true);
    try {
      const dades = await api.getProjectesErp(token);
      setProjectes(dades);
      carregatRef.current = true;
    } catch (err) {
      errorSessio(err);
    } finally {
      setCarregant(false);
    }
  }, [token, esAdmin, errorSessio]);

  useEffect(() => {
    // El Provider conserva la cache entre navegacions, però no ha de
    // precargar tot l'ERP mentre l'usuari només mira la portada.
    if (pathname === '/projectes' || pathname.startsWith('/projectes/')) carregar();
  }, [carregar, pathname]);

  // Aplica localment el canvi d'un sol projecte — cap mutació d'aquesta
  // pàgina necessita re-descarregar el llistat sencer: cada PATCH ja diu
  // exactament quin camp ha canviat i l'API confirma amb {ok:true}, no cal
  // tornar a demanar-ho al servidor per saber-ho.
  const actualitzar = useCallback((id, camps) => {
    setProjectes((prev) => (prev || []).map((p) => (p.id !== id ? p : { ...p, ...camps })));
  }, []);

  const value = { projectes: projectes || [], carregantProjectes: carregant && !carregatRef.current, actualitzarProjecte: actualitzar, recarregarProjectes: () => carregar(true) };
  return <ProjectesErpContext.Provider value={value}>{children}</ProjectesErpContext.Provider>;
}

export function useProjectesErp() {
  const ctx = useContext(ProjectesErpContext);
  if (!ctx) throw new Error('useProjectesErp() ha d\'anar dins de <ProjectesErpProvider>');
  return ctx;
}
