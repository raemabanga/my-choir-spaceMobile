// Bouton de synchronisation des données : envoie les modifications en attente et retélécharge
// tout depuis le serveur. L'icône tourne pendant la synchronisation ; une pastille indique
// le nombre de modifications pas encore envoyées.

import { RefreshCw } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Pressable, Text, View } from "react-native"
import { colors } from "../../constants/theme"
import { useToast } from "../../context/ToastContext"
import { useSyncSummary } from "../../hooks/offline"
import { cx } from "../ui"

export function SyncButton({
  onSync,
  light,
}: {
  /** Rechargement complémentaire lancé en même temps (ex. données de l'écran). */
  onSync?: () => Promise<unknown> | void
  /** Sur fond marine. */
  light?: boolean
}) {
  const { ready, isOnline, isSyncing, pendingCount, forceSync } = useSyncSummary()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const spinning = busy || isSyncing

  // Rotation continue de l'icône pendant la synchronisation.
  const rotation = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!spinning) {
      rotation.stopAnimation()
      rotation.setValue(0)
      return
    }
    const loop = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [spinning, rotation])
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] })

  async function press() {
    if (spinning) return
    if (!isOnline) {
      toast("Hors connexion : vos modifications seront envoyées au retour du réseau")
      return
    }
    setBusy(true)
    try {
      const [result] = await Promise.all([ready ? forceSync() : Promise.resolve(null), onSync?.()])
      const error = result?.errors[0]
      toast(error ? "Synchronisation incomplète : " + error.message : "Données synchronisées")
    } catch (e) {
      toast(e instanceof Error ? e.message : "La synchronisation a échoué")
    } finally {
      setBusy(false)
    }
  }

  const pending = pendingCount > 0 ? `, ${pendingCount} modification${pendingCount > 1 ? "s" : ""} en attente` : ""

  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={`Synchroniser les données${pending}`}
      accessibilityState={{ busy: spinning }}
      hitSlop={6}
      className={cx("h-10 w-10 items-center justify-center rounded-full active:opacity-60", light ? "bg-on-navy-fill" : "bg-surface-soft")}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshCw size={18} color={light ? colors.paper : colors.navy} strokeWidth={2} />
      </Animated.View>
      {pendingCount > 0 ? (
        <View className="absolute -right-1 -top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1">
          <Text className="font-sans-semibold text-[10.5px] tabular-nums text-paper">{pendingCount > 99 ? "99+" : pendingCount}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}
