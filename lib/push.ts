// Notifications push : le téléphone reçoit les notifications de la chorale (les mêmes que la
// cloche du portail web), envoyées par le backend via le service push d'Expo.
//
// Conditions : un vrai téléphone, l'autorisation de l'utilisateur, un identifiant de projet EAS
// (app.json → extra.eas.projectId, créé par « eas init »). Sur Android, pas dans Expo Go
// (build de développement requis depuis le SDK 53). Sinon l'inscription est simplement sautée.

import Constants, { ExecutionEnvironment } from "expo-constants"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import * as api from "./api"
import { getMeta, setMeta } from "./offline"

const META_JETON = "push_token"

// Application ouverte : la notification s'affiche quand même (bannière + son).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/** Raison pour laquelle le push n'est pas disponible (null s'il l'est). */
export function pushIndisponible(): string | null {
  if (!Device.isDevice) return "Les notifications push demandent un vrai téléphone."
  if (Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return "Sur Android, les notifications push demandent un build de développement (pas Expo Go)."
  }
  if (!projectId()) return "Identifiant de projet EAS manquant : lancez « eas init »."
  return null
}

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
}

/**
 * Inscrit ce téléphone pour recevoir les notifications du membre connecté. Sans effet (et sans
 * erreur) si le push n'est pas disponible ou si l'utilisateur refuse.
 */
export async function inscrirePush() {
  const raison = pushIndisponible()
  if (raison) {
    console.info("[push] " + raison)
    return
  }
  try {
    // Android 13+ : le canal doit exister avant de demander l'autorisation.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Notifications de la chorale",
        importance: Notifications.AndroidImportance.HIGH,
      })
    }
    let { status } = await Notifications.getPermissionsAsync()
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status
    if (status !== "granted") return

    const { data: jeton } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() })
    await api.enregistrerPushToken(jeton, Platform.OS === "ios" ? "ios" : "android")
    try {
      setMeta(META_JETON, jeton)
    } catch {
      // Base hors ligne indisponible : la désinscription à la déconnexion sera sautée.
    }
  } catch (e) {
    // Hors ligne, serveur arrêté… : nouvel essai à la prochaine ouverture de session.
    console.warn("[push] inscription impossible", e)
  }
}

/**
 * Déconnexion : ce téléphone ne reçoit plus les notifications du membre.
 * `jetonSession` : jeton de la session qui se ferme (déjà effacé du téléphone).
 */
export async function desinscrirePush(jetonSession: string | null) {
  let jeton: string | null = null
  try {
    jeton = getMeta(META_JETON)
  } catch {
    return
  }
  if (!jeton) return
  if (jetonSession) await api.supprimerPushToken(jeton, jetonSession)
  try {
    setMeta(META_JETON, null)
  } catch {
    // Rien à effacer.
  }
}

/** Écran de l'application à ouvrir quand on touche une notification. */
export function ecranDeNotification(data: Record<string, unknown> | undefined): string {
  const type = typeof data?.type === "string" ? data.type : ""
  const lien = typeof data?.lien === "string" ? data.lien : ""
  const chant = lien.match(/^\/chants\/(\d+)/)
  if (chant) return `/chant/${chant[1]}`
  if (type.startsWith("paiement") || type === "rappel-impaye" || lien === "/cotisations") return "/(tabs)/cotisations"
  if (type === "inscriptions" || type === "rappel-evenement") return "/(tabs)/evenements"
  // Dépenses : pas d'écran dédié sur le mobile (elles se gèrent sur le portail web).
  return "/(tabs)"
}
