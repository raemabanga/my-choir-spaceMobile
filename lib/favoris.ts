// Chants favoris du choriste connecté, enregistrés sur le téléphone (SQLite, table sync_meta).
//
// Personnels et disponibles hors ligne. Effacés avec les autres données locales quand un autre
// membre se connecte sur ce téléphone (syncManager.setOwner).

import { useSyncExternalStore } from "react"
import { dataChanged, getMeta, setMeta } from "./offline"

const META_FAVORIS = "favoris_chants"

let favoris = new Set<string>()
let charge = false
const abonnes = new Set<() => void>()

function lire() {
  try {
    const brut = getMeta(META_FAVORIS)
    favoris = new Set(brut ? (JSON.parse(brut) as string[]) : [])
  } catch {
    favoris = new Set() // Base pas encore ouverte : aucun favori.
  }
  charge = true
}

function prevenir() {
  abonnes.forEach((a) => a())
}

// Données locales effacées (changement de membre) : les favoris aussi.
dataChanged.subscribe((entity) => {
  if (entity !== "*") return
  lire()
  prevenir()
})

function snapshot() {
  if (!charge) lire()
  return favoris
}

/** Ajoute ou retire un chant des favoris. Renvoie vrai s'il est maintenant favori. */
export function basculerFavori(cle: string): boolean {
  const suivant = new Set(snapshot())
  const estFavori = !suivant.has(cle)
  if (estFavori) suivant.add(cle)
  else suivant.delete(cle)
  favoris = suivant
  try {
    setMeta(META_FAVORIS, JSON.stringify([...suivant]))
  } catch (e) {
    console.warn("[favoris] non enregistré", e)
  }
  prevenir()
  return estFavori
}

/** Ensemble des clés de chants favoris (voir cleChant), mis à jour à chaque changement. */
export function useFavoris(): Set<string> {
  return useSyncExternalStore(
    (cb) => {
      abonnes.add(cb)
      return () => {
        abonnes.delete(cb)
      }
    },
    snapshot,
    snapshot
  )
}
