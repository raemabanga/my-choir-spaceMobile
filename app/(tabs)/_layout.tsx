import { Redirect, Tabs } from "expo-router"
import { CalendarDays, CreditCard, Home, Music2, User } from "lucide-react-native"
import { ColorValue, Text, View } from "react-native"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"

function TabLabel({ label, focused, color }: { label: string; focused: boolean; color: ColorValue }) {
  return (
    <View style={{ alignItems: "center", marginTop: -2 }}>
      <Text style={{ color, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.2 }}>{label}</Text>
      {focused ? (
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold, marginTop: 2 }} />
      ) : null}
    </View>
  )
}

export default function TabsLayout() {
  const { userId } = useApp()
  if (!userId) return <Redirect href="/login" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.aubergine,
        tabBarInactiveTintColor: colors.muted,
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 82,
          paddingTop: 8,
          backgroundColor: "rgba(246,239,227,0.96)",
          borderTopColor: "rgba(46,27,51,0.1)",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={1.7} />,
          tabBarLabel: ({ focused, color }) => <TabLabel label="Accueil" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cotisations"
        options={{
          tabBarIcon: ({ color, size }) => <CreditCard color={color} size={size} strokeWidth={1.7} />,
          tabBarLabel: ({ focused, color }) => <TabLabel label="Cotisations" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="evenements"
        options={{
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} strokeWidth={1.7} />,
          tabBarLabel: ({ focused, color }) => <TabLabel label="Événements" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chants"
        options={{
          tabBarIcon: ({ color, size }) => <Music2 color={color} size={size} strokeWidth={1.7} />,
          tabBarLabel: ({ focused, color }) => <TabLabel label="Chants" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          tabBarIcon: ({ color, size }) => <User color={color} size={size} strokeWidth={1.7} />,
          tabBarLabel: ({ focused, color }) => <TabLabel label="Profil" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  )
}
