import { router } from "expo-router"
import { Pressable, Text, View } from "react-native"
import { colors } from "../constants/theme"
import { useApp } from "../context/AppContext"

export function AppHeader({ title }: { title: string }) {
  const { currentUser, roleLabels } = useApp()
  if (!currentUser) return null

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 18,
        paddingTop: 6,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(46,27,51,0.08)",
        backgroundColor: colors.paper,
      }}
    >
      <View>
        <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 22, color: colors.aubergine }}>{title}</Text>
        <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 1 }}>Chorale Sainte-Cécile de Yaoundé</Text>
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)/profil")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: colors.aubergine,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 100,
          borderWidth: 1,
          borderColor: "rgba(201,162,75,0.4)",
        }}
      >
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gold }} />
        <Text style={{ color: colors.goldSoft, fontSize: 11, fontFamily: "Inter_700Bold" }} numberOfLines={1}>
          {currentUser.roles.map((r) => roleLabels[r]).join(" · ")}
        </Text>
      </Pressable>
    </View>
  )
}
