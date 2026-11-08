// Première connexion : le compte a un mot de passe temporaire (créé par l'administration).
// L'API refuse les autres routes tant que le membre n'a pas choisi son propre mot de passe.
import { router } from "expo-router"
import { LockKeyhole } from "lucide-react-native"
import { useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Button, Field } from "../components/ui"
import { colors, shadows } from "../constants/theme"
import { useApp } from "../context/AppContext"
import { useToast } from "../context/ToastContext"
import { syncManager } from "../lib/offline"

const MIN_LENGTH = 8

export default function ChangePasswordScreen() {
  const { session, changePassword, logout } = useApp()
  const { toast } = useToast()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!current || !next || !confirm) return setError("Renseignez les trois champs.")
    if (next.length < MIN_LENGTH) return setError(`Le nouveau mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`)
    if (next !== confirm) return setError("Les deux nouveaux mots de passe ne sont pas identiques.")
    if (next === current) return setError("Choisissez un mot de passe différent du mot de passe temporaire.")
    setError(null)
    setSaving(true)
    try {
      await changePassword(current, next)
      toast("Mot de passe enregistré")
      router.replace(syncManager.isInitialSyncDone() ? "/(tabs)" : "/initial-sync")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le mot de passe n'a pas pu être changé.")
      setSaving(false)
    }
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
                <LockKeyhole size={28} color={colors.gold} strokeWidth={1.6} />
              </View>
              <Text accessibilityRole="header" className="text-center font-sans-semibold text-[22px] tracking-[-0.2px] text-navy">
                Choisissez votre mot de passe
              </Text>
              <Text className="mt-1.5 text-center font-sans text-[13px] leading-[19px] text-ink-light">
                {session ? `Bienvenue ${session.nom.split(" ")[0]} ! ` : ""}Pour sécuriser votre compte, remplacez le mot de passe temporaire reçu.
              </Text>
            </View>

            <View>
              {error ? (
                <View accessibilityRole="alert" className="mb-4 rounded-field border border-danger bg-danger-bg px-3 py-2.5">
                  <Text className="font-sans-medium text-[13px] leading-[18px] text-danger">{error}</Text>
                </View>
              ) : null}
              <View className="gap-4">
                <Field first label="Mot de passe temporaire" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
                <Field
                  first
                  label="Nouveau mot de passe"
                  value={next}
                  onChangeText={setNext}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  placeholder={`${MIN_LENGTH} caractères minimum`}
                />
                <Field first label="Confirmer le nouveau mot de passe" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" onSubmitEditing={submit} />
              </View>
              <Button title={saving ? "Enregistrement…" : "Enregistrer et continuer"} block disabled={saving} className="mt-6" onPress={submit} />
              <Button
                title="Se déconnecter"
                variant="ghost"
                block
                disabled={saving}
                className="mt-2"
                onPress={() => {
                  logout()
                  router.replace("/login")
                }}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
