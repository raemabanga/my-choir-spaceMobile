import { Redirect, Tabs } from "expo-router"
import { CalendarDays, CreditCard, Home, Music, User, type LucideIcon } from "lucide-react-native"
import { Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { cx } from "../../components/ui"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"

// Barre de navigation basse (.navbar) : fond blanc translucide, onglet actif navy avec point or.
function TabItem({ icon: Icon, label, focused }: { icon: LucideIcon; label: string; focused: boolean }) {
  return (
    <View className="w-[72px] items-center gap-[3px]">
      <Icon size={22} color={focused ? colors.navy : colors.inkLight} strokeWidth={1.7} />
      <Text numberOfLines={1} allowFontScaling={false} className={cx("font-sans-semibold text-[10px] tracking-[0.2px]", focused ? "text-navy" : "text-ink-light")}>
        {label}
      </Text>
      <View className={cx("-mt-px h-1 w-1 rounded-full", focused ? "bg-gold" : "bg-transparent")} />
    </View>
  )
}

const TABS: { name: string; label: string; icon: LucideIcon }[] = [
  { name: "index", label: "Accueil", icon: Home },
  { name: "cotisations", label: "Cotisations", icon: CreditCard },
  { name: "evenements", label: "Événements", icon: CalendarDays },
  { name: "chants", label: "Chants", icon: Music },
  { name: "profil", label: "Profil", icon: User },
]

export default function TabsLayout() {
  const { userId, session, authReady } = useApp()
  const insets = useSafeAreaInsets()
  if (!authReady) return null
  if (!userId) return <Redirect href="/login" />
  // Mot de passe temporaire : l'API refuse les autres routes tant qu'il n'est pas changé.
  if (session?.doitChangerMotDePasse) return <Redirect href="/change-password" />

  // Options du navigateur : objets de style attendus par React Navigation (pas de className).
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: colors.surface },
        tabBarItemStyle: { justifyContent: "center", alignItems: "center" },
        tabBarIconStyle: { width: 72, height: 44 },
        tabBarStyle: {
          height: 68 + insets.bottom,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: colors.paperTranslucent,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            tabBarAccessibilityLabel: t.label,
            tabBarIcon: ({ focused }) => <TabItem icon={t.icon} label={t.label} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  )
}
