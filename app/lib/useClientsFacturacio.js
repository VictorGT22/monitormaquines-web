'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import * as api from './api';
import { useAuth } from './auth-context';

const ClientsFacturacioContext = createContext(null);

// Mateix patró que ProjectesErpProvider/MaquinesProvider: muntat un sol cop
// al layout, no dins la pàgina — així navegar a /clients, entrar a la
// configuració d'un client i tornar-hi no torna a descarregar tot el
// llistat de facturació cada vegada.
export function ClientsFacturacioProvider({ children }) {
  const { token, sessio, errorSessio } = useAuth();
  const esAdmin = sessio?.rol === 'admin';
  const pathname = usePathname();
  const [clients, setClients] = useState(null); // null = encara no carregat
  const [carregant, setCarregant] = useState(false);
  const carregatRef = useRef(false);

  const carregar = useCallback(async (forçar) => {
    if (!token || !esAdmin) return;
    if (carregatRef.current && !forçar) return; // ja el tenim
    setCarregant(true);
    try {
      const dades = await api.getClientsFacturacio(token);
      setClients(dades);
      carregatRef.current = true;
    } catch (err) {
      errorSessio(err);
    } finally {
      setCarregant(false);
    }
  }, [token, esAdmin, errorSessio]);

  useEffect(() => {
    // Manté la llista en memòria després de visitar Clients, però evita
    // baixar-la durant l'arrencada de la portada, on no es consumeix.
    if (pathname === '/clients' || pathname.startsWith('/clients/')) carregar();
  }, [carregar, pathname]);

  const actualitzar = useCallback((clientId, camps) => {
    setClients((prev) => (prev || []).map((c) => (c.client !== clientId ? c : { ...c, ...camps })));
  }, []);

  const value = {
    clientsFacturacio: clients || [],
    carregantClientsFacturacio: carregant && !carregatRef.current,
    actualitzarClientFacturacio: actualitzar,
    recarregarClientsFacturacio: () => carregar(true),
  };
  return <ClientsFacturacioContext.Provider value={value}>{children}</ClientsFacturacioContext.Provider>;
}

export function useClientsFacturacio() {
  const ctx = useContext(ClientsFacturacioContext);
  if (!ctx) throw new Error('useClientsFacturacio() ha d\'anar dins de <ClientsFacturacioProvider>');
  return ctx;
}
