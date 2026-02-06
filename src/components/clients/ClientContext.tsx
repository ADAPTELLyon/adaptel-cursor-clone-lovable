import React, { createContext, useContext, useState, ReactNode } from "react";

/**
 * Ce contexte permet de partager l'ID du client et les fonctions de rafraîchissement
 * entre tous les onglets sans passer par des "props" complexes.
 */

interface ClientContextType {
  clientId: string | null;
  setClientId: (id: string | null) => void;
  isNewClient: boolean;
  refreshAll: number; // Compteur pour forcer le rafraîchissement des listes
  triggerRefresh: () => void;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [refreshAll, setRefreshAll] = useState(0);

  const triggerRefresh = () => setRefreshAll((prev) => prev + 1);

  const isNewClient = !clientId || clientId === "new";

  return (
    <ClientContext.Provider value={{ clientId, setClientId, isNewClient, refreshAll, triggerRefresh }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error("useClient doit être utilisé à l'intérieur de ClientProvider");
  }
  return context;
}