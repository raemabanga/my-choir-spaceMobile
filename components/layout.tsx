import React from "react"
import { RefreshControl, ScrollView, ScrollViewProps, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { colors } from "../constants/theme"
import { useApp } from "../context/AppContext"
import { useSyncSummary } from "../hooks/offline"
import { useResponsive } from "../lib/responsive"
import { AppHeader } from "./AppHeader"
import { OfflineBanner } from "./sync"
import { cx } from "./ui"

export { useResponsive }

/** Conteneur centré à largeur maximale (évite l'étirement sur tablette). */
export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  const { maxWidth, gutter } = useResponsive()
  // Largeur max et gouttière dépendent de la taille d'écran : en style.
  return (
    <View className={cx("w-full self-center", className)} style={{ maxWidth, paddingHorizontal: gutter }}>
      {children}
    </View>
  )
}

/**
 * Écran d'onglet : barre d'app blanche et contenu défilant sur fond surface.
 * `hero` (accueil) : remplace la barre blanche par un bandeau marine qui défile avec le contenu.
 * Avec une vraie session : tirer vers le bas recharge les données de l'API.
 */
export function Screen({
  title,
  children,
  scrollProps,
  hero,
}: {
  title: string
  children: React.ReactNode
  scrollProps?: ScrollViewProps
  hero?: React.ReactNode
}) {
  const { session, syncing, syncError, refresh } = useApp()
  const { isOnline } = useSyncSummary()
  /** Tirer vers le bas : envoie les modifications hors ligne et retélécharge tout (refresh = forceSync). */
  const onRefresh = refresh
  return (
    <SafeAreaView className={hero ? "flex-1 bg-navy" : "flex-1 bg-paper"} edges={["top"]}>
      {hero ? null : <AppHeader title={title} />}
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerClassName={hero ? "pb-7" : "pb-7 pt-4"}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          session ? (
            <RefreshControl
              refreshing={syncing}
              onRefresh={onRefresh}
              tintColor={hero ? colors.paper : colors.navy}
              colors={[colors.navy]}
            />
          ) : undefined
        }
        {...scrollProps}
      >
        {hero}
        <Container>
          {session ? <OfflineBanner className="mb-3" /> : null}
          {/* Hors ligne, la bannière ci-dessus suffit : l'échec de chargement est attendu. */}
          {session && syncError && isOnline ? (
            <View className="mb-3 rounded-field border border-danger bg-danger-bg px-3 py-2.5">
              <Text className="font-sans text-[13px] text-danger">{syncError}</Text>
            </View>
          ) : null}
          {children}
        </Container>
      </ScrollView>
    </SafeAreaView>
  )
}
