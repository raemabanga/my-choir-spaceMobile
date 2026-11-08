// File d'attente des opérations à envoyer au serveur, stockée dans SQLite :
// elle survit à la fermeture de l'application.
//
// Cycle de vie d'une opération : pending → processing → (supprimée) | pending (nouvel essai) | failed.

import { getDb } from "./database"
import { queueChanged } from "./events"

export type SyncOperation = "CREATE" | "UPDATE" | "DELETE"
export type QueueStatus = "pending" | "processing" | "failed"

export interface QueueItem {
  id: number
  entity: string
  operation: SyncOperation
  entityLocalId: string
  payload: unknown
  status: QueueStatus
  attempts: number
  lastError: string | null
  priority: number
  createdAt: number
  updatedAt: number
}

interface QueueRow {
  id: number
  entity: string
  operation: SyncOperation
  entity_local_id: string
  payload: string | null
  status: QueueStatus
  attempts: number
  last_error: string | null
  priority: number
  created_at: number
  updated_at: number
}

function toItem(row: QueueRow): QueueItem {
  return {
    id: row.id,
    entity: row.entity,
    operation: row.operation,
    entityLocalId: row.entity_local_id,
    payload: row.payload == null ? null : JSON.parse(row.payload),
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Nombre maximal d'essais avant de passer une opération en `failed`. */
export const MAX_ATTEMPTS = 3

/** Ordre d'arrivée strict, même pour deux ajouts dans la même milliseconde. */
let lastPriority = 0
function nextPriority() {
  lastPriority = Math.max(Date.now(), lastPriority + 1)
  return lastPriority
}

export const syncQueueService = {
  /** Ajoute une opération en fin de file. */
  enqueue(input: { entity: string; operation: SyncOperation; entityLocalId: string; payload?: unknown }): number {
    const now = Date.now()
    const result = getDb().runSync(
      `INSERT INTO sync_queue (entity, operation, entity_local_id, payload, status, attempts, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
      input.entity,
      input.operation,
      input.entityLocalId,
      input.payload === undefined ? null : JSON.stringify(input.payload),
      nextPriority(),
      now,
      now
    )
    queueChanged.emit({ enqueued: true })
    return result.lastInsertRowId
  },

  /** Opérations à traiter, dans l'ordre d'arrivée. */
  getPending(): QueueItem[] {
    return getDb()
      .getAllSync<QueueRow>("SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY priority ASC, id ASC")
      .map(toItem)
  },

  getFailed(): QueueItem[] {
    return getDb()
      .getAllSync<QueueRow>("SELECT * FROM sync_queue WHERE status = 'failed' ORDER BY priority ASC, id ASC")
      .map(toItem)
  },

  getById(id: number): QueueItem | null {
    const row = getDb().getFirstSync<QueueRow>("SELECT * FROM sync_queue WHERE id = ?", id)
    return row ? toItem(row) : null
  },

  /** Opérations encore à envoyer (en attente ou en cours d'envoi) pour un enregistrement. */
  getActiveForRecord(entity: string, localId: string): QueueItem[] {
    return getDb()
      .getAllSync<QueueRow>(
        "SELECT * FROM sync_queue WHERE entity = ? AND entity_local_id = ? AND status IN ('pending', 'processing') ORDER BY priority ASC, id ASC",
        entity,
        localId
      )
      .map(toItem)
  },

  /** Vrai s'il reste une opération non terminée (y compris en échec) pour cet enregistrement, hors `exceptId`. */
  hasOtherOpenOps(entity: string, localId: string, exceptId?: number): boolean {
    const row = getDb().getFirstSync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM sync_queue WHERE entity = ? AND entity_local_id = ? AND id != ?",
      entity,
      localId,
      exceptId ?? -1
    )
    return (row?.n ?? 0) > 0
  },

  /** Remplace le contenu d'une opération encore `pending` (jamais pendant son envoi). Renvoie faux sinon. */
  updatePayload(id: number, payload: unknown): boolean {
    const result = getDb().runSync(
      "UPDATE sync_queue SET payload = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
      JSON.stringify(payload),
      Date.now(),
      id
    )
    return result.changes > 0
  },

  /**
   * Remet une opération en échec dans la file avec un nouveau contenu, à sa place d'origine
   * (sa priorité est conservée : elle reste devant les opérations ajoutées après elle).
   */
  reviveWithPayload(id: number, payload: unknown): boolean {
    const result = getDb().runSync(
      "UPDATE sync_queue SET status = 'pending', attempts = 0, last_error = NULL, payload = ?, updated_at = ? WHERE id = ? AND status = 'failed'",
      JSON.stringify(payload),
      Date.now(),
      id
    )
    if (result.changes > 0) queueChanged.emit({ enqueued: true })
    return result.changes > 0
  },

  /** Remplace le contenu d'une opération quel que soit son statut (hors envoi en cours). */
  setPayload(id: number, payload: unknown) {
    getDb().runSync("UPDATE sync_queue SET payload = ?, updated_at = ? WHERE id = ? AND status != 'processing'", JSON.stringify(payload), Date.now(), id)
  },

  /** Supprime les opérations d'un type donné (en attente et en échec, jamais en cours d'envoi) d'un enregistrement. */
  removeOps(entity: string, localId: string, operation: SyncOperation) {
    const result = getDb().runSync(
      "DELETE FROM sync_queue WHERE entity = ? AND entity_local_id = ? AND operation = ? AND status IN ('pending', 'failed')",
      entity,
      localId,
      operation
    )
    if (result.changes > 0) queueChanged.emit({ enqueued: false })
  },

  /** Toutes les opérations d'un enregistrement, quel que soit leur statut. */
  getAllForRecord(entity: string, localId: string): QueueItem[] {
    return getDb()
      .getAllSync<QueueRow>("SELECT * FROM sync_queue WHERE entity = ? AND entity_local_id = ? ORDER BY priority ASC, id ASC", entity, localId)
      .map(toItem)
  },

  /**
   * Prend une opération pour l'envoyer (pending → processing). Renvoie faux si elle a été
   * annulée ou modifiée entre-temps : il ne faut alors pas l'envoyer.
   */
  markProcessing(id: number): boolean {
    const result = getDb().runSync("UPDATE sync_queue SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'pending'", Date.now(), id)
    return result.changes > 0
  },

  /** Envoi réussi : l'opération est effacée. */
  markCompleted(id: number) {
    getDb().runSync("DELETE FROM sync_queue WHERE id = ?", id)
    queueChanged.emit({ enqueued: false })
  },

  /**
   * Envoi raté. `countAttempt` = faux pour une coupure réseau ou un 401 (l'opération n'est pas en cause).
   * Passe en `failed` après MAX_ATTEMPTS essais. Renvoie le nouveau statut.
   */
  markFailed(id: number, error: string, { countAttempt = true, definitive = false } = {}): QueueStatus {
    const item = this.getById(id)
    if (!item) return "failed"
    const attempts = item.attempts + (countAttempt ? 1 : 0)
    const status: QueueStatus = definitive || attempts >= MAX_ATTEMPTS ? "failed" : "pending"
    getDb().runSync(
      "UPDATE sync_queue SET status = ?, attempts = ?, last_error = ?, updated_at = ? WHERE id = ?",
      status,
      attempts,
      error,
      Date.now(),
      id
    )
    queueChanged.emit({ enqueued: false })
    return status
  },

  /** Remet en `pending` les opérations restées `processing` (application fermée pendant un envoi). */
  resetStuckProcessing() {
    getDb().runSync("UPDATE sync_queue SET status = 'pending', updated_at = ? WHERE status = 'processing'", Date.now())
  },

  /** Relance les opérations en échec (remet le compteur d'essais à zéro). */
  retryFailed(): number {
    const result = getDb().runSync("UPDATE sync_queue SET status = 'pending', attempts = 0, updated_at = ? WHERE status = 'failed'", Date.now())
    if (result.changes > 0) queueChanged.emit({ enqueued: true })
    return result.changes
  },

  /** Annule toutes les opérations non commencées d'un enregistrement (suppression d'un élément jamais envoyé). */
  cancelForRecord(entity: string, localId: string) {
    getDb().runSync("DELETE FROM sync_queue WHERE entity = ? AND entity_local_id = ? AND status != 'processing'", entity, localId)
    queueChanged.emit({ enqueued: false })
  },

  remove(id: number) {
    getDb().runSync("DELETE FROM sync_queue WHERE id = ?", id)
    queueChanged.emit({ enqueued: false })
  },

  counts(): { pending: number; failed: number } {
    const rows = getDb().getAllSync<{ status: QueueStatus; n: number }>("SELECT status, COUNT(*) AS n FROM sync_queue GROUP BY status")
    let pending = 0
    let failed = 0
    for (const r of rows) {
      if (r.status === "failed") failed += r.n
      else pending += r.n
    }
    return { pending, failed }
  },
}
