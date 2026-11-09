// Panneau des notifications : liste (non lues en premier plan), « Tout marquer comme lu ».
// Toucher une notification la marque lue et ouvre l'écran concerné.

import { router, type Href } from "expo-router"
import { CheckCheck } from "lucide-react-native"
import { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { colors } from "../../constants/theme"
import { useSheet } from "../../context/SheetContext"
import {
  fetchNotifications,
  marquerNotificationLue,
  toutMarquerNotificationsLues,
  type NotificationEspace,
  type NotificationsReponse,
} from "../../lib/api"
import { syncManager } from "../../lib/offline"
import { ecranDeNotification } from "../../lib/push"
import { cx, Muted, SheetTitle } from "../ui"

/** « à l'instant », « il y a 5 min », « il y a 3 h », « hier », puis la date. */
function ilYa(iso: string) {
  const secondes = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (secondes < 60) return "à l'instant"
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`
  if (secondes < 172800) return "hier"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

export function NotificationsSheet({ onChange }: { /** Compteur de la cloche mis à jour. */ onChange: (r: NotificationsReponse) => void }) {
  const { closeSheet } = useSheet()
  const [donnees, setDonnees] = useState<NotificationsReponse | null>(null)
  const [erreur, setErreur] = useState(false)
  const derniere = useRef(0)

  const appliquer = useCallback(
    async (requete: () => Promise<NotificationsReponse>) => {
      const numero = ++derniere.current
      try {
        const reponse = await requete()
        if (numero !== derniere.current) return
        setDonnees(reponse)
        setErreur(false)
        onChange(reponse)
      } catch {
        if (numero === derniere.current) setErreur(true)
      }
    },
    [onChange]
  )

  useEffect(() => {
    void appliquer(fetchNotifications)
  }, [appliquer])

  function choisir(n: NotificationEspace) {
    if (!n.lue) void appliquer(() => marquerNotificationLue(n.id))
    closeSheet()
    // La notification parle de quelque chose de nouveau : on télécharge les dernières données.
    void syncManager.forceSync()
    router.push(ecranDeNotification({ type: n.type, lien: n.lien ?? undefined }) as Href)
  }

  const nonLues = donnees?.nonLues ?? 0

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1">
          <SheetTitle>Notifications</SheetTitle>
          {nonLues > 0 ? <Muted>{`${nonLues} non lue${nonLues > 1 ? "s" : ""}`}</Muted> : null}
        </View>
        {nonLues > 0 ? (
          <Pressable
            onPress={() => void appliquer(toutMarquerNotificationsLues)}
            accessibilityRole="button"
            hitSlop={8}
            className="min-h-touch flex-row items-center gap-1 active:opacity-60"
          >
            <CheckCheck size={15} color={colors.navy} strokeWidth={2} />
            <Text className="font-sans-medium text-[13px] text-navy">Tout lire</Text>
          </Pressable>
        ) : null}
      </View>

      {!donnees ? (
        <Muted className="py-10 text-center">{erreur ? "Notifications indisponibles hors connexion." : "Chargement…"}</Muted>
      ) : donnees.notifications.length === 0 ? (
        <Muted className="py-10 text-center">Aucune notification pour le moment.</Muted>
      ) : (
        <View className="overflow-hidden rounded-card border border-line bg-paper">
          {donnees.notifications.map((n, i) => (
            <Pressable
              key={n.id}
              onPress={() => choisir(n)}
              accessibilityRole="button"
              accessibilityLabel={`${n.lue ? "" : "Non lue. "}${n.titre}. ${n.message}. ${ilYa(n.createdAt)}`}
              className={cx("flex-row gap-3 px-4 py-3 active:opacity-70", i > 0 && "border-t border-line", !n.lue && "bg-primary-soft")}
            >
              <View className={cx("mt-1.5 h-2 w-2 rounded-full", n.lue ? "bg-transparent" : "bg-navy")} />
              <View className="min-w-0 flex-1">
                <Text className={cx("text-[14px] text-ink", n.lue ? "font-sans" : "font-sans-semibold")}>{n.titre}</Text>
                <Muted className="mt-0.5">{n.message}</Muted>
                <Text className="mt-1 font-sans text-[11.5px] text-ink-light">{ilYa(n.createdAt)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}
