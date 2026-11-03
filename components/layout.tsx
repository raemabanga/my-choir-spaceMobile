import React from "react"
import { ScrollView, ScrollViewProps, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useResponsive } from "../lib/responsive"
import { AppHeader } from "./AppHeader"
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

/** Écran d'onglet (.appbar + .screen) : barre d'app et contenu défilant sur fond surface. */
export function Screen({ title, children, scrollProps }: { title: string; children: React.ReactNode; scrollProps?: ScrollViewProps }) {
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
      <AppHeader title={title} />
      <ScrollView className="flex-1 bg-surface" contentContainerClassName="pb-7 pt-4" keyboardShouldPersistTaps="handled" {...scrollProps}>
        <Container>{children}</Container>
      </ScrollView>
    </SafeAreaView>
  )
}
