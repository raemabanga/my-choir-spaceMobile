// Écran de connexion — design system My Choir Space : carte à bandeau marine (motif de cercles) et formulaire blanc,
// puis les comptes de démonstration.
// Espacements sur une échelle régulière (multiples de 4) :
//   libellé → champ 6 · champ → champ 16 · dernier champ → bouton 24 · bloc → bloc 32 · compte → compte 8.
import { router } from "expo-router"
import { AlertCircle, Music } from "lucide-react-native"
import { useRef, useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Avatar, Button, Chevron, Field, FieldLabel, NavyCircles, PressableScale, SectionHeader, type FieldHandle } from "../components/ui"
import { colors, shadows } from "../constants/theme"
import { useApp } from "../context/AppContext"
import { useToast } from "../context/ToastContext"

/**
 * Hauteur réservée en bas du premier écran pour les comptes de démo :
 * titre de section (≈ 40 px) + premier compte (≈ 64 px) + marge, pour inviter à faire défiler.
 */
const DEMO_PEEK = 120

export default function LoginScreen() {
  const { chorists, roleLabels, loginAs, signIn } = useApp()
  const { toast } = useToast()
  const [identifiant, setIdentifiant] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(0)
  const passwordRef = useRef<FieldHandle>(null)

  /** Compte de démonstration : données locales, sans serveur. */
  function handleDemoLogin(id: number, name: string) {
    loginAs(id)
    router.replace("/(tabs)")
    toast("Mode démonstration — " + name)
  }

  /** Connexion réelle à l'API (email ou téléphone + mot de passe). */
  async function submit() {
    if (submitting) return
    if (!identifiant.trim() || !password) {
      setError("Saisissez votre email (ou téléphone) et votre mot de passe.")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const session = await signIn(identifiant.trim(), password)
      if (session.doitChangerMotDePasse) {
        router.replace("/change-password")
      } else {
        router.replace("/(tabs)")
        toast("Connecté — " + session.nom)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "La connexion a échoué. Réessayez.")
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow px-6"
          // Hauteur visible mesurée sur l'appareil (encoche et clavier compris).
          onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        >
          {/* Bloc centré horizontalement : largeur max sur tablette. */}
          <View className="w-full max-w-[460px] self-center">
            {/* Marque + formulaire : centrés verticalement dans l'écran visible (hauteur mesurée → style),
                moins DEMO_PEEK pour laisser apparaître le début des comptes de démo.
                Math.max : la hauteur vaut 0 avant la première mesure. */}
            <View className="justify-center py-8" style={{ minHeight: Math.max(0, viewportHeight - DEMO_PEEK) }}>
              {/* Carte de connexion : bandeau marine à cercles, puis formulaire blanc (même gabarit que le web). */}
              <View className="overflow-hidden rounded-sheet border border-line bg-paper" style={shadows.sheet}>
              <View className="relative overflow-hidden bg-navy px-6 pb-7 pt-6">
                <NavyCircles />
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="flex-row items-center gap-2.5">
                  <View className="h-8 w-8 items-center justify-center rounded-field bg-on-navy-fill">
                    {/* Icône lucide : couleur en prop. */}
                    <Music size={17} color={colors.luna100} strokeWidth={1.75} />
                  </View>
                  <Text className="font-sans-semibold text-[14px] text-paper">Le Cahier</Text>
                </View>
                <Text accessibilityRole="header" className="mt-9 font-sans-semibold text-[28px] tracking-[-0.6px] text-paper">
                  Bienvenue
                </Text>
                <Text className="mt-1.5 font-sans text-[13px] leading-[19px] text-luna-100">
                  Membres, finances, événements et répertoire : toute la vie de la chorale au même endroit.
                </Text>
              </View>

              {/* Formulaire */}
              <View className="px-5 pb-6 pt-5">
                <Text className="font-sans-semibold text-[20px] tracking-[-0.4px] text-ink">Connexion</Text>
                <Text className="mb-5 mt-0.5 font-sans text-[13px] text-ink-light">Accédez à l’espace de votre chorale.</Text>
                {error ? (
                  <View
                    accessibilityRole="alert"
                    className="mb-4 flex-row items-start gap-2.5 rounded-field bg-danger-bg px-3 py-2.5"
                  >
                    {/* Icône lucide : couleur en prop. */}
                    <AlertCircle size={17} color={colors.danger} />
                    <Text className="flex-1 font-sans-medium text-[13px] leading-[18px] text-danger">{error}</Text>
                  </View>
                ) : null}
                <View className="gap-4">
                  <Field
                    first
                    label="Email ou téléphone"
                    value={identifiant}
                    onChangeText={setIdentifiant}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    keyboardType="email-address"
                    placeholder="vous@exemple.com ou 6 77 12 34 56"
                    editable={!submitting}
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />

                  <View>
                    {/* Libellé et lien « Mot de passe oublié ? » sur la même ligne, comme sur le portail web. */}
                    <View className="flex-row items-center justify-between">
                      <FieldLabel first>Mot de passe</FieldLabel>
                      <Pressable
                        onPress={() => router.push({ pathname: "/forgot-password", params: { identifiant: identifiant.trim() } })}
                        accessibilityRole="button"
                        hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                        className="mb-1.5"
                      >
                        <Text className="font-sans-medium text-[13px] text-luna-500">Mot de passe oublié ?</Text>
                      </Pressable>
                    </View>
                    <Field
                      ref={passwordRef}
                      label=""
                      accessibilityLabel="Mot de passe"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password"
                      placeholder="Votre mot de passe"
                      returnKeyType="go"
                      onSubmitEditing={submit}
                      editable={!submitting}
                      right={
                        <Pressable
                          onPress={() => setShowPassword((v) => !v)}
                          accessibilityRole="button"
                          accessibilityLabel={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                          className="h-11 items-center justify-center px-3"
                        >
                          <Text className="font-sans-semibold text-[11px] uppercase tracking-[0.66px] text-luna-500">
                            {showPassword ? "Masquer" : "Afficher"}
                          </Text>
                        </Pressable>
                      }
                    />
                  </View>
                </View>

                <Button title={submitting ? "Connexion…" : "Se connecter"} block disabled={submitting} className="mt-6" onPress={submit} />
                {submitting ? <ActivityIndicator className="mt-3" color={colors.navy} accessibilityLabel="Connexion en cours" /> : null}
                <Text className="mt-5 text-center font-sans text-[12px] leading-[18px] text-ink-light">
                  Pas de compte ? Demandez-le au secrétariat de votre chorale.
                </Text>
              </View>
              </View>
            </View>

            {/* .demo-accounts : sous le premier écran, accessibles en faisant défiler. */}
            <View className="pb-10">
              <SectionHeader title="Comptes de démonstration" className="mb-1 mt-0" />
              <Text className="mb-3 font-sans text-[12px] text-ink-light">Données fictives, sans connexion au serveur.</Text>
              <View className="gap-2">
                {chorists.map((c) => {
                  const roles = c.roles.map((r) => roleLabels[r]).join(" · ")
                  return (
                    <PressableScale
                      scale={0.98}
                      key={c.id}
                      onPress={() => handleDemoLogin(c.id, c.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Mode démonstration : ${c.name}, ${roles}`}
                      className="min-h-touch flex-row items-center gap-3 rounded-row border border-line bg-paper px-3 py-3"
                    >
                      <Avatar id={c.id} name={c.name} />
                      <View className="min-w-0 flex-1 gap-0.5">
                        <Text numberOfLines={1} className="font-sans-bold text-[13px] text-ink">
                          {c.name}
                        </Text>
                        <Text numberOfLines={2} className="font-sans text-[11.5px] text-ink-light">
                          {roles}
                        </Text>
                      </View>
                      <Chevron />
                    </PressableScale>
                  )
                })}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
