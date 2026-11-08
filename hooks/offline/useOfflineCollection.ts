// Lecture d'une entité hors ligne : lit SQLite (jamais l'API). Instantané, marche sans réseau.
// La recherche se fait en mémoire sur le téléphone.

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import type { OfflineRecord, OfflineRepository } from "../../lib/offline"
import { useSyncStatusStore } from "../../lib/offline"

/** Clés TanStack Query d'une entité : toutes commencent par son nom (invalidées ensemble). */
export const offlineKeys = {
  all: (entity: string) => [entity] as const,
  local: (entity: string) => [entity, "local"] as const,
  record: (entity: string, localId: string) => [entity, "local", localId] as const,
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()

export interface UseOfflineCollectionOptions<T> {
  /** Texte recherché (insensible à la casse et aux accents). */
  search?: string
  /** Champs dans lesquels chercher. */
  searchFields?: (data: T) => (string | number | null | undefined)[]
  /** Filtre supplémentaire. */
  filter?: (record: OfflineRecord<T>) => boolean
  /** Tri (par défaut : ordre d'arrivée). */
  sort?: (a: OfflineRecord<T>, b: OfflineRecord<T>) => number
}

export function useOfflineCollection<T extends object>(repository: OfflineRepository<T>, options: UseOfflineCollectionOptions<T> = {}) {
  const ready = useSyncStatusStore((s) => s.ready)
  const query = useQuery({
    queryKey: offlineKeys.local(repository.entity),
    queryFn: () => repository.getAll(),
    staleTime: Infinity,
    enabled: ready,
  })

  const { search, searchFields, filter, sort } = options
  const items = useMemo(() => {
    let list = query.data ?? []
    if (filter) list = list.filter(filter)
    const q = search ? normalize(search) : ""
    if (q && searchFields) {
      list = list.filter((r) => searchFields(r.data).some((v) => v != null && normalize(String(v)).includes(q)))
    }
    if (sort) list = [...list].sort(sort)
    return list
  }, [query.data, search, searchFields, filter, sort])

  return { items, isLoading: !ready || query.isLoading, error: query.error, refetch: query.refetch }
}

/** Un seul élément, par identifiant local. */
export function useOfflineRecord<T extends object>(repository: OfflineRepository<T>, localId: string | null | undefined) {
  const ready = useSyncStatusStore((s) => s.ready)
  const query = useQuery({
    queryKey: offlineKeys.record(repository.entity, localId ?? ""),
    queryFn: () => repository.getByLocalId(localId!),
    staleTime: Infinity,
    enabled: ready && !!localId,
  })
  return { record: query.data ?? null, isLoading: !ready || query.isLoading }
}
