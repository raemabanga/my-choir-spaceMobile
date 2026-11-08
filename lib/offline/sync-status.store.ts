// État de synchronisation affiché à l'utilisateur (bannière, badge, compteur).
// Seul le syncManager l'écrit ; les composants le lisent via useSyncSummary().

import { create } from "zustand"

export type SyncState = "idle" | "syncing" | "error" | "offline"

export interface InitialSyncProgress {
  /** Étape en cours (libellé de l'entité), null hors synchronisation initiale. */
  current: string | null
  done: number
  total: number
}

interface SyncStatusStore {
  /** Faux tant que la base n'est pas ouverte (démarrage) ou si elle n'a pas pu l'être. */
  ready: boolean
  isOnline: boolean
  /** Opérations en attente d'envoi (y compris en cours d'envoi). */
  pendingCount: number
  /** Opérations abandonnées après plusieurs essais. */
  failedCount: number
  syncState: SyncState
  lastSyncAt: number | null
  lastError: string | null
  /**
   * Suppression refusée par le serveur (l'élément est réapparu). Reste affichée jusqu'à ce que
   * l'utilisateur la ferme : un passage de synchronisation suivant ne l'efface pas.
   */
  rejection: string | null
  initialSyncDone: boolean
  initialSync: InitialSyncProgress
  set: (patch: Partial<Omit<SyncStatusStore, "set">>) => void
}

export const useSyncStatusStore = create<SyncStatusStore>((set) => ({
  ready: false,
  isOnline: true,
  pendingCount: 0,
  failedCount: 0,
  syncState: "idle",
  lastSyncAt: null,
  lastError: null,
  rejection: null,
  initialSyncDone: false,
  initialSync: { current: null, done: 0, total: 0 },
  set: (patch) => set(patch),
}))
