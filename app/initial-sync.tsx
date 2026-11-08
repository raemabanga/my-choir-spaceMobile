// Premier téléchargement après la connexion : range dans SQLite toutes les entités déclarées
// hors ligne. Ensuite, le téléphone a tout ce qu'il faut pour travailler sans réseau.

import { router } from "expo-router"
import { CloudDownload } from "lucide-react-native"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Container } from "../components/layout"
import { Button, Muted, ProgressBar } from "../components/ui"
import { colors } from "../constants/theme"
import { syncManager, useSyncStatusStore, type PullResult } from "../lib/offline"

export default function InitialSyncScreen() {
  const progress = useSyncStatusStore((s) => s.initialSync)
  const ready = useSyncStatusStore((s) => s.ready)
  const [result, setResult] = useState<PullResult | null>(null)
  const [running, setRunning] = useState(false)
  const startedRef = useRef(false)

  const goHome = useCallback(() => router.replace("/(tabs)"), [])

  const run = useCallback(async () => {
    setRunning(true)
    setResult(null)
    const outcome = await syncManager.performInitialSync()
    setRunning(false)
    if (outcome.ok) goHome()
    else setResult(outcome)
  }, [goHome])

  useEffect(() => {
    // Base indisponible (mode hors ligne désactivé) : rien à télécharger.
    if (!ready) {
      goHome()
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    void run()
  }, [ready, run, goHome])

  const percent = progress.total > 0 ? (progress.done / progress.total) * 100 : 0

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <Container className="flex-1 justify-center">
        <View className="items-center">
          <CloudDownload size={40} color={colors.navy} strokeWidth={1.5} />
          <Text className="mt-4 text-center font-sans-semibold text-[20px] text-ink">Préparation du mode hors ligne</Text>
          <Muted className="mt-2 text-center">Téléchargement des données de la chorale sur ce téléphone.</Muted>
        </View>

        {running ? (
          <View className="mt-8">
            <ProgressBar percent={percent} />
            <View className="mt-2 flex-row items-center gap-2">
              <ActivityIndicator size="small" color={colors.navy} />
              <Muted>{progress.current ? `${progress.current}…` : "Connexion au serveur…"}</Muted>
            </View>
          </View>
        ) : null}

        {result && !result.ok ? (
          <View className="mt-8">
            <View className="rounded-field border border-danger bg-danger-bg px-3 py-2.5">
              {result.errors.map((e) => (
                <Text key={e.entity} className="font-sans text-[13px] text-danger">
                  {e.label} : {e.message}
                </Text>
              ))}
            </View>
            <Button title="Réessayer" block className="mt-4" onPress={run} />
            <Button title="Continuer sans" variant="ghost" block className="mt-2" onPress={goHome} />
          </View>
        ) : null}
      </Container>
    </SafeAreaView>
  )
}
