// Repository générique : lit et écrit une entité dans SQLite (table local_records) et alimente
// la file d'attente. Les écrans n'appellent jamais l'API : ils passent par ici (via les hooks).
//
// Une instance par entité, créée par `defineOfflineEntity` (lib/offline/registry.ts).

import * as Crypto from "expo-crypto"
import { getDb } from "./database"
import { dataChanged } from "./events"
import { syncQueueService } from "./sync-queue.service"

export type RecordSyncStatus = "synced" | "pending" | "failed"

/** Un élément tel que les écrans le reçoivent. */
export interface OfflineRecord<T> {
  /** Identifiant local (UUID), stable : à utiliser comme clé dans les listes. */
  localId: string
  /** Identifiant côté serveur, null tant que l'élément n'a pas été envoyé. */
  serverId: string | null
  data: T
  /** `pending` : modification locale pas encore envoyée · `failed` : envoi abandonné après plusieurs essais. */
  syncStatus: RecordSyncStatus
  createdAt: number
  updatedAt: number
}

/** Un élément tel que le serveur le renvoie (converti par le handler de l'entité). */
export interface RemoteRecord<T> {
  serverId: string | number
  data: T
  /** Date de dernière modification côté serveur, si l'API la fournit (sert à ignorer les réponses périmées). */
  updatedAt?: number | string | Date | null
}

interface RecordRow {
  entity: string
  local_id: string
  server_id: string | null
  data: string
  sync_status: RecordSyncStatus
  created_at: number
  updated_at: number
  server_updated_at: number | null
  last_pushed_at: number | null
  deleted_at: number | null
}

/** Un élément envoyé il y a moins de 30 s garde sa version locale (le serveur peut renvoyer un état antérieur). */
const RECENT_PUSH_MS = 30_000

const toMillis = (value: RemoteRecord<unknown>["updatedAt"]) => {
  if (value == null) return null
  const ms = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

export class OfflineRepository<T extends object> {
  constructor(readonly entity: string) {}

  private get db() {
    return getDb()
  }

  private toRecord(row: RecordRow): OfflineRecord<T> {
    return {
      localId: row.local_id,
      serverId: row.server_id,
      data: JSON.parse(row.data) as T,
      syncStatus: row.sync_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private getRow(localId: string): RecordRow | null {
    return this.db.getFirstSync<RecordRow>("SELECT * FROM local_records WHERE entity = ? AND local_id = ?", this.entity, localId)
  }

  private notify() {
    dataChanged.emit(this.entity)
  }

  /* ------------------------------------ Lecture ------------------------------------ */

  /** Tous les éléments visibles (hors suppressions locales), du plus ancien au plus récent. */
  getAll(): OfflineRecord<T>[] {
    return this.db
      .getAllSync<RecordRow>(
        "SELECT * FROM local_records WHERE entity = ? AND deleted_at IS NULL ORDER BY created_at ASC, rowid ASC",
        this.entity
      )
      .map((row) => this.toRecord(row))
  }

  getByLocalId(localId: string): OfflineRecord<T> | null {
    const row = this.getRow(localId)
    return row && row.deleted_at == null ? this.toRecord(row) : null
  }

  getByServerId(serverId: string | number): OfflineRecord<T> | null {
    const row = this.db.getFirstSync<RecordRow>(
      "SELECT * FROM local_records WHERE entity = ? AND server_id = ? AND deleted_at IS NULL",
      this.entity,
      String(serverId)
    )
    return row ? this.toRecord(row) : null
  }

  /** Éléments supprimés localement dont la suppression n'est pas encore confirmée par un téléchargement. */
  getDeleted(): OfflineRecord<T>[] {
    return this.db
      .getAllSync<RecordRow>("SELECT * FROM local_records WHERE entity = ? AND deleted_at IS NOT NULL", this.entity)
      .map((row) => this.toRecord(row))
  }

  count(): number {
    return this.db.getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM local_records WHERE entity = ? AND deleted_at IS NULL", this.entity)?.n ?? 0
  }

  /* ------------------------------------ Écriture ------------------------------------ */

  /** Crée l'élément localement (en attente d'envoi) et ajoute un CREATE à la file. */
  create(data: T): OfflineRecord<T> {
    const localId = Crypto.randomUUID()
    const now = Date.now()
    this.db.withTransactionSync(() => {
      this.db.runSync(
        `INSERT INTO local_records (entity, local_id, server_id, data, sync_status, created_at, updated_at)
         VALUES (?, ?, NULL, ?, 'pending', ?, ?)`,
        this.entity,
        localId,
        JSON.stringify(data),
        now,
        now
      )
      syncQueueService.enqueue({ entity: this.entity, operation: "CREATE", entityLocalId: localId, payload: data })
    })
    this.notify()
    return { localId, serverId: null, data, syncStatus: "pending", createdAt: now, updatedAt: now }
  }

  /**
   * Modifie l'élément localement.
   * - Jamais envoyé : on réécrit le contenu du CREATE en attente (le serveur ne le connaît pas encore).
   * - Déjà sur le serveur : on ajoute un UPDATE (ou on remplace celui qui attend déjà).
   */
  update(localId: string, changes: Partial<T>): OfflineRecord<T> {
    const row = this.getRow(localId)
    if (!row || row.deleted_at != null) throw new Error(`[${this.entity}] élément introuvable : ${localId}`)
    const merged = { ...(JSON.parse(row.data) as T), ...changes }
    const now = Date.now()

    this.db.withTransactionSync(() => {
      this.db.runSync(
        "UPDATE local_records SET data = ?, sync_status = 'pending', updated_at = ? WHERE entity = ? AND local_id = ?",
        JSON.stringify(merged),
        now,
        this.entity,
        localId
      )
      // Chaque UPDATE porte le contenu complet : la dernière version suffit. Les anciens UPDATE
      // (en attente ou en échec) ne doivent jamais repartir après celle-ci.
      const ops = syncQueueService.getAllForRecord(this.entity, localId)
      const create = ops.find((op) => op.operation === "CREATE")

      if (row.server_id == null && create?.status !== "processing") {
        // Le serveur ne connaît pas l'élément : tout le contenu va dans le CREATE.
        syncQueueService.removeOps(this.entity, localId, "UPDATE")
        if (create?.status === "pending" && syncQueueService.updatePayload(create.id, merged)) return
        // Modifié après un échec : on retente avec le nouveau contenu, à sa place dans la file.
        if (create?.status === "failed" && syncQueueService.reviveWithPayload(create.id, merged)) return
        // Aucun CREATE (cas anormal) : on le recrée pour ne rien perdre.
        syncQueueService.enqueue({ entity: this.entity, operation: "CREATE", entityLocalId: localId, payload: merged })
        return
      }

      // Déjà sur le serveur, ou CREATE en cours d'envoi : un UPDATE suivra (il lira l'identifiant
      // serveur au moment de partir). Un UPDATE en attente est réutilisé, les UPDATE en échec effacés.
      const pendingUpdate = ops.find((op) => op.operation === "UPDATE" && op.status === "pending")
      for (const op of ops) if (op.operation === "UPDATE" && op.status === "failed") syncQueueService.remove(op.id)
      if (pendingUpdate && syncQueueService.updatePayload(pendingUpdate.id, merged)) return
      syncQueueService.enqueue({ entity: this.entity, operation: "UPDATE", entityLocalId: localId, payload: merged })
    })

    this.notify()
    return { ...this.toRecord(row), data: merged, syncStatus: "pending", updatedAt: now }
  }

  /**
   * Supprime l'élément.
   * - Jamais envoyé : suppression locale et annulation de ses opérations ; le serveur n'en entend jamais parler.
   * - Déjà sur le serveur : suppression « douce » (deletedAt) + DELETE. La ligne reste pour qu'un
   *   téléchargement ne la fasse pas réapparaître.
   */
  remove(localId: string, payload?: unknown): void {
    const row = this.getRow(localId)
    if (!row || row.deleted_at != null) return
    const now = Date.now()

    this.db.withTransactionSync(() => {
      const ops = syncQueueService.getActiveForRecord(this.entity, localId)
      const createInFlight = ops.some((op) => op.operation === "CREATE" && op.status === "processing")

      if (row.server_id == null && !createInFlight) {
        syncQueueService.cancelForRecord(this.entity, localId)
        this.db.runSync("DELETE FROM local_records WHERE entity = ? AND local_id = ?", this.entity, localId)
        return
      }

      this.db.runSync(
        "UPDATE local_records SET deleted_at = ?, sync_status = 'pending', updated_at = ? WHERE entity = ? AND local_id = ?",
        now,
        now,
        this.entity,
        localId
      )
      // Les UPDATE pas encore partis (ou en échec) deviennent inutiles.
      syncQueueService.removeOps(this.entity, localId, "UPDATE")
      // `payload` : informations jointes (ex. motif d'annulation), transmises au handler `remove`.
      syncQueueService.enqueue({ entity: this.entity, operation: "DELETE", entityLocalId: localId, payload })
    })

    this.notify()
  }

  /* ------------------------------ Données venant du serveur ------------------------------ */

  /**
   * Range dans SQLite les éléments renvoyés par le serveur.
   * La version locale est conservée si elle est encore en attente d'envoi (ou en échec), si elle
   * vient d'être envoyée (< 30 s), si elle a été supprimée localement, ou si la réponse du serveur
   * est plus ancienne que la version déjà connue.
   *
   * `fullReplace` : la liste est complète ; les éléments synchronisés absents côté serveur sont effacés.
   */
  syncFromServer(items: RemoteRecord<T>[], { fullReplace = false } = {}): void {
    const now = Date.now()
    const seen = new Set<string>()

    this.db.withTransactionSync(() => {
      for (const item of items) {
        const serverId = String(item.serverId)
        seen.add(serverId)
        const remoteUpdatedAt = toMillis(item.updatedAt)
        const local = this.db.getFirstSync<RecordRow>(
          "SELECT * FROM local_records WHERE entity = ? AND server_id = ?",
          this.entity,
          serverId
        )

        if (!local) {
          this.db.runSync(
            `INSERT INTO local_records (entity, local_id, server_id, data, sync_status, created_at, updated_at, server_updated_at)
             VALUES (?, ?, ?, ?, 'synced', ?, ?, ?)`,
            this.entity,
            Crypto.randomUUID(),
            serverId,
            JSON.stringify(item.data),
            remoteUpdatedAt ?? now,
            now,
            remoteUpdatedAt
          )
          continue
        }

        const keepLocal =
          local.sync_status !== "synced" ||
          local.deleted_at != null ||
          (local.last_pushed_at != null && now - local.last_pushed_at < RECENT_PUSH_MS) ||
          (remoteUpdatedAt != null && local.server_updated_at != null && remoteUpdatedAt < local.server_updated_at) ||
          syncQueueService.hasOtherOpenOps(this.entity, local.local_id)
        if (keepLocal) continue

        this.db.runSync(
          "UPDATE local_records SET data = ?, server_updated_at = ?, updated_at = ? WHERE entity = ? AND local_id = ?",
          JSON.stringify(item.data),
          remoteUpdatedAt ?? local.server_updated_at,
          now,
          this.entity,
          local.local_id
        )
      }

      if (fullReplace) {
        const candidates = this.db.getAllSync<RecordRow>(
          "SELECT * FROM local_records WHERE entity = ? AND server_id IS NOT NULL AND sync_status = 'synced'",
          this.entity
        )
        for (const row of candidates) {
          if (seen.has(row.server_id!)) continue
          if (row.last_pushed_at != null && now - row.last_pushed_at < RECENT_PUSH_MS) continue
          if (syncQueueService.hasOtherOpenOps(this.entity, row.local_id)) continue
          this.db.runSync("DELETE FROM local_records WHERE entity = ? AND local_id = ?", this.entity, row.local_id)
        }
      }
    })

    this.notify()
  }

  /* -------------------- Résultats d'envoi (appelés par le syncManager uniquement) -------------------- */

  /** Identifiant serveur actuel (lu au moment de l'envoi, pas de la mise en file). */
  getServerIdForPush(localId: string): string | null {
    return this.getRow(localId)?.server_id ?? null
  }

  /** Statut après une opération : synced seulement s'il ne reste rien à envoyer pour l'élément. */
  private settledStatus(localId: string, completedQueueId: number): RecordSyncStatus {
    const others = this.db.getAllSync<{ status: string }>(
      "SELECT status FROM sync_queue WHERE entity = ? AND entity_local_id = ? AND id != ?",
      this.entity,
      localId,
      completedQueueId
    )
    if (others.length === 0) return "synced"
    return others.some((o) => o.status === "failed") ? "failed" : "pending"
  }

  /** CREATE accepté : on mémorise l'identifiant serveur (et la version serveur s'il n'y a pas de modification plus récente). */
  applyCreateResult(localId: string, remote: RemoteRecord<T>, queueId: number) {
    const serverId = String(remote.serverId)
    const now = Date.now()
    this.db.withTransactionSync(() => {
      // Un téléchargement fait pendant l'envoi a pu ranger cet élément sous une autre ligne (que
      // l'utilisateur a pu modifier ou supprimer entre-temps). On la fusionne dans celle-ci :
      // ses opérations, ses données modifiées et sa suppression sont reportées, rien n'est perdu.
      const duplicate = this.db.getFirstSync<RecordRow>(
        "SELECT * FROM local_records WHERE entity = ? AND server_id = ? AND local_id != ?",
        this.entity,
        serverId,
        localId
      )
      if (duplicate) {
        const movedOps = this.db.runSync(
          "UPDATE sync_queue SET entity_local_id = ? WHERE entity = ? AND entity_local_id = ?",
          localId,
          this.entity,
          duplicate.local_id
        ).changes
        this.db.runSync("DELETE FROM local_records WHERE entity = ? AND local_id = ?", this.entity, duplicate.local_id)
        // Suppression du doublon encore en attente : elle est reportée. Déjà acceptée par le serveur
        // (ex. désinscription puis réinscription, même identifiant composite) : ce CREATE est plus récent.
        if (duplicate.deleted_at != null && (movedOps > 0 || duplicate.sync_status !== "synced")) {
          this.db.runSync("UPDATE local_records SET deleted_at = ? WHERE entity = ? AND local_id = ?", duplicate.deleted_at, this.entity, localId)
        }
        if (movedOps > 0 || duplicate.sync_status !== "synced") {
          // Modifiée par l'utilisateur après le téléchargement : c'est la version la plus récente.
          this.db.runSync("UPDATE local_records SET data = ? WHERE entity = ? AND local_id = ?", duplicate.data, this.entity, localId)
        }
      }

      // Statut calculé après la fusion (les opérations reportées comptent).
      const status = this.settledStatus(localId, queueId)
      const replaceData = status === "synced" && this.getRow(localId)?.deleted_at == null
      this.db.runSync(
        `UPDATE local_records
           SET server_id = ?, sync_status = ?, last_pushed_at = ?, server_updated_at = ?,
               data = CASE WHEN ? THEN ? ELSE data END
         WHERE entity = ? AND local_id = ?`,
        serverId,
        status,
        now,
        toMillis(remote.updatedAt),
        replaceData ? 1 : 0,
        JSON.stringify(remote.data),
        this.entity,
        localId
      )
    })
    this.notify()
  }

  /**
   * Repli minimal si applyCreateResult échoue : enregistre au moins l'identifiant serveur, pour que
   * l'élément ne soit jamais recréé (doublon) et que ses UPDATE / DELETE trouvent leur cible.
   */
  setServerIdOnly(localId: string, serverId: string | number) {
    this.db.runSync(
      "UPDATE local_records SET server_id = ?, last_pushed_at = ? WHERE entity = ? AND local_id = ? AND server_id IS NULL",
      String(serverId),
      Date.now(),
      this.entity,
      localId
    )
    this.notify()
  }

  /** Efface l'élément et toutes ses opérations (suppression d'un élément que le serveur n'a jamais accepté). */
  purgeLocal(localId: string) {
    this.db.withTransactionSync(() => {
      this.db.runSync("DELETE FROM sync_queue WHERE entity = ? AND entity_local_id = ? AND status != 'processing'", this.entity, localId)
      this.db.runSync("DELETE FROM local_records WHERE entity = ? AND local_id = ?", this.entity, localId)
    })
    this.notify()
  }

  /** UPDATE accepté. `remote` facultatif : certaines API ne renvoient rien. */
  applyUpdateResult(localId: string, remote: RemoteRecord<T> | null, queueId: number) {
    const status = this.settledStatus(localId, queueId)
    const now = Date.now()
    if (remote && status === "synced") {
      this.db.runSync(
        "UPDATE local_records SET sync_status = ?, last_pushed_at = ?, data = ?, server_updated_at = COALESCE(?, server_updated_at) WHERE entity = ? AND local_id = ?",
        status,
        now,
        JSON.stringify(remote.data),
        toMillis(remote.updatedAt),
        this.entity,
        localId
      )
    } else {
      this.db.runSync("UPDATE local_records SET sync_status = ?, last_pushed_at = ? WHERE entity = ? AND local_id = ?", status, now, this.entity, localId)
    }
    this.notify()
  }

  /** DELETE accepté : la ligne reste marquée supprimée ; un téléchargement complet la nettoiera. */
  applyDeleteResult(localId: string, queueId: number) {
    this.db.runSync(
      "UPDATE local_records SET sync_status = ?, last_pushed_at = ? WHERE entity = ? AND local_id = ?",
      this.settledStatus(localId, queueId),
      Date.now(),
      this.entity,
      localId
    )
    this.notify()
  }

  /**
   * Une opération de l'élément vient de passer en échec définitif. Une suppression refusée par le
   * serveur (ex. événement avec des paiements) fait réapparaître l'élément : il existe toujours.
   */
  markSyncFailed(localId: string, operation?: "CREATE" | "UPDATE" | "DELETE") {
    if (operation === "DELETE") {
      this.db.withTransactionSync(() => {
        this.db.runSync(
          "DELETE FROM sync_queue WHERE entity = ? AND entity_local_id = ? AND operation = 'DELETE' AND status = 'failed'",
          this.entity,
          localId
        )
        this.db.runSync(
          "UPDATE local_records SET deleted_at = NULL, sync_status = ? WHERE entity = ? AND local_id = ?",
          this.settledStatusAfterRestore(localId),
          this.entity,
          localId
        )
      })
    } else {
      this.db.runSync("UPDATE local_records SET sync_status = 'failed' WHERE entity = ? AND local_id = ?", this.entity, localId)
    }
    this.notify()
  }

  private settledStatusAfterRestore(localId: string): RecordSyncStatus {
    const others = this.db.getAllSync<{ status: string }>(
      "SELECT status FROM sync_queue WHERE entity = ? AND entity_local_id = ?",
      this.entity,
      localId
    )
    if (others.length === 0) return "synced"
    return others.some((o) => o.status === "failed") ? "failed" : "pending"
  }

  /** Une opération en échec a été relancée : l'élément repasse en attente. */
  markSyncPending(localId: string) {
    this.db.runSync("UPDATE local_records SET sync_status = 'pending' WHERE entity = ? AND local_id = ? AND sync_status = 'failed'", this.entity, localId)
    this.notify()
  }
}
