// Cloche de l'en-tête : pastille rouge du nombre de notifications non lues ; le toucher ouvre
// la liste dans un panneau. Équivalent mobile de components/portail/notification-bell.tsx (web).

import { useFocusEffect } from "expo-router"
import { Bell } from "lucide-react-native"
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState, Pressable, Text, View } from "react-native"
import { colors } from "../../constants/theme"
import { useSheet } from "../../context/SheetContext"
import { useSyncSummary } from "../../hooks/offline"
import { fetchNotifications, type NotificationsReponse } from "../../lib/api"
import { cx } from "../ui"
import { NotificationsSheet } from "./NotificationsSheet"

/** Relecture régulière tant que l'écran est affiché. */
const INTERVALLE_MS = 60_000

export function NotificationButton({ light }: { /** Sur fond marine. */ light?: boolean }) {
  const { openSheet } = useSheet()
  const { isOnline } = useSyncSummary()
  const [nonLues, setNonLues] = useState(0)
  // Une réponse plus ancienne n'écrase jamais une réponse plus récente.
  const derniere = useRef(0)

  const appliquer = useCallback((reponse: NotificationsReponse) => setNonLues(reponse.nonLues), [])

  const charger = useCallback(async () => {
    const numero = ++derniere.current
    try {
      const reponse = await fetchNotifications()
      if (numero === derniere.current) appliquer(reponse)
    } catch {
      // Hors ligne ou serveur arrêté : on garde le dernier compteur, sans message.
    }
  }, [appliquer])

  // À l'affichage de l'écran, toutes les minutes, au retour dans l'app et au retour du réseau.
  useFocusEffect(
    useCallback(() => {
      if (!isOnline) return
      void charger()
      const timer = setInterval(() => void charger(), INTERVALLE_MS)
      return () => clearInterval(timer)
    }, [charger, isOnline])
  )
  useEffect(() => {
    const abonnement = AppState.addEventListener("change", (etat) => etat === "active" && void charger())
    return () => abonnement.remove()
  }, [charger])

  function ouvrir() {
    derniere.current++ // La liste du panneau fait foi : une relecture en cours est ignorée.
    openSheet(<NotificationsSheet onChange={appliquer} />)
  }

  return (
    <Pressable
      onPress={ouvrir}
      accessibilityRole="button"
      accessibilityLabel={nonLues > 0 ? `Notifications : ${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Notifications"}
      hitSlop={6}
      className={cx("h-10 w-10 items-center justify-center rounded-full active:opacity-60", light ? "bg-on-navy-fill" : "bg-surface-soft")}
    >
      <Bell size={18} color={light ? colors.paper : colors.navy} strokeWidth={2} />
      {nonLues > 0 ? (
        <View
          className={cx(
            "absolute -right-1 -top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 bg-danger px-1",
            light ? "border-navy" : "border-paper"
          )}
        >
          <Text className="font-sans-semibold text-[10px] tabular-nums text-paper">{nonLues > 9 ? "9+" : nonLues}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}
