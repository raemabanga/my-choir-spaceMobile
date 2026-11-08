// Écran de connexion — design system Harmonix, en pleine page : bandeau marine (motif de cercles)
// en haut, formulaire blanc qui occupe tout le reste de l'écran.
// Espacements sur une échelle régulière (multiples de 4) :
//   libellé → champ 6 · champ → champ 16 · dernier champ → bouton 24 · bloc → bloc 32.
import { router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { AlertCircle } from "lucide-react-native"
import { useRef, useState } from "react"
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import { Button, Field, FieldLabel, NavyCircles, type FieldHandle } from "../components/ui"
import { colors } from "../constants/theme"
import { useApp } from "../context/AppContext"
import { useToast } from "../context/ToastContext"
import { syncManager } from "../lib/offline"

export default function LoginScreen() {
  const { signIn } = useApp()
  const { toast } = useToast()
  const insets = useSafeAreaInsets()
  const [identifiant, setIdentifiant] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const passwordRef = useRef<FieldHandle>(null)

  /** Connexion à l'API (email ou téléphone + mot de passe). */
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
        // Premier passage sur ce téléphone : téléchargement des données pour le mode hors ligne.
        router.replace(syncManager.isInitialSyncDone() ? "/(tabs)" : "/initial-sync")
        toast("Connecté — " + session.nom)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "La connexion a échoué. Réessayez.")
      setSubmitting(false)
    }
  }

  return (
    // Fond marine derrière la barre d'état ; le formulaire blanc couvre le reste jusqu'en bas.
    <SafeAreaView className="flex-1 bg-navy" edges={["top"]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView className="flex-1 bg-paper" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="grow" className="bg-paper" bounces={false}>
          {/* Bandeau marine : marque et accueil. */}
          <View className="relative overflow-hidden bg-navy px-6 pb-12 pt-8">
            <NavyCircles />
            <View className="w-full max-w-[460px] self-center">
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="flex-row items-center gap-3">
                <Image source={require("../assets/harmonix-icon.png")} className="h-11 w-11 rounded-tile bg-paper" resizeMode="contain" />
                <Text className="font-sans-semibold text-[22px] tracking-[-0.4px] text-paper">Harmonix</Text>
              </View>
              {/* Accroche en gros, puis la suite de la phrase en plus petit en dessous. */}
              <Text accessibilityRole="header" className="mt-8 font-sans-semibold text-[26px] leading-[32px] tracking-[-0.5px] text-paper">
                Vos cotisations, vos reçus, vos événements :
              </Text>
              <Text className="mt-2 font-sans text-[16px] leading-[20px] text-luna-100">
                tout ce qui concerne votre vie de choriste à portée de main.
              </Text>
            </View>
          </View>

          {/* Formulaire : remplit tout l'espace restant (flex-1), bords supérieurs arrondis sur le bandeau. */}
          <View
            className="relative -mt-5 flex-1 overflow-hidden rounded-t-sheet bg-paper px-6 pt-7"
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
          >
            {/* Rappel du motif du bandeau, en version pâle (sous le contenu). */}
            <NavyCircles variant="paper" />
            <View className="w-full max-w-[460px] flex-1 self-center">
              <Text className="font-sans-semibold text-[22px] tracking-[-0.4px] text-ink">Connexion</Text>
              <Text className="mb-6 mt-1 font-sans text-[13px] text-ink-light">Accédez à l’espace de votre chorale.</Text>
              {error ? (
                <View accessibilityRole="alert" className="mb-4 flex-row items-start gap-2.5 rounded-field bg-danger-bg px-3 py-2.5">
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

              {/* Poussé en bas de l'écran quand il reste de la place. */}
              <View className="flex-1" />
              <Text className="mt-8 text-center font-sans text-[12px] leading-[18px] text-ink-light">
                Pas de compte ? Demandez-le au secrétariat de votre chorale.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
