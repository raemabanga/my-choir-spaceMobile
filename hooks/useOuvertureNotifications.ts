// Toucher une notification push : ouvre l'écran concerné et met les données à jour.
// Marche aussi quand l'application était fermée (dernière notification touchée au démarrage).

import * as Notifications from "expo-notifications"
import { router, type Href } from "expo-router"
import { useEffect } from "react"
import { syncManager } from "../lib/offline"
import { ecranDeNotification } from "../lib/push"

/** Notifications déjà ouvertes : jamais deux fois (relance de l'écran, retour en arrière…). */
const ouvertes = new Set<string>()

/** `actif` : une session est ouverte (sinon les notifications touchées attendent la connexion). */
export function useOuvertureNotifications(actif: boolean) {
  useEffect(() => {
    if (!actif) return
    const ouvrir = (reponse: Notifications.NotificationResponse | null) => {
      if (!reponse) return
      const id = reponse.notification.request.identifier
      if (ouvertes.has(id)) return
      ouvertes.add(id)
      // La notification parle de quelque chose de nouveau : on télécharge les dernières données.
      void syncManager.forceSync()
      router.push(ecranDeNotification(reponse.notification.request.content.data) as Href)
    }
    Notifications.getLastNotificationResponseAsync()
      .then(ouvrir)
      .catch(() => {})
    const abonnement = Notifications.addNotificationResponseReceivedListener(ouvrir)
    return () => abonnement.remove()
  }, [actif])
}
