// Résumé de l'état de synchronisation pour l'interface (bannière, badge, compteur).

import { useShallow } from "zustand/react/shallow"
import { syncManager, useSyncStatusStore } from "../../lib/offline"

export function useSyncSummary() {
  const state = useSyncStatusStore(
    useShallow((s) => ({
      ready: s.ready,
      isOnline: s.isOnline,
      pendingCount: s.pendingCount,
      failedCount: s.failedCount,
      syncState: s.syncState,
      lastSyncAt: s.lastSyncAt,
      lastError: s.lastError,
      initialSyncDone: s.initialSyncDone,
    }))
  )
  return {
    ...state,
    isSyncing: state.syncState === "syncing",
    hasPending: state.pendingCount > 0,
    forceSync: () => syncManager.forceSync(),
    retryFailed: () => syncManager.retryFailed(),
  }
}
