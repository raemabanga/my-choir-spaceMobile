// Point d'entrée du mode hors ligne. Voir lib/offline/README.md.

export { initializeOffline } from "./bootstrap"
export { getMeta, registerMigration, setMeta, type Migration } from "./database"
export { networkMonitor } from "./network-monitor"
export { OfflineRepository, type OfflineRecord, type RecordSyncStatus, type RemoteRecord } from "./offline-repository"
export { OfflineProvider, offlineQueryClient } from "./OfflineProvider"
export { defineOfflineEntity, DependencyPendingError, type SyncHandler } from "./registry"
export { dataChanged } from "./events"
export { cacheSession, clearCachedSession, readCachedSession } from "./session-cache"
export { syncManager, type ErrorKind, type PullResult } from "./sync-manager"
export { syncQueueService, type QueueItem, type SyncOperation } from "./sync-queue.service"
export { useSyncStatusStore, type SyncState } from "./sync-status.store"
