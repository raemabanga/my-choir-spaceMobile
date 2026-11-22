// Écran « Comptes & Rôles » : équivalent mobile du module web (components/portail/modules/comptes.tsx).
// Liste de cartes + bottom sheets (components/sheets/CompteSheets.tsx) au lieu du tableau du web.

import { Lock, UserRound } from "lucide-react-native"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, RefreshControl, Text, View } from "react-native"
import { KeyboardAwareScrollView } from "../components/keyboard"
import { SafeAreaView } from "react-native-safe-area-context"
import { BackHeader } from "../components/AppHeader"
import { Container } from "../components/layout"
import {
  CompteDetailSheet,
  CompteFormSheet,
  comptesStore,
  ETAT_COMPTE,
  etatCompte,
  PastilleEtatCompte,
  useComptes,
  useDroitsCompte,
  type EtatCompte,
} from "../components/sheets/CompteSheets"
import { Avatar, Button, Card, Chevron, Chip, ChipsRow, EmptyState, Muted, Pagination, Pill, SearchBar, Select } from "../components/ui"
import { FiltresGenreVoix, FILTRE_GENRE_VOIX_DEFAUT, filtrerGenreVoix } from "../components/FiltresGenreVoix"
import { GENRES, libelle, VOIX } from "../lib/fiche"
import { colors } from "../constants/theme"
import { useApp } from "../context/AppContext"
import { useSheet } from "../context/SheetContext"
import { useSyncSummary } from "../hooks/offline"
import { usePagination } from "../hooks/usePagination"
import { type Compte } from "../lib/api"
import { syncManager } from "../lib/offline"
import { ROLE_LABEL } from "../lib/roles"
import type { Role } from "../types"

/** Filtre par état : « tous » ou un état (participation calculée, ou désactivé). */
type Filtre = "tous" | EtatCompte

const FILTRES: { filtre: EtatCompte; label: string }[] = [
  { filtre: "ACTIF", label: "Actifs" },
  { filtre: "A_SURVEILLER", label: "À surveiller" },
  { filtre: "INACTIF", label: "Inactifs" },
  { filtre: "DESACTIVE", label: "Désactivés" },
]

/** Minuscules sans accents, pour la recherche. */
const plat = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/** Carte d'un compte dans la liste. */
/** « Soprano · Femme · Instrumentiste », vide si rien n'est renseigné. */
function pupitre(c: Compte) {
  const f = c.fiche ?? {}
  return [libelle(VOIX, f.voix), libelle(GENRES, f.genre), f.instrumentiste ? "Instrumentiste" : undefined].filter(Boolean).join(" · ")
}

function CompteCard({ compte, estMoi, protege, onPress }: { compte: Compte; estMoi: boolean; protege: boolean; onPress: () => void }) {
  const etat = etatCompte(compte)
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${compte.nom}${estMoi ? " (vous)" : ""}${etat ? `, ${ETAT_COMPTE[etat].label.toLowerCase()}` : ""}. Ouvrir le détail`}
    >
      <View className="flex-row items-center gap-3">
        <Avatar id={compte.id} name={compte.nom} size={40} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-sans-bold text-[14px] text-ink">
            {compte.nom}
            {estMoi ? <Text className="font-sans text-ink-light"> (vous)</Text> : null}
          </Text>
          {compte.telephone ? <Text className="mt-0.5 font-sans text-[12px] tabular-nums text-ink-soft">{compte.telephone}</Text> : null}
          {pupitre(compte) ? <Text className="mt-0.5 font-sans text-[12px] text-ink-light">{pupitre(compte)}</Text> : null}
        </View>
        <Chevron />
      </View>
      <View className="mt-2.5 flex-row flex-wrap gap-1.5">
        <PastilleEtatCompte compte={compte} />
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
  // Trésorière : liste et fiches en lecture seule (comptesVoir sans comptes).
  const autorise = can("comptesVoir")
  const gere = can("comptes")

  const { isOnline } = useSyncSummary()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [recherche, setRecherche] = useState("")
  const [filtre, setFiltre] = useState<Filtre>("tous")
  // Rôle filtré ("" : tous les rôles).
  const [role, setRole] = useState<Role | "">("")
  const [genreVoix, setGenreVoix] = useState(FILTRE_GENRE_VOIX_DEFAUT)

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
    const n: Record<EtatCompte, number> = { ACTIF: 0, A_SURVEILLER: 0, INACTIF: 0, DESACTIVE: 0 }
    for (const c of comptes) {
      const etat = etatCompte(c)
      if (etat) n[etat]++
    }
    return n
  }, [comptes])

  /** Rôles réellement attribués, pour le filtre par rôle. */
  const rolesPresents = useMemo(() => {
    const roles = new Set<Role>()
    for (const c of comptes) for (const r of c.roles) roles.add(r)
    return [...roles].sort((a, b) => ROLE_LABEL[a].localeCompare(ROLE_LABEL[b], "fr"))
  }, [comptes])

  const visibles = useMemo(() => {
    const q = plat(recherche.trim())
    const qChiffres = recherche.replace(/\D/g, "")
    return comptes.filter((c) => {
      if (filtre !== "tous" && etatCompte(c) !== filtre) return false
      if (role && !c.roles.includes(role)) return false
      if (!filtrerGenreVoix(c.fiche ?? {}, genreVoix)) return false
      if (!q) return true
      return plat(c.nom).includes(q) || plat(c.email).includes(q) || (qChiffres.length > 0 && c.telephone.replace(/\D/g, "").includes(qChiffres))
    })
  }, [comptes, recherche, filtre, role, genreVoix])

  const pagination = usePagination(visibles, 20, [recherche, filtre, role, genreVoix])

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
      <BackHeader title={gere || !autorise ? "Comptes & Rôles" : "Choristes"} />
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
            <EmptyState icon={Lock} title="Accès réservé" subtitle="La liste des comptes est réservée à l’Admin de chorale, au Bureau exécutif, au Secrétaire général et à la Trésorière." />
          ) : (
            <>
              {!gere ? null : isOnline ? (
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
                <Chip label={`Tous (${comptes.length})`} active={filtre === "tous"} onPress={() => setFiltre("tous")} />
                {FILTRES.map((f) => (
                  <Chip key={f.filtre} label={`${f.label} (${compteurs[f.filtre]})`} active={filtre === f.filtre} onPress={() => setFiltre(f.filtre)} />
                ))}
              </ChipsRow>
              {rolesPresents.length > 1 ? (
                <View className="-mt-1 mb-3.5">
                  <Select
                    first
                    label="Rôle"
                    value={role}
                    onChange={setRole}
                    options={[{ label: "Tous les rôles", value: "" as Role | "" }, ...rolesPresents.map((r) => ({ label: ROLE_LABEL[r], value: r as Role | "" }))]}
                  />
                </View>
              ) : null}
              <FiltresGenreVoix value={genreVoix} onChange={setGenreVoix} />

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
                  subtitle={comptes.length === 0 ? (gere ? "Créez le premier compte de la chorale." : "Aucun choriste enregistré.") : "Modifiez la recherche ou le filtre."}
                />
              ) : (
                <>
                  {pagination.pageItems.map((c) => {
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
                  })}
                  <Pagination {...pagination} />
                </>
              )}
            </>
          )}
        </Container>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}
