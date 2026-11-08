// Indicateurs de synchronisation, alimentés par useSyncSummary() (store useSyncStatusStore).

import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react-native"
import { Pressable, Text, View } from "react-native"
import { colors } from "../../constants/theme"
import { useSyncSummary } from "../../hooks/offline"
import { useSyncStatusStore, type RecordSyncStatus } from "../../lib/offline"
import { Pill, cx } from "../ui"

export { ConnectionRing, OfflineLabel, useConnectionRing, type ConnectionRingStatus } from "./ConnectionRing"
export { SyncButton } from "./SyncButton"

const modifications = (n: number) => `${n} modification${n > 1 ? "s" : ""} en attente`

/**
 * Bannière affichée hors ligne (« Mode hors ligne • 3 modifications en attente »)
 * ou quand des envois ont échoué (avec « Réessayer »). Rien quand tout va bien.
 */
export function OfflineBanner({ className }: { className?: string }) {
  const { ready, isOnline, pendingCount, failedCount, retryFailed } = useSyncSummary()
  const rejection = useSyncStatusStore((s) => s.rejection)
  if (!ready) return null

  // Suppression refusée par le serveur : l'élément est réapparu, on explique pourquoi.
  if (rejection) {
    return (
      <View accessibilityRole="alert" className={cx("flex-row items-center gap-2 rounded-field border border-danger bg-danger-bg px-3 py-2.5", className)}>
        <TriangleAlert size={16} color={colors.danger} strokeWidth={1.75} />
        <Text className="flex-1 font-sans text-[13px] text-danger">{rejection}</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => useSyncStatusStore.getState().set({ rejection: null })}>
          <Text className="font-sans-semibold text-[13px] text-danger">OK</Text>
        </Pressable>
      </View>
    )
  }

  if (!isOnline) {
    return (
      <View accessibilityRole="alert" className={cx("flex-row items-center gap-2 rounded-field bg-warning-bg px-3 py-2.5", className)}>
        <CloudOff size={16} color={colors.warning} strokeWidth={1.75} />
        <Text className="flex-1 font-sans-medium text-[13px] text-warning">
          Mode hors ligne{pendingCount > 0 ? " • " + modifications(pendingCount) : ""}
        </Text>
      </View>
    )
  }

  if (failedCount > 0) {
    return (
      <View accessibilityRole="alert" className={cx("flex-row items-center gap-2 rounded-field border border-danger bg-danger-bg px-3 py-2.5", className)}>
        <TriangleAlert size={16} color={colors.danger} strokeWidth={1.75} />
        <Text className="flex-1 font-sans text-[13px] text-danger">
          {failedCount} envoi{failedCount > 1 ? "s" : ""} en échec
        </Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={retryFailed}>
          <Text className="font-sans-semibold text-[13px] text-danger">Réessayer</Text>
        </Pressable>
      </View>
    )
  }

  return null
}

/** Pastille d'état global : En ligne · Synchronisation… · Hors ligne · Erreur. */
export function SyncStatusBadge() {
  const { ready, syncState } = useSyncSummary()
  if (!ready) return null
  switch (syncState) {
    case "offline":
      return <Pill variant="pending">Hors ligne</Pill>
    case "syncing":
      return <Pill variant="info">Synchronisation…</Pill>
    case "error":
      return <Pill variant="burg">Erreur de synchro</Pill>
    default:
      return <Pill variant="green">En ligne</Pill>
  }
}

/** Compteur des éléments en attente d'envoi (masqué à zéro). */
export function PendingCounter({ light }: { light?: boolean }) {
  const { pendingCount, isSyncing } = useSyncSummary()
  if (pendingCount === 0) return null
  return (
    <View accessibilityLabel={modifications(pendingCount)} className="flex-row items-center gap-1">
      <RefreshCw size={12} color={light ? colors.paper : colors.warning} strokeWidth={2} />
      <Text className={cx("font-mono text-[12px] tabular-nums", light ? "text-paper" : "text-warning")}>
        {pendingCount}
        {isSyncing ? "…" : ""}
      </Text>
    </View>
  )
}

/** État d'un élément dans une liste : rien s'il est synchronisé. */
export function RecordSyncBadge({ status }: { status: RecordSyncStatus }) {
  if (status === "pending") return <Pill variant="pending">En attente</Pill>
  if (status === "failed") return <Pill variant="burg">Non envoyé</Pill>
  return null
}
