// Surveille le réseau (NetInfo), garde un booléen `isOnline` et prévient ses abonnés
// à chaque changement (et seulement quand la valeur change).

import NetInfo, { type NetInfoState } from "@react-native-community/netinfo"

type Listener = (isOnline: boolean) => void

/**
 * En ligne = connecté ET internet joignable. `isInternetReachable` vaut null tant que
 * NetInfo ne l'a pas encore vérifié : on se fie alors à `isConnected`.
 */
function toOnline(state: NetInfoState) {
  return state.isConnected === true && state.isInternetReachable !== false
}

class NetworkMonitor {
  private online = false
  private listeners = new Set<Listener>()
  private unsubscribe: (() => void) | null = null

  get isOnline() {
    return this.online
  }

  async initialize() {
    if (this.unsubscribe) return
    this.online = toOnline(await NetInfo.fetch())
    this.unsubscribe = NetInfo.addEventListener((state) => this.update(toOnline(state)))
  }

  /** Relit l'état réel du réseau (ex. avant un envoi important). */
  async refresh() {
    this.update(toOnline(await NetInfo.fetch()))
    return this.online
  }

  /** Abonnement aux changements ; renvoie la fonction de désabonnement. */
  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private update(next: boolean) {
    if (next === this.online) return
    this.online = next
    for (const listener of this.listeners) {
      try {
        listener(next)
      } catch (e) {
        console.warn("[networkMonitor] abonné en erreur", e)
      }
    }
  }

  dispose() {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.listeners.clear()
  }
}

export const networkMonitor = new NetworkMonitor()
