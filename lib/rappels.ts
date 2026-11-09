// Rappels locaux : programmés par le téléphone lui-même, à partir des données qu'il a déjà.
// Sans serveur, sans Firebase, même hors ligne (et dans Expo Go). Seulement ce qui est
// prévisible à l'avance :
//   - la veille d'un événement auquel le membre est inscrit, à 8 h ;
//   - le 10 de chaque mois à 9 h, si la mensualité de ce mois n'est pas réglée.
// Les nouveautés (paiement, chant, dépense…) arrivent par Expo Push (lib/push.ts).
//
// Recalculés à chaque changement des données : un mois réglé ou une désinscription annule
// le rappel correspondant.

import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import type { Evenement } from "../types"

/** Préfixe des rappels de l'app : seuls ceux-là sont annulés et reprogrammés. */
const PREFIXE = "rappel:"

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

/**
 * Canal Android et autorisation (demandée une fois). Partagé avec le push.
 * Renvoie vrai si l'app peut afficher des notifications.
 */
export async function autoriserNotifications(): Promise<boolean> {
  if (Platform.OS === "web") return false
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
    return status === "granted"
  } catch {
    return false
  }
}

interface Rappel {
  id: string
  date: Date
  titre: string
  message: string
  data: { type: string; lien: string }
}

/** Les rappels voulus, d'après les données du téléphone. */
function rappelsVoulus(events: Evenement[], cartes: boolean[], annee: number, mensualite: number): Rappel[] {
  const maintenant = Date.now()
  const rappels: Rappel[] = []

  // Veille de chaque événement où le membre est inscrit, à 8 h.
  for (const ev of events) {
    if (!ev.inscrit || !ev.date) continue
    const [a, m, j] = ev.date.split("-").map(Number)
    if (!a || !m || !j) continue
    const veille = new Date(a, m - 1, j - 1, 8, 0, 0)
    if (veille.getTime() <= maintenant) continue
    rappels.push({
      id: `${PREFIXE}evenement:${ev.localId ?? ev.id}`,
      date: veille,
      titre: `Demain : ${ev.titre}`,
      message: `Rappel : vous êtes inscrit(e) à « ${ev.titre} », qui a lieu demain.`,
      data: { type: "rappel-evenement", lien: "/mon-espace" },
    })
  }

  // Le 10 de chaque mois restant de l'exercice, si la mensualité n'est pas réglée.
  if (mensualite > 0) {
    for (let mois = 0; mois < 12; mois++) {
      if (cartes[mois]) continue
      const dix = new Date(annee, mois, 10, 9, 0, 0)
      if (dix.getTime() <= maintenant) continue
      rappels.push({
        id: `${PREFIXE}cotisation:${annee}-${mois}`,
        date: dix,
        titre: `Cotisation de ${MOIS[mois]}`,
        message: `Votre cotisation statutaire de ${MOIS[mois]} ${annee} n'est pas encore réglée.`,
        data: { type: "rappel-impaye", lien: "/mon-espace" },
      })
    }
  }
  return rappels
}

/** Annule les rappels de l'app (déconnexion, ou avant de les reprogrammer). */
export async function annulerRappels() {
  if (Platform.OS === "web") return
  try {
    const programmes = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      programmes
        .filter((n) => n.identifier.startsWith(PREFIXE))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    )
  } catch {
    // Rien de programmé.
  }
}

/** Reprogramme les rappels du membre connecté d'après ses données (sans effet si refusé). */
export async function planifierRappels(params: { events: Evenement[]; cartes: boolean[]; annee: number; mensualite: number }) {
  if (!(await autoriserNotifications())) return
  const rappels = rappelsVoulus(params.events, params.cartes, params.annee, params.mensualite)
  await annulerRappels()
  for (const r of rappels) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.titre, body: r.message, data: r.data, sound: "default" },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: "default" },
      })
    } catch (e) {
      console.warn("[rappels] non programmé", r.id, e)
    }
  }
}
