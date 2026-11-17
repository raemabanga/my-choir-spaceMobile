// Pagination côté client : les listes sont déjà en mémoire (copie hors ligne du téléphone).
// Affiche `taille` éléments par page ; revient à la page 1 quand un filtre ou la recherche change (`deps`).
// À associer au pied de liste <Pagination {...pagination} /> (components/ui.tsx).

import { useMemo, useState } from "react"

/** Nombre d'éléments par page par défaut. */
export const TAILLE_PAGE = 20

export type PaginationEtat<T> = {
  /** Page affichée (de 1 à nbPages). */
  page: number
  setPage: (page: number) => void
  /** Éléments de la page affichée. */
  pageItems: T[]
  /** Nombre total d'éléments (après filtres). */
  total: number
  nbPages: number
  taille: number
  /** Position du premier élément de la page dans la liste complète (0 pour la page 1). */
  debut: number
}

const memesDeps = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]))

export function usePagination<T>(items: T[], taille: number = TAILLE_PAGE, deps: readonly unknown[] = []): PaginationEtat<T> {
  const [pageDemandee, setPage] = useState(1)
  const [depsPrecedentes, setDepsPrecedentes] = useState(deps)

  // Filtre ou recherche modifiés : retour à la page 1 (mise à jour pendant le rendu, sans effet ni rendu intermédiaire).
  let page = pageDemandee
  if (!memesDeps(deps, depsPrecedentes)) {
    setDepsPrecedentes(deps)
    setPage(1)
    page = 1
  }

  const total = items.length
  const nbPages = Math.max(1, Math.ceil(total / taille))
  // Liste raccourcie (élément supprimé, filtre de statut) : on reste sur la dernière page existante.
  const pageCourante = Math.min(Math.max(1, page), nbPages)
  const debut = (pageCourante - 1) * taille
  const pageItems = useMemo(() => items.slice(debut, debut + taille), [items, debut, taille])

  return { page: pageCourante, setPage, pageItems, total, nbPages, taille, debut }
}
