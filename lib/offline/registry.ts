// Déclaration des entités disponibles hors ligne.
//
// Une entité = un repository (lecture / écriture SQLite) + un handler (appels API).
// Le syncManager ne connaît aucune entité en dur : il parcourt ce registre.

import { OfflineRepository, type RemoteRecord } from "./offline-repository"

export interface SyncHandler<T> {
  /** Libellé affiché pendant la synchronisation initiale (ex. « Répertoire »). */
  label?: string
  /** Ordre de téléchargement (croissant). Les entités dont d'autres dépendent passent en premier. */
  order?: number
  /** Télécharge la liste complète depuis l'API. Absent : entité jamais téléchargée (envoi seul). */
  pull?: () => Promise<RemoteRecord<T>[]>
  /** Envoie un élément créé hors ligne ; renvoie l'élément créé par le serveur (avec son id). */
  create?: (data: T) => Promise<RemoteRecord<T>>
  /** Envoie une modification. Peut ne rien renvoyer. */
  update?: (serverId: string, data: T) => Promise<RemoteRecord<T> | void>
  /**
   * Envoie une suppression. Une réponse 404 est considérée comme un succès.
   * `payload` : informations jointes à la suppression (ex. motif d'une annulation), voir `repository.remove`.
   */
  remove?: (serverId: string, payload: unknown) => Promise<void>
}

/**
 * À lever dans un handler quand l'envoi dépend d'un autre élément pas encore envoyé (ex. un paiement
 * pour un événement créé hors ligne). L'opération attend son tour sans compter d'essai.
 */
export class DependencyPendingError extends Error {
  constructor(message = "En attente d'un élément lié pas encore envoyé") {
    super(message)
    this.name = "DependencyPendingError"
  }
}

export interface OfflineEntity<T extends object> {
  entity: string
  repository: OfflineRepository<T>
  handler: SyncHandler<T>
}

const entities = new Map<string, OfflineEntity<object>>()

/**
 * Déclare une entité hors ligne et renvoie son repository.
 *
 * @example
 * export const noteRepository = defineOfflineEntity<Note>("notes", {
 *   label: "Notes",
 *   pull: async () => (await api.fetchNotes()).map((n) => ({ serverId: n.id, data: n, updatedAt: n.updatedAt })),
 *   create: async (data) => { const n = await api.createNote(data); return { serverId: n.id, data: n } },
 *   update: async (id, data) => { await api.updateNote(Number(id), data) },
 *   remove: (id) => api.deleteNote(Number(id)),
 * })
 */
export function defineOfflineEntity<T extends object>(entity: string, handler: SyncHandler<T>): OfflineRepository<T> {
  const existing = entities.get(entity)
  if (existing) {
    // Rechargement à chaud (Fast Refresh) : on garde le repository, on remplace le handler.
    existing.handler = handler as unknown as SyncHandler<object>
    return existing.repository as OfflineRepository<T>
  }
  const repository = new OfflineRepository<T>(entity)
  entities.set(entity, { entity, repository, handler } as unknown as OfflineEntity<object>)
  return repository
}

/** Toutes les entités déclarées. */
export function getAllOfflineEntities(): OfflineEntity<object>[] {
  return [...entities.values()]
}

export function getOfflineEntity(entity: string): OfflineEntity<object> | undefined {
  return entities.get(entity)
}

/** Entités téléchargeables, dans l'ordre de téléchargement. */
export function getPullableEntities(): OfflineEntity<object>[] {
  return [...entities.values()].filter((e) => e.handler.pull).sort((a, b) => (a.handler.order ?? 0) - (b.handler.order ?? 0))
}
