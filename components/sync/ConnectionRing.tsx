// Anneau d'état réseau autour d'un logo (ou d'un avatar) :
//   - connecté : anneau vert pendant 5 s (à l'ouverture et à chaque retour du réseau), puis plus rien ;
//   - hors ligne : anneau rouge tant que la connexion n'est pas revenue.

import { useEffect, useState } from "react"
import { Text, View } from "react-native"
import { useSyncSummary } from "../../hooks/offline"
import { cx } from "../ui"

export type ConnectionRingStatus = "online" | "offline" | "none"

/** Durée de l'anneau vert après une connexion. */
const ONLINE_FLASH_MS = 5000

/** État de l'anneau, d'après le réseau surveillé par le mode hors ligne. */
export function useConnectionRing(flashMs = ONLINE_FLASH_MS): ConnectionRingStatus {
  const { ready, isOnline } = useSyncSummary()
  const [status, setStatus] = useState<ConnectionRingStatus>("none")

  useEffect(() => {
    // Réseau pas encore connu (démarrage) ou mode hors ligne indisponible : pas d'anneau.
    if (!ready) return
    if (!isOnline) {
      setStatus("offline")
      return
    }
    setStatus("online")
    const timer = setTimeout(() => setStatus("none"), flashMs)
    return () => clearTimeout(timer)
  }, [ready, isOnline, flashMs])

  return status
}

const RING_CLASS: Record<ConnectionRingStatus, string> = {
  online: "border-success",
  offline: "border-danger",
  none: "border-transparent",
}

/** Entoure son contenu (rond) d'un anneau coloré selon `status`. La taille ne change jamais. */
export function ConnectionRing({ status, children }: { status: ConnectionRingStatus; children: React.ReactNode }) {
  return (
    <View
      accessible
      accessibilityLabel={status === "offline" ? "Hors connexion" : status === "online" ? "Connecté à internet" : undefined}
      className={cx("rounded-full border-[3px] p-0.5", RING_CLASS[status])}
    >
      {children}
    </View>
  )
}

/** Pastille « Hors connexion », affichée tant que l'anneau est rouge. */
export function OfflineLabel({ status, className }: { status: ConnectionRingStatus; className?: string }) {
  if (status !== "offline") return null
  return (
    <View accessibilityRole="alert" className={cx("flex-row items-center gap-1.5 self-start rounded-full bg-danger px-2.5 py-[3px]", className)}>
      <View className="h-1.5 w-1.5 rounded-full bg-paper" />
      <Text className="font-sans-medium text-[11.5px] text-paper">Hors connexion</Text>
    </View>
  )
}
