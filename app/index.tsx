import { Redirect } from "expo-router"
import { useApp } from "../context/AppContext"
import { useSyncStatusStore } from "../lib/offline"

export default function Index() {
  const { userId, session, authReady } = useApp()
  const offlineReady = useSyncStatusStore((s) => s.ready)
  const initialSyncDone = useSyncStatusStore((s) => s.initialSyncDone)
  // Attend la relecture de la session enregistrée (évite un passage éclair par la connexion).
  if (!authReady) return null
  if (session?.doitChangerMotDePasse) return <Redirect href="/change-password" />
  // Session réelle sans premier téléchargement (app fermée pendant celui-ci) : on le reprend.
  if (session && offlineReady && !initialSyncDone) return <Redirect href="/initial-sync" />
  return <Redirect href={userId ? "/(tabs)" : "/login"} />
}
