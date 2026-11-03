// Mot de passe oublié, en deux étapes (comme le portail web) :
// 1. l'API envoie un code à 6 chiffres sur l'email du compte ; 2. code + nouveau mot de passe.
import { router, useLocalSearchParams } from "expo-router"
import { KeyRound } from "lucide-react-native"
import { useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Button, Field } from "../components/ui"
import { colors, shadows } from "../constants/theme"
import { useToast } from "../context/ToastContext"
import * as api from "../lib/api"

const MIN_LENGTH = 8

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ identifiant?: string }>()
  const { toast } = useToast()
  const [step, setStep] = useState<"demande" | "code">("demande")
  const [identifiant, setIdentifiant] = useState(params.identifiant ?? "")
  const [code, setCode] = useState("")
  const [next, setNext] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'opération a échoué. Réessayez.")
    } finally {
      setBusy(false)
    }
  }

  const demanderCode = () => {
    if (!identifiant.trim()) return setError("Saisissez l'email ou le téléphone de votre compte.")
    void run(async () => {
      await api.requestPasswordReset(identifiant.trim())
      setStep("code")
    })
  }

  const enregistrer = () => {
    if (!/^\d{6}$/.test(code.trim())) return setError("Le code reçu par email contient 6 chiffres.")
    if (next.length < MIN_LENGTH) return setError(`Le nouveau mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`)
    void run(async () => {
      await api.resetPassword(identifiant.trim(), code.trim(), next)
      toast("Mot de passe modifié — connectez-vous")
      router.back()
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="grow justify-center px-6 py-10">
          <View className="w-full max-w-[460px] gap-8 self-center">
            <View className="items-center">
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-navy"
                // Ombre teintée navy : non exprimable en classe.
                style={shadows.mark}
              >
                {/* Icône lucide : couleur en prop. */}
                <KeyRound size={28} color={colors.gold} strokeWidth={1.6} />
              </View>
              <Text accessibilityRole="header" className="text-center font-sans-semibold text-[22px] tracking-[-0.2px] text-navy">
                Mot de passe oublié
              </Text>
              <Text className="mt-1.5 text-center font-sans text-[13px] leading-[19px] text-ink-light">
                {step === "demande"
                  ? "Nous allons vous envoyer un code par email pour choisir un nouveau mot de passe."
                  : "Si ce compte existe, un code à 6 chiffres vient d'être envoyé sur son adresse email."}
              </Text>
            </View>

            <View>
              {error ? (
                <View accessibilityRole="alert" className="mb-4 rounded-field border border-danger bg-danger-bg px-3 py-2.5">
                  <Text className="font-sans-medium text-[13px] leading-[18px] text-danger">{error}</Text>
                </View>
              ) : null}

              {step === "demande" ? (
                <Field
                  first
                  label="Email ou téléphone"
                  value={identifiant}
                  onChangeText={setIdentifiant}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!busy}
                  onSubmitEditing={demanderCode}
                />
              ) : (
                <View className="gap-4">
                  <Field first mono label="Code reçu par email" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} editable={!busy} />
                  <Field
                    first
                    label="Nouveau mot de passe"
                    value={next}
                    onChangeText={setNext}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                    placeholder={`${MIN_LENGTH} caractères minimum`}
                    editable={!busy}
                    onSubmitEditing={enregistrer}
                  />
                </View>
              )}

              <Button
                title={busy ? "Envoi…" : step === "demande" ? "Recevoir un code" : "Enregistrer le mot de passe"}
                block
                disabled={busy}
                className="mt-6"
                onPress={step === "demande" ? demanderCode : enregistrer}
              />
              <Button title="Retour à la connexion" variant="ghost" block disabled={busy} className="mt-2" onPress={() => router.back()} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
