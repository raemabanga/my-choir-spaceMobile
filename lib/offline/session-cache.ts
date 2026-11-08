// Dernière session connue, gardée dans SQLite pour rouvrir l'application sans réseau.
// Ne contient aucun secret (le jeton reste dans le stockage sécurisé).

import { getMeta, isDatabaseReady, setMeta } from "./database"

const META_SESSION = "cached_session"

export function cacheSession(session: unknown) {
  if (!isDatabaseReady()) return
  try {
    setMeta(META_SESSION, JSON.stringify(session))
  } catch (e) {
    console.warn("[offline] session non mise en cache", e)
  }
}

export function readCachedSession<T>(): T | null {
  if (!isDatabaseReady()) return null
  try {
    const raw = getMeta(META_SESSION)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function clearCachedSession() {
  if (!isDatabaseReady()) return
  try {
    setMeta(META_SESSION, null)
  } catch {
    // Rien à effacer.
  }
}
