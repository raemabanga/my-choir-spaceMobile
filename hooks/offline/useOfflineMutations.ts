// Écriture d'une entité hors ligne : le hook n'appelle pas l'API, il appelle le repository,
// qui écrit dans SQLite (en attente), ajoute l'opération à la file et lance l'envoi en arrière-plan.
// L'écran reçoit le résultat immédiatement, réseau ou pas.

import { useMutation } from "@tanstack/react-query"
import type { OfflineRecord, OfflineRepository } from "../../lib/offline"

export function useOfflineMutations<T extends object>(repository: OfflineRepository<T>) {
  const create = useMutation<OfflineRecord<T>, Error, T>({
    mutationFn: (data) => Promise.resolve().then(() => repository.create(data)),
  })
  const update = useMutation<OfflineRecord<T>, Error, { localId: string; changes: Partial<T> }>({
    mutationFn: ({ localId, changes }) => Promise.resolve().then(() => repository.update(localId, changes)),
  })
  const remove = useMutation<void, Error, string>({
    mutationFn: (localId) => Promise.resolve().then(() => repository.remove(localId)),
  })

  return {
    create: create.mutate,
    createAsync: create.mutateAsync,
    update: update.mutate,
    updateAsync: update.mutateAsync,
    remove: remove.mutate,
    removeAsync: remove.mutateAsync,
    isPending: create.isPending || update.isPending || remove.isPending,
  }
}
