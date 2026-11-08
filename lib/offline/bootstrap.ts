// Démarrage du mode hors ligne, dans l'ordre :
//   1. initializeDatabase()        crée les tables SQLite si besoin
//   2. networkMonitor.initialize() commence à surveiller le réseau
//   3. syncManager.initialize()    écoute le réseau + envoie ce qui est en attente
//
// Important : les déclarations d'entités (defineOfflineEntity) doivent être importées AVANT
// cet appel, sinon les opérations en file de ces entités attendront leur déclaration.

import { initializeDatabase } from "./database"
import { networkMonitor } from "./network-monitor"
import { syncManager, type ErrorKind } from "./sync-manager"
import { useSyncStatusStore } from "./sync-status.store"

let started: Promise<boolean> | null = null

/**
 * Renvoie vrai si le mode hors ligne est prêt. En cas d'échec (ex. SQLite indisponible sur le web
 * sans configuration), l'application continue de démarrer, sans mode hors ligne.
 */
export function initializeOffline(options?: {
  canSync?: () => boolean | Promise<boolean>
  classifyError?: (error: unknown) => ErrorKind
  /** Version des entités déclarées (voir syncManager.configure). */
  dataVersion?: string
}): Promise<boolean> {
  if (started) return started
  started = (async () => {
    try {
      if (options) syncManager.configure(options)
      await initializeDatabase()
      await networkMonitor.initialize()
      await syncManager.initialize()
      return true
    } catch (e) {
      console.warn("[offline] mode hors ligne indisponible :", e)
      useSyncStatusStore.getState().set({ ready: false, lastError: e instanceof Error ? e.message : String(e) })
      started = null
      return false
    }
  })()
  return started
}
