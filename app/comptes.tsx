// Écran « Comptes & Rôles » : équivalent mobile du module web (components/portail/modules/comptes.tsx).
// Liste de cartes + bottom sheets (components/sheets/CompteSheets.tsx) au lieu du tableau du web.

import { Lock, UserRound } from "lucide-react-native"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, RefreshControl, Text, View } from "react-native"
import { KeyboardAwareScrollView } from "../components/keyboard"
import { SafeAreaView } from "react-native-safe-area-context"
import { BackHeader } from "../components/AppHeader"
import { Container } from "../components/layout"
import { CompteDetailSheet, CompteFormSheet, comptesStore, useComptes, useDroitsCompte } from "../components/sheets/CompteSheets"
import { Avatar, Button, Card, Chevron, Chip, ChipsRow, EmptyState, Muted, Pill, SearchBar } from "../components/ui"
import { colors } from "../constants/theme"
import { useApp } from "../context/AppContext"
import { useSheet } from "../context/SheetContext"
import { useSyncSummary } from "../hooks/offline"
import { type Compte } from "../lib/api"
import { syncManager } from "../lib/offline"
import { ROLE_LABEL } from "../lib/roles"

type Filtre = "tous" | "actifs" | "desactives"

/** Minuscules sans accents, pour la recherche. */
const plat = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/** Carte d'un compte dans la liste. */
function CompteCard({ compte, estMoi, protege, onPress }: { compte: Compte; estMoi: boolean; protege: boolean; onPress: () => void }) {
  const desactive = compte.statut !== "actif"
  return (
    <Card onPress={onPress} accessibilityLabel={`${compte.nom}${estMoi ? " (vous)" : ""}${desactive ? ", désactivé" : ""}. Ouvrir le détail`}>
      <View className="flex-row items-center gap-3">
        <Avatar id={compte.id} name={compte.nom} size={40} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-sans-bold text-[14px] text-ink">
            {compte.nom}
            {estMoi ? <Text className="font-sans text-ink-light"> (vous)</Text> : null}
          </Text>
          {compte.telephone ? <Text className="mt-0.5 font-sans text-[12px] tabular-nums text-ink-soft">{compte.telephone}</Text> : null}
        </View>
        <Chevron />
      </View>
      <View className="mt-2.5 flex-row flex-wrap gap-1.5">
        {desactive ? <Pill variant="burg">Désactivé</Pill> : null}
        {compte.roles.map((r) => (
          <Pill key={r} variant={r === "choriste" ? "default" : "gold"}>
            {ROLE_LABEL[r]}
          </Pill>
        ))}
      </View>
      {compte.motDePasseTemporaire ? (
        // Tant que le membre n'a pas choisi son mot de passe : à lui transmettre.
        <View className="mt-2.5 flex-row items-center gap-2">
          <Muted className="text-[12px]">Mot de passe temporaire</Muted>
          <Text selectable className="rounded-md bg-surface-soft px-2 py-0.5 font-mono-medium text-[12.5px] tracking-wide text-ink">
            {compte.motDePasseTemporaire}
          </Text>
        </View>
      ) : null}
      {protege ? <Muted className="mt-2 text-[11.5px]">Géré depuis le back-office</Muted> : null}
    </Card>
  )
}

export default function ComptesScreen() {
  const { can } = useApp()
  const { openSheet } = useSheet()
  const comptes = useComptes()
  const droitsSur = useDroitsCompte()
  const autorise = can("comptes")

  const { isOnline } = useSyncSummary()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [recherche, setRecherche] = useState("")
  const [filtre, setFiltre] = useState<Filtre>("tous")

  /** Met à jour la copie locale depuis le serveur (sans réseau : la copie du téléphone reste affichée). */
  const charger = useCallback(async () => {
    setErreur(null)
    const resultat = await syncManager.refreshEntity("comptes")
    const echec = resultat.errors.find((e) => e.entity === "comptes")
    if (echec) setErreur(echec.message)
  }, [])

  useEffect(() => {
    if (!autorise) return
    // Copie du téléphone affichée tout de suite (marche hors ligne), puis mise à jour.
    comptesStore.reload()
    setLoading(comptesStore.get().length === 0)
    charger().finally(() => setLoading(false))
  }, [autorise, charger])

  const rafraichir = useCallback(async () => {
    setRefreshing(true)
    await charger()
    setRefreshing(false)
  }, [charger])

  const compteurs = useMemo(() => {
    const actifs = comptes.filter((c) => c.statut === "actif").length
    return { tous: comptes.length, actifs, desactives: comptes.length - actifs }
  }, [comptes])

  const visibles = useMemo(() => {
    const q = plat(recherche.trim())
    const qChiffres = recherche.replace(/\D/g, "")
    return comptes.filter((c) => {
      if (filtre === "actifs" && c.statut !== "actif") return false
      if (filtre === "desactives" && c.statut === "actif") return false
      if (!q) return true
      return plat(c.nom).includes(q) || plat(c.email).includes(q) || (qChiffres.length > 0 && c.telephone.replace(/\D/g, "").includes(qChiffres))
    })
  }, [comptes, recherche, filtre])

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
      <BackHeader title="Comptes & Rôles" />
      <KeyboardAwareScrollView
        className="flex-1 bg-surface"
        contentContainerClassName="pb-7 pt-4"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          autorise ? (
            // Composant tiers : couleur passée en props.
            <RefreshControl refreshing={refreshing} onRefresh={rafraichir} tintColor={colors.navy} colors={[colors.navy]} />
          ) : undefined
        }
      >
        <Container>
          {!autorise ? (
            <EmptyState icon={Lock} title="Accès réservé" subtitle="La gestion des comptes est réservée à l’Admin de chorale, au Bureau exécutif et au Secrétaire général." />
          ) : (
            <>
              {isOnline ? (
                <Button title="+ Créer un compte" block className="mb-3.5" onPress={() => openSheet(<CompteFormSheet />)} />
              ) : (
                // Hors ligne : la liste enregistrée sur le téléphone reste consultable.
                <View className="mb-3.5 rounded-card border border-line bg-warning-bg p-3.5">
                  <Text className="font-sans text-[13px] text-warning">
                    Hors connexion : comptes enregistrés sur le téléphone. La création et la modification des comptes demandent internet.
                  </Text>
                </View>
              )}

              <SearchBar
                value={recherche}
                onChangeText={setRecherche}
                placeholder="Rechercher (nom, téléphone, email)"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              <ChipsRow>
                <Chip label={`Tous (${compteurs.tous})`} active={filtre === "tous"} onPress={() => setFiltre("tous")} />
                <Chip label={`Actifs (${compteurs.actifs})`} active={filtre === "actifs"} onPress={() => setFiltre("actifs")} />
                <Chip label={`Désactivés (${compteurs.desactives})`} active={filtre === "desactives"} onPress={() => setFiltre("desactives")} />
              </ChipsRow>

              {erreur ? (
                <View accessibilityLiveRegion="polite" className="mb-3.5 rounded-card border border-danger bg-danger-bg p-3.5">
                  <Text className="font-sans text-[13px] text-danger">{erreur}</Text>
                  <Button
                    title="Réessayer"
                    variant="danger"
                    small
                    className="mt-2.5"
                    onPress={() => {
                      setLoading(true)
                      charger().finally(() => setLoading(false))
                    }}
                  />
                </View>
              ) : null}

              {loading ? (
                <View className="items-center py-10">
                  {/* Composant tiers : couleur passée en props. */}
                  <ActivityIndicator size="large" color={colors.navy} accessibilityLabel="Chargement des comptes" />
                </View>
              ) : visibles.length === 0 && !erreur ? (
                <EmptyState
                  icon={UserRound}
                  title={comptes.length === 0 ? "Aucun compte" : "Aucun résultat"}
                  subtitle={comptes.length === 0 ? "Créez le premier compte de la chorale." : "Modifiez la recherche ou le filtre."}
                />
              ) : (
                visibles.map((c) => {
                  const d = droitsSur(c)
                  return (
                    <CompteCard
                      key={c.id}
                      compte={c}
                      estMoi={d.estMoi}
                      protege={d.estAdminProtege}
                      onPress={() => openSheet(<CompteDetailSheet compteId={c.id} />)}
                    />
                  )
                })
              )}
            </>
          )}
        </Container>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}
