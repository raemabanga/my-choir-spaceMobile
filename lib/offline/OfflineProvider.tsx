// Fournit le cache TanStack Query aux hooks hors ligne et le tient à jour :
// les requêtes locales (lecture SQLite) ne se rafraîchissent pas seules ; elles sont
// invalidées à chaque écriture locale et à la fin de chaque synchronisation.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { dataChanged } from "./events"

export const offlineQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Les lectures viennent de SQLite : pas de nouvel essai, pas de rafraîchissement automatique.
      retry: false,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: { retry: false },
  },
})

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  useEffect(
    () =>
      dataChanged.subscribe((entity) => {
        if (entity === "*") void offlineQueryClient.invalidateQueries()
        else void offlineQueryClient.invalidateQueries({ queryKey: [entity] })
      }),
    []
  )
  return <QueryClientProvider client={offlineQueryClient}>{children}</QueryClientProvider>
}
