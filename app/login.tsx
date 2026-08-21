import { router } from "expo-router"
import { Music2 } from "lucide-react-native"
import { Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Avatar, Field } from "../components/ui"
import { colors } from "../constants/theme"
import { useApp } from "../context/AppContext"
import { useToast } from "../context/ToastContext"

export default function LoginScreen() {
  const { chorists, roleLabels, loginAs } = useApp()
  const { toast } = useToast()

  function handleLogin(id: number, name: string) {
    loginAs(id)
    router.replace("/(tabs)")
    toast("Connecté — " + name)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 26, justifyContent: "space-between" }}>
        <View style={{ alignItems: "center", marginTop: 24 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.aubergine,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
              shadowColor: colors.aubergine,
              shadowOpacity: 0.35,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }}
          >
            <Music2 size={30} color={colors.gold} strokeWidth={1.6} />
          </View>
          <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 26, color: colors.aubergine }}>
            Cantoria
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 4, textAlign: "center" }}>
            Plateforme de gestion des chorales{"\n"}Espace :{" "}
            <Text style={{ color: colors.aubergine, fontFamily: "Inter_700Bold" }}>
              Chorale Sainte-Cécile de Yaoundé
            </Text>
          </Text>
        </View>

        <View>
          <Field label="Adresse e-mail" defaultValue="aline.mbeki@chorale.app" autoCapitalize="none" />
          <Field label="Mot de passe" defaultValue="••••••••" secureTextEntry />
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "right", marginTop: 8 }}>
            Mot de passe oublié ?
          </Text>

          <View style={{ marginTop: 22 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 15, color: colors.aubergine }}>
                Comptes de démonstration
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "rgba(46,27,51,0.25)" }} />
            </View>
            {chorists.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => handleLogin(c.id, c.name)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: colors.white,
                  borderWidth: 1.5,
                  borderColor: "rgba(46,27,51,0.1)",
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 9,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Avatar name={c.name} color={c.color} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.ink }}>{c.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    {c.roles.map((r) => roleLabels[r]).join(" · ")}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 16 }}>›</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
