// Échange en arrière-plan entre SQLite et le serveur. Les écrans ne l'appellent presque jamais :
// ils écrivent dans SQLite via les repositories, et le syncManager envoie / télécharge.
//
//   Écran ──► Hook (useOffline…) ──► Repository ──► SQLite
//                                                     ▲
//                                                     │ en arrière-plan
//                                          syncManager ◄──► API
//
// Il ne connaît aucune entité en dur : il passe par le registre (lib/offline/registry.ts).

import { AppState, type NativeEventSubscription } from "react-native"
import { getMeta, isDatabaseReady, setMeta, wipeLocalData } from "./database"
import { dataChanged, queueChanged } from "./events"
import { networkMonitor } from "./network-monitor"
import { DependencyPendingError, getOfflineEntity, getPullableEntities } from "./registry"
import { syncQueueService, type QueueItem } from "./sync-queue.service"
import { useSyncStatusStore } from "./sync-status.store"

const META_INITIAL_SYNC = "initial_sync_done"
const META_LAST_SYNC = "last_sync_at"
const META_OWNER = "owner"
/** Attente maximale de l'envoi en cours avant d'effacer les données d'un autre utilisateur. */
const CLEAR_WAIT_MS = 5000

/** Nature d'une erreur d'API, pour décider de la suite. */
export type ErrorKind = "network" | "unauthorized" | "forbidden" | "notFound" | "client" | "server" | "dependency"

/**
 * Classement par défaut : lit `status` sur l'erreur (0 = serveur injoignable, comme l'ApiError de lib/api.ts).
 * Remplaçable avec `syncManager.configure({ classifyError })`.
 */
function defaultClassifyError(error: unknown): ErrorKind {
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : NaN
  if (status === 0) return "network"
  if (status === 401) return "unauthorized"
  if (status === 403) return "forbidden"
  if (status === 404) return "notFound"
  if (status === 408 || status === 429) return "server"
  if (status >= 400 && status < 500) return "client"
  if (error instanceof TypeError && /network/i.test(error.message)) return "network"
  return "server"
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Résultat d'un téléchargement (synchronisation initiale ou forcée). */
export interface PullResult {
  ok: boolean
  /** Entités qui n'ont pas pu être téléchargées (hors refus de droits 403, ignorés). */
  errors: { entity: string; label: string; message: string }[]
}

type ItemOutcome = "done" | "retry" | "failed" | "blocked" | "skipped" | "stop"

class StopSync extends Error {}

class SyncManager {
  private initialized = false
  private processing: Promise<void> | null = null
  private rerunRequested = false
  private pulling: Promise<PullResult> | null = null
  /** Change à chaque effacement des données locales : un envoi ou un téléchargement en cours s'arrête. */
  private epoch = 0
  /** Vrai pendant un effacement des données locales : aucun envoi ni téléchargement ne démarre. */
  private clearing = false
  /** Vrai entre une déconnexion (ou un début de connexion) et setOwner() : session en cours de changement. */
  private suspended = false
  /** Change uniquement à l'effacement des données : une réponse arrivée après ne doit rien écrire. */
  private wipeGeneration = 0
  private pushScheduled = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private unsubscribers: (() => void)[] = []
  private appStateSub: NativeEventSubscription | null = null

  private canSync: () => boolean | Promise<boolean> = () => true
  private classifyError: (error: unknown) => ErrorKind = defaultClassifyError
  private dataVersion = "1"

  /**
   * - `canSync` : vrai si une session permet d'appeler l'API (ex. jeton présent). Faux = rien n'est envoyé.
   * - `classifyError` : traduit une erreur d'API en ErrorKind.
   */
  configure(options: {
    canSync?: () => boolean | Promise<boolean>
    classifyError?: (error: unknown) => ErrorKind
    /**
     * Version des entités déclarées : la changer (nouvelle entité…) refait la synchronisation
     * initiale sur les téléphones déjà synchronisés avec une version précédente.
     */
    dataVersion?: string
  }) {
    if (options.dataVersion) this.dataVersion = options.dataVersion
    if (options.canSync) this.canSync = options.canSync
    if (options.classifyError) this.classifyError = options.classifyError
  }

  /** À appeler une fois au démarrage, après initializeDatabase() et networkMonitor.initialize(). */
  async initialize() {
    if (this.initialized) return
    this.initialized = true

    // Application fermée pendant un envoi : ces opérations repartent.
    syncQueueService.resetStuckProcessing()

    this.unsubscribers.push(
      networkMonitor.subscribe((online) => {
        this.refreshStatus()
        if (online) void this.pushToServer()
      }),
      queueChanged.subscribe(({ enqueued }) => {
        this.refreshStatus()
        if (enqueued) this.schedulePush()
      })
    )
    // Retour au premier plan : on retente l'envoi.
    this.appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void this.pushToServer()
    })

    const lastSync = getMeta(META_LAST_SYNC)
    useSyncStatusStore.getState().set({
      ready: true,
      initialSyncDone: getMeta(META_INITIAL_SYNC) === this.dataVersion,
      lastSyncAt: lastSync ? Number(lastSync) : null,
    })
    this.refreshStatus()

    if (networkMonitor.isOnline && syncQueueService.counts().pending > 0) void this.pushToServer()
  }

  isInitialSyncDone() {
    return isDatabaseReady() && getMeta(META_INITIAL_SYNC) === this.dataVersion
  }

  /* ------------------------------------- Envoi ------------------------------------- */

  /** Lance l'envoi juste après l'écriture en cours (l'écran n'attend pas). */
  schedulePush() {
    if (this.pushScheduled) return
    this.pushScheduled = true
    setTimeout(() => {
      this.pushScheduled = false
      void this.pushToServer()
    }, 0)
  }

  /** Envoie la file d'attente si le réseau et la session le permettent. Un seul envoi à la fois. */
  async pushToServer(): Promise<void> {
    if (!this.initialized || !isDatabaseReady() || this.clearing || this.suspended) return
    if (!networkMonitor.isOnline) {
      this.refreshStatus()
      return
    }
    if (this.processing) {
      // Un envoi tourne déjà : il refera un tour pour les opérations arrivées entre-temps.
      this.rerunRequested = true
      return this.processing
    }
    // Les données locales effacées ou la session changée entre-temps arrêtent tout :
    // la file de l'ancien utilisateur ne doit jamais partir avec le jeton du nouveau.
    const epoch = this.epoch
    this.processing = (async () => {
      try {
        if (!(await this.canSync()) || epoch !== this.epoch) return
        this.refreshStatus()
        do {
          this.rerunRequested = false
          await this.processQueue()
        } while (this.rerunRequested && networkMonitor.isOnline && epoch === this.epoch && !this.clearing && !this.suspended)
        if (epoch !== this.epoch) this.rerunRequested = false
      } catch (e) {
        useSyncStatusStore.getState().set({ lastError: errorMessage(e) })
      } finally {
        this.processing = null
        this.refreshStatus()
        // Arrêté par un changement de session, déjà terminé depuis (setOwner a demandé une reprise
        // pendant que cet envoi finissait) : on repart avec la nouvelle session.
        if (epoch !== this.epoch && !this.suspended && !this.clearing) this.schedulePush()
      }
    })()
    this.refreshStatus()
    return this.processing
  }

  /** Traite les opérations en attente dans l'ordre d'arrivée. */
  private async processQueue() {
    const epoch = this.epoch
    const items = syncQueueService.getPending()
    // Un élément dont une opération n'est pas passée : ses opérations suivantes attendent (ordre garanti).
    const held = new Set<string>()
    let retryLater = false
    let maxAttempts = 0

    for (const item of items) {
      if (!networkMonitor.isOnline || epoch !== this.epoch) return
      const key = item.entity + ":" + item.entityLocalId
      if (held.has(key)) continue

      const outcome = await this.processItem(item)
      if (outcome === "stop") return
      if (outcome === "retry" || outcome === "blocked" || outcome === "failed" || outcome === "skipped") held.add(key)
      if (outcome === "retry") {
        retryLater = true
        maxAttempts = Math.max(maxAttempts, item.attempts + 1)
      }
    }
    useSyncStatusStore.getState().set({ lastError: null })
    if (retryLater) this.scheduleRetry(maxAttempts)
  }

  /** Nouvel essai différé : 5 s, puis 15 s, puis 45 s… */
  private scheduleRetry(attempts: number) {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    const delay = 5000 * 3 ** Math.max(0, attempts - 1)
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.pushToServer()
    }, delay)
  }

  private async processItem(queued: QueueItem): Promise<ItemOutcome> {
    const entry = getOfflineEntity(queued.entity)
    if (!entry) {
      // Entité pas (encore) déclarée : on la laisse en file plutôt que de perdre l'opération.
      console.warn(`[syncManager] entité inconnue « ${queued.entity} » : importez sa déclaration avant syncManager.initialize().`)
      return "skipped"
    }
    if (this.suspended || this.clearing) return "stop"
    if (!syncQueueService.markProcessing(queued.id)) return "skipped"
    // Relu après la prise : le contenu a pu être réécrit juste avant.
    const item = syncQueueService.getById(queued.id)
    if (!item) return "skipped"

    const { repository: repo, handler } = entry
    const localId = item.entityLocalId
    // Données effacées pendant l'appel serveur (autre utilisateur) : la réponse ne doit rien écrire,
    // elle pourrait toucher les données du nouvel utilisateur (mêmes server_id).
    const wipeGeneration = this.wipeGeneration
    const wiped = () => wipeGeneration !== this.wipeGeneration

    const failDefinitively = (message: string): ItemOutcome => {
      syncQueueService.markFailed(item.id, message, { definitive: true })
      this.onDefinitiveFailure(repo, localId, item.operation, message)
      return "failed"
    }
    /** Pas d'identifiant serveur : l'opération dépend du CREATE de l'élément. */
    const waitForCreate = (): ItemOutcome => {
      const create = syncQueueService.getAllForRecord(item.entity, localId).find((op) => op.operation === "CREATE")
      if (create && create.status !== "failed") {
        // CREATE encore à venir ou en cours : l'opération attend son tour.
        syncQueueService.markFailed(item.id, "En attente de la création", { countAttempt: false })
        return "blocked"
      }
      if (create && item.operation === "UPDATE") {
        // CREATE abandonné : la modification est reportée dans son contenu (relancé par « Réessayer »),
        // au lieu d'attendre pour toujours.
        syncQueueService.setPayload(create.id, item.payload)
        syncQueueService.remove(item.id)
        return "skipped"
      }
      if (item.operation === "DELETE") {
        // Élément supprimé que le serveur n'a jamais accepté (ou jamais reçu) : il disparaît localement.
        syncQueueService.remove(item.id)
        repo.purgeLocal(localId)
        return "done"
      }
      return failDefinitively("Élément inconnu du serveur")
    }

    try {
      switch (item.operation) {
        case "CREATE": {
          if (!handler.create) return failDefinitively("Création non prise en charge hors ligne")
          const remote = await handler.create(item.payload as object)
          if (wiped()) return "stop"
          try {
            repo.applyCreateResult(localId, remote, item.id)
          } catch (e) {
            // Le serveur a créé l'élément : surtout ne pas renvoyer le CREATE (doublon).
            console.warn(`[syncManager] ${item.entity} créé sur le serveur, enregistrement local partiel`, e)
            try {
              repo.setServerIdOnly(localId, remote.serverId)
            } catch (e2) {
              // Écriture impossible (stockage plein…) : le CREATE reste en échec, visible, sans renvoi automatique.
              syncQueueService.markFailed(item.id, "Créé sur le serveur mais non enregistré sur le téléphone", { definitive: true })
              repo.markSyncFailed(localId)
              console.warn("[syncManager] identifiant serveur non enregistré", e2)
              return "failed"
            }
          }
          break
        }
        case "UPDATE": {
          if (!handler.update) return failDefinitively("Modification non prise en charge hors ligne")
          const serverId = repo.getServerIdForPush(localId)
          if (!serverId) return waitForCreate()
          const remote = await handler.update(serverId, item.payload as object)
          if (wiped()) return "stop"
          repo.applyUpdateResult(localId, remote ?? null, item.id)
          break
        }
        case "DELETE": {
          if (!handler.remove) return failDefinitively("Suppression non prise en charge hors ligne")
          const serverId = repo.getServerIdForPush(localId)
          if (!serverId) return waitForCreate()
          try {
            await handler.remove(serverId, item.payload)
          } catch (e) {
            // Déjà supprimé côté serveur : c'est le résultat voulu.
            if (this.classifyError(e) !== "notFound") throw e
          }
          if (wiped()) return "stop"
          repo.applyDeleteResult(localId, item.id)
          break
        }
      }
      syncQueueService.markCompleted(item.id)
      return "done"
    } catch (e) {
      if (wiped()) return "stop"
      if (e instanceof DependencyPendingError) {
        // Élément lié pas encore envoyé (ex. événement créé hors ligne) : attente sans essai compté.
        syncQueueService.markFailed(item.id, e.message, { countAttempt: false })
        return "blocked"
      }
      const kind = this.classifyError(e)
      const message = errorMessage(e)
      if (kind === "network" || kind === "unauthorized") {
        // Ni l'opération ni le serveur ne sont en cause : on s'arrête sans compter d'essai.
        syncQueueService.markFailed(item.id, message, { countAttempt: false })
        if (kind === "network") void networkMonitor.refresh()
        useSyncStatusStore.getState().set({ lastError: message })
        return "stop"
      }
      // Erreur 4xx (données refusées, droits…) : réessayer ne changera rien.
      const definitive = kind === "client" || kind === "forbidden" || kind === "notFound"
      const status = syncQueueService.markFailed(item.id, message, { definitive })
      if (status === "failed") {
        this.onDefinitiveFailure(repo, localId, item.operation, message)
        return "failed"
      }
      return "retry"
    }
  }

  /** Échec définitif : élément marqué « non envoyé » ; une suppression refusée le fait réapparaître. */
  private onDefinitiveFailure(
    repo: { markSyncFailed: (localId: string, operation?: QueueItem["operation"]) => void },
    localId: string,
    operation: QueueItem["operation"],
    message: string
  ) {
    repo.markSyncFailed(localId, operation)
    // Suppression refusée : l'élément réapparaît ; le message reste jusqu'à ce que l'utilisateur le ferme.
    if (operation === "DELETE") useSyncStatusStore.getState().set({ rejection: "Suppression refusée par le serveur : " + message })
  }

  /** Relance les opérations abandonnées (ex. bouton « Réessayer »). */
  retryFailed() {
    const failed = syncQueueService.getFailed()
    syncQueueService.retryFailed()
    for (const op of failed) getOfflineEntity(op.entity)?.repository.markSyncPending(op.entityLocalId)
    this.refreshStatus()
    void this.pushToServer()
  }

  /** Opérations abandonnées, pour un éventuel écran de diagnostic. */
  getFailedOperations() {
    return syncQueueService.getFailed()
  }

  /* ---------------------------------- Téléchargement ---------------------------------- */

  /**
   * Télécharge chaque entité déclarée (ou seulement `only`), l'une après l'autre, et la range dans SQLite.
   * Un téléchargement déjà en cours est réutilisé.
   */
  private pullAll(onProgress?: (label: string, done: number, total: number) => void, only?: string[]): Promise<PullResult> {
    if (this.pulling) return this.pulling
    if (this.clearing || this.suspended) return Promise.resolve({ ok: false, errors: [{ entity: "*", label: "Synchronisation", message: "Données locales en cours d'effacement" }] })
    this.pulling = (async () => {
      const epoch = this.epoch
      const list = getPullableEntities().filter((e) => !only || only.includes(e.entity))
      const errors: PullResult["errors"] = []
      try {
        for (const [index, { entity, repository, handler }] of list.entries()) {
          const label = handler.label ?? entity
          onProgress?.(label, index, list.length)
          try {
            const remote = await handler.pull!()
            // Données effacées entre-temps (changement d'utilisateur) : la réponse ne doit pas être rangée.
            if (epoch !== this.epoch) throw new StopSync("Synchronisation interrompue")
            repository.syncFromServer(remote, { fullReplace: true })
          } catch (e) {
            if (e instanceof StopSync) throw e
            const kind = this.classifyError(e)
            if (kind === "forbidden") {
              // Rôle sans accès à ces données (ou accès perdu) : rien ne doit en rester sur le
              // téléphone (ex. comptes et mots de passe temporaires après la fin d'un mandat).
              if (epoch === this.epoch) repository.syncFromServer([], { fullReplace: true })
              continue
            }
            if (kind === "network" || kind === "unauthorized") throw new StopSync(errorMessage(e))
            errors.push({ entity, label, message: errorMessage(e) })
          }
        }
        onProgress?.("", list.length, list.length)
      } catch (e) {
        if (!(e instanceof StopSync)) throw e
        errors.push({ entity: "*", label: "Connexion", message: e.message })
      }
      const ok = errors.length === 0
      if (ok && !only) {
        const now = Date.now()
        setMeta(META_LAST_SYNC, String(now))
        useSyncStatusStore.getState().set({ lastSyncAt: now, lastError: null })
      } else if (!ok) {
        useSyncStatusStore.getState().set({ lastError: errors[0].message })
      }
      dataChanged.emit("*")
      return { ok, errors }
    })().finally(() => {
      this.pulling = null
      this.refreshStatus()
    })
    this.refreshStatus()
    return this.pulling
  }

  /**
   * Premier téléchargement après la connexion (écran initial-sync). Envoie d'abord ce qui
   * attend, puis télécharge tout. Une fois réussi, le téléphone peut travailler sans réseau.
   */
  async performInitialSync(): Promise<PullResult> {
    const store = useSyncStatusStore.getState()
    if (!(await networkMonitor.refresh())) {
      return { ok: false, errors: [{ entity: "*", label: "Connexion", message: "Pas de connexion internet." }] }
    }
    await this.pushToServer()
    const result = await this.pullAll((current, done, total) => store.set({ initialSync: { current: current || null, done, total } }))
    if (result.ok) {
      setMeta(META_INITIAL_SYNC, this.dataVersion)
      store.set({ initialSyncDone: true })
    }
    store.set({ initialSync: { current: null, done: 0, total: 0 } })
    return result
  }

  /** Tirer pour rafraîchir : envoie la file puis retélécharge tout depuis le serveur. */
  async forceSync(): Promise<PullResult> {
    if (!isDatabaseReady()) return { ok: false, errors: [] }
    if (!(await networkMonitor.refresh())) {
      this.refreshStatus()
      return { ok: false, errors: [{ entity: "*", label: "Connexion", message: "Pas de connexion internet." }] }
    }
    if (!(await this.canSync())) return { ok: false, errors: [] }
    await this.pushToServer()
    return this.pullAll()
  }

  /** Retélécharge une seule entité (ex. écran « Comptes » tiré vers le bas). Sans réseau : rien. */
  async refreshEntity(entity: string): Promise<PullResult> {
    if (!isDatabaseReady()) return { ok: false, errors: [] }
    if (!(await networkMonitor.refresh())) {
      this.refreshStatus()
      return { ok: false, errors: [{ entity: "*", label: "Connexion", message: "Pas de connexion internet." }] }
    }
    if (!(await this.canSync())) return { ok: false, errors: [] }
    return this.pullAll(undefined, [entity])
  }

  /* ------------------------------------ Utilisateur ------------------------------------ */

  /**
   * À appeler à l'ouverture d'une session. Si un autre utilisateur se connecte sur ce téléphone,
   * les données locales (et les opérations en attente) du précédent sont effacées : elles ne
   * doivent ni s'afficher, ni partir avec le jeton du nouvel utilisateur.
   */
  async setOwner(ownerId: string) {
    if (!isDatabaseReady()) {
      this.suspended = false
      return
    }
    try {
      const previous = getMeta(META_OWNER)
      if (previous !== null && previous !== ownerId) {
        // Effet immédiat (avant toute attente) : l'envoi en cours s'arrête et la synchronisation
        // initiale est à refaire, même si l'écran de connexion vérifie tout de suite.
        this.epoch++
        setMeta(META_INITIAL_SYNC, null)
        useSyncStatusStore.getState().set({ initialSyncDone: false })
        await this.clearLocalData()
      }
      setMeta(META_OWNER, ownerId)
    } finally {
      // La session est établie : l'envoi peut reprendre.
      this.suspended = false
    }
    void this.pushToServer()
  }

  /**
   * Coupe la synchronisation AVANT que le jeton change (déconnexion, début de connexion) :
   * aucune opération ne part plus jusqu'au prochain setOwner(). Les opérations restent en file.
   */
  suspend() {
    this.suspended = true
    this.epoch++
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.rerunRequested = false
  }

  /** Efface toutes les données locales, file d'attente comprise. */
  async clearLocalData() {
    if (!isDatabaseReady()) return
    // Avant toute attente : plus aucun envoi, téléchargement ni nouvel essai ne peut démarrer.
    this.clearing = true
    this.epoch++
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    try {
      // Attente bornée : une requête qui pend (fetch sans délai d'expiration) ne doit pas bloquer
      // la connexion. Sans risque : l'epoch a changé, l'envoi en cours ne lancera rien d'autre.
      const settle = (p: Promise<unknown> | null) =>
        p ? Promise.race([p.catch(() => {}), new Promise((resolve) => setTimeout(resolve, CLEAR_WAIT_MS))]) : null
      await settle(this.processing)
      await settle(this.pulling)
      this.wipeGeneration++
      wipeLocalData()
    } finally {
      this.clearing = false
    }
    useSyncStatusStore.getState().set({ initialSyncDone: false, lastSyncAt: null, lastError: null, rejection: null })
    dataChanged.emit("*")
    this.refreshStatus()
  }

  /* --------------------------------------- État --------------------------------------- */

  refreshStatus() {
    if (!isDatabaseReady()) return
    const { pending, failed } = syncQueueService.counts()
    const isOnline = networkMonitor.isOnline
    const store = useSyncStatusStore.getState()
    const syncState = !isOnline
      ? "offline"
      : this.processing || this.pulling
        ? "syncing"
        : failed > 0 || store.lastError
          ? "error"
          : "idle"
    store.set({ isOnline, pendingCount: pending, failedCount: failed, syncState })
  }

  dispose() {
    this.unsubscribers.forEach((u) => u())
    this.unsubscribers = []
    this.appStateSub?.remove()
    this.appStateSub = null
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.initialized = false
  }
}

export const syncManager = new SyncManager()
