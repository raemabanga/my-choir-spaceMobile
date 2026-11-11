import { router } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import React from "react"
import { Pressable, Text, View } from "react-native"
import { colors } from "../constants/theme"
import { useApp } from "../context/AppContext"
import { useResponsive } from "../lib/responsive"

/** Barre d'une page secondaire (même style que AppHeader) : bouton retour, titre, action à droite. */
export function BackHeader({ title, right, onBack }: { title: string; right?: React.ReactNode; /** Retour personnalisé (ex. de la feuille vers la liste) ; sinon page précédente. */ onBack?: () => void }) {
  const { gutter, maxWidth } = useResponsive()
  const { choraleNom } = useApp()
  return (
    <View className="border-b border-line bg-paper">
      {/* Largeur max et gouttière dépendent de la taille d'écran : en style. */}
      <View className="w-full flex-row items-center gap-1 self-center pb-3.5 pt-0.5" style={{ maxWidth, paddingHorizontal: gutter }}>
        <Pressable
          onPress={() => (onBack ? onBack() : router.back())}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={4}
          className="-ml-2.5 min-h-touch min-w-touch items-center justify-center rounded-full active:opacity-60"
        >
          <ChevronLeft size={24} color={colors.navy} strokeWidth={2} />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text accessibilityRole="header" numberOfLines={1} className="font-sans-semibold text-[20px] tracking-[-0.4px] text-ink">
            {title}
          </Text>
          <Text numberOfLines={1} className="mt-px font-sans text-[12px] text-ink-light">
            {choraleNom}
          </Text>
        </View>
        {right}
      </View>
    </View>
  )
}

/** Barre d'app (.appbar) : titre + nom de la chorale à gauche, pastille des rôles à droite. */
export function AppHeader({ title }: { title: string }) {
  const { currentUser, roleLabels, choraleNom } = useApp()
  const { gutter, maxWidth } = useResponsive()
  if (!currentUser) return null
  const roles = currentUser.roles.map((r) => roleLabels[r]).join(" · ")

  return (
    <View className="border-b border-line bg-paper">
      {/* Largeur max et gouttière dépendent de la taille d'écran : en style. */}
      <View className="w-full flex-row items-center justify-between gap-3 self-center pb-3.5 pt-0.5" style={{ maxWidth, paddingHorizontal: gutter }}>
        <View className="min-w-0 flex-1">
          <Text accessibilityRole="header" numberOfLines={1} className="font-sans-semibold text-[20px] tracking-[-0.4px] text-ink">
            {title}
          </Text>
          {/* Sur deux lignes au besoin plutôt que tronqué quand la pastille des rôles est longue. */}
          <Text numberOfLines={2} className="mt-px font-sans text-[12px] text-ink-light">
            {choraleNom}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/(tabs)/profil")}
          accessibilityRole="button"
          accessibilityLabel={`Mes rôles : ${roles}. Ouvrir le profil`}
          hitSlop={8}
          className="max-w-[50%] flex-row items-center gap-1.5 rounded-full bg-primary-soft py-1.5 pl-2.5 pr-3"
        >
          <View className="h-1.5 w-1.5 rounded-full bg-gold" />
          <Text numberOfLines={2} className="shrink font-sans-medium text-[12px] text-navy">
            {roles}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
