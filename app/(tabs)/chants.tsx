// Écran « Répertoire » : quatre onglets sous l'en-tête (Thèmes, Alphabet, Numéros, Favoris).
//   - Alphabet : titres triés avec leur numéro, index A–Z à droite (toucher ou glisser pour sauter) ;
//   - Numéros : grille de 4 colonnes (numéro automatique, ordre d'ajout au répertoire) ;
//   - Thèmes : catégories de chant, puis les chants du thème ;
//   - Favoris : chants marqués d'un cœur sur leur page (enregistrés sur le téléphone).

import { router } from "expo-router"
import { ChevronLeft, Heart, Music, Plus } from "lucide-react-native"
import { useCallback, useMemo, useRef, useState, type ComponentRef } from "react"
import { Pressable, RefreshControl, ScrollView, Text, View, type GestureResponderEvent } from "react-native"
import { KeyboardAwareScrollView } from "../../components/keyboard"
import { SafeAreaView } from "react-native-safe-area-context"

import { AppHeader } from "../../components/AppHeader"
import { useResponsive } from "../../components/layout"
import { ChantFormSheet } from "../../components/sheets/ChantSheets"
import { OfflineBanner, RecordSyncBadge } from "../../components/sync"
import { Chevron, cx, EmptyState, SearchBar } from "../../components/ui"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { ALPHABET, cleChant, lettreDe, numerosChants, sansAccents, trierParTitre } from "../../lib/chants"
import { useFavoris } from "../../lib/favoris"
import type { Chant } from "../../types"

type Onglet = "themes" | "alphabet" | "numeros" | "favoris"

const ONGLETS: { key: Onglet; label: string }[] = [
  { key: "themes", label: "Thèmes" },
  { key: "alphabet", label: "Alphabet" },
  { key: "numeros", label: "Numéros" },
  { key: "favoris", label: "Favoris" },
]

/** Hauteur d'une lettre de l'index A–Z (sert aussi à retrouver la lettre sous le doigt). */
const LETTRE_H = 18

const ouvrir = (chant: Chant) => router.push(`/chant/${chant.id}`)

/* ------------------------------------ Onglets ------------------------------------ */

function BarreOnglets({ actif, onChange }: { actif: Onglet; onChange: (o: Onglet) => void }) {
  return (
    <View accessibilityRole="tablist" className="flex-row border-b border-line bg-paper">
      {ONGLETS.map((o) => {
        const selectionne = o.key === actif
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectionne }}
            className="min-h-touch flex-1 items-center justify-center"
          >
            <Text
              numberOfLines={1}
              className={cx("font-sans-semibold text-[13px] uppercase tracking-[0.4px]", selectionne ? "text-navy" : "text-ink-light")}
            >
              {o.label}
            </Text>
            {/* Trait de l'onglet actif, sur toute la largeur de l'onglet (comme le modèle). */}
            <View className={cx("absolute bottom-0 left-0 right-0 h-[3px]", selectionne ? "bg-navy" : "bg-transparent")} />
          </Pressable>
        )
      })}
    </View>
  )
}

/* ------------------------------------ Ligne d'un chant ------------------------------------ */

function LigneChant({ chant, numero, favori, onLayout }: { chant: Chant; numero: string; favori: boolean; onLayout?: (y: number) => void }) {
  return (
    <Pressable
      onPress={() => ouvrir(chant)}
      onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.y) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${chant.titre}, numéro ${numero}${favori ? ", favori" : ""}`}
      className="flex-row items-center gap-2 py-3 active:opacity-60"
    >
      <View className="min-w-0 flex-1">
        <Text numberOfLines={2} className="font-sans-semibold text-[16px] leading-[22px] text-ink">
          {chant.titre}
        </Text>
        <Text className="mt-0.5 font-sans-medium text-[14px] tabular-nums text-ink-light">{numero}</Text>
      </View>
      {chant.syncStatus && chant.syncStatus !== "synced" ? <RecordSyncBadge status={chant.syncStatus} /> : null}
      {favori ? <Heart size={15} color={colors.danger} fill={colors.danger} /> : null}
    </Pressable>
  )
}

/* ------------------------------------ Index A–Z ------------------------------------ */

/** Colonne A–Z à droite : toucher une lettre ou glisser le doigt dessus fait défiler la liste. */
function IndexAlphabet({ disponibles, onLettre }: { disponibles: Set<string>; onLettre: (lettre: string) => void }) {
  const haut = useRef(0)
  const colonne = useRef<ComponentRef<typeof View>>(null)
  const derniere = useRef<string | null>(null)

  const lettreSous = (e: GestureResponderEvent) => {
    const i = Math.floor((e.nativeEvent.pageY - haut.current) / LETTRE_H)
    return ALPHABET[Math.max(0, Math.min(ALPHABET.length - 1, i))]
  }
  const toucher = (e: GestureResponderEvent) => {
    const lettre = lettreSous(e)
    if (lettre === derniere.current) return
    derniere.current = lettre
    onLettre(lettre)
  }

  return (
    <View
      ref={colonne}
      onLayout={() => colonne.current?.measureInWindow((_x, y) => (haut.current = y))}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        derniere.current = null
        // Position relue au toucher : l'en-tête ou le clavier ont pu la déplacer.
        colonne.current?.measureInWindow((_x, y) => (haut.current = y))
        toucher(e)
      }}
      onResponderMove={toucher}
      accessibilityLabel="Index alphabétique"
      className="absolute bottom-0 right-1 top-0 justify-center px-1.5"
    >
      {ALPHABET.map((l) => (
        <Text
          key={l}
          style={{ height: LETTRE_H, lineHeight: LETTRE_H }}
          className={cx("text-center font-sans-medium text-[12px]", disponibles.has(l) ? "text-navy" : "text-n-400")}
        >
          {l}
        </Text>
      ))}
    </View>
  )
}

/* ------------------------------------ Écran ------------------------------------ */

export default function ChantsScreen() {
  const { chants, can, refresh, syncing, session } = useApp()
  const { openSheet } = useSheet()
  const { maxWidth, gutter } = useResponsive()
  const favoris = useFavoris()
  const [onglet, setOnglet] = useState<Onglet>("alphabet")
  const [recherche, setRecherche] = useState("")
  const [theme, setTheme] = useState<string | null>(null)

  const numeros = useMemo(() => numerosChants(chants), [chants])
  const numeroDe = useCallback((c: Chant) => numeros.get(cleChant(c)) ?? "—", [numeros])

  // Recherche : titre, auteur ou numéro (accents et casse ignorés).
  const q = sansAccents(recherche.trim())
  const visibles = useMemo(
    () =>
      q
        ? chants.filter((c) => sansAccents(c.titre).includes(q) || sansAccents(c.compositeur).includes(q) || numeroDe(c).includes(q))
        : chants,
    [chants, q, numeroDe]
  )
  const alphabetiques = useMemo(() => trierParTitre(visibles), [visibles])

  /* ---------- Alphabet : position de la première ligne de chaque lettre ---------- */
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const positions = useRef(new Map<string, number>())
  const disponibles = useMemo(() => new Set(alphabetiques.map((c) => lettreDe(c.titre))), [alphabetiques])
  const premiers = useMemo(() => {
    const vus = new Set<string>()
    const ids = new Set<string>()
    for (const c of alphabetiques) {
      const l = lettreDe(c.titre)
      if (!vus.has(l)) {
        vus.add(l)
        ids.add(cleChant(c))
      }
    }
    return ids
  }, [alphabetiques])

  const sauterA = useCallback(
    (lettre: string) => {
      // Lettre sans chant : la suivante qui en a (sinon la précédente).
      const i = ALPHABET.indexOf(lettre)
      const cible = [...ALPHABET.slice(i), ...ALPHABET.slice(0, i).reverse()].find((l) => positions.current.has(l))
      if (cible) scroll.current?.scrollTo({ y: positions.current.get(cible)!, animated: false })
    },
    []
  )

  /* ---------- Thèmes ---------- */
  const themes = useMemo(() => {
    const parTheme = new Map<string, number>()
    for (const c of visibles) parTheme.set(c.categorie || "Non classé", (parTheme.get(c.categorie || "Non classé") ?? 0) + 1)
    return [...parTheme].sort((a, b) => a[0].localeCompare(b[0], "fr"))
  }, [visibles])

  const refreshControl = session ? (
    // Composant tiers : couleurs passées en props.
    <RefreshControl refreshing={syncing} onRefresh={refresh} tintColor={colors.navy} colors={[colors.navy]} />
  ) : undefined

  /** Contenu centré à largeur maximale (tablette), gouttière selon l'écran. */
  const cadre = { maxWidth, paddingHorizontal: gutter, width: "100%" as const, alignSelf: "center" as const }

  const liste = (items: Chant[], { index = false }: { index?: boolean } = {}) => (
    <View style={cadre} className={index ? "pr-8" : undefined}>
      {items.map((c) => {
        const cle = cleChant(c)
        return (
          <LigneChant
            key={cle}
            chant={c}
            numero={numeroDe(c)}
            favori={favoris.has(cle)}
            onLayout={index && premiers.has(cle) ? (y) => positions.current.set(lettreDe(c.titre), y) : undefined}
          />
        )
      })}
    </View>
  )

  const aucunResultat = <EmptyState icon={Music} title="Aucun chant trouvé" subtitle="Essayez une autre recherche." />

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
      <AppHeader title="Répertoire" />
      <BarreOnglets
        actif={onglet}
        onChange={(o) => {
          setOnglet(o)
          setTheme(null)
        }}
      />

      {/* Recherche (et ajout pour le bureau et la commission musicale) */}
      <View style={cadre} className="flex-row items-center gap-2 pt-3">
        <View className="flex-1">
          <SearchBar placeholder="Titre, auteur ou numéro…" value={recherche} onChangeText={setRecherche} />
        </View>
        {can("chantsCreer") ? (
          <Pressable
            onPress={() => openSheet(<ChantFormSheet />)}
            accessibilityRole="button"
            accessibilityLabel="Ajouter un chant"
            className="mb-3 h-11 w-11 items-center justify-center rounded-field bg-navy active:opacity-70"
          >
            <Plus size={20} color={colors.paper} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
      <View style={cadre}>
        <OfflineBanner className="mb-2" />
      </View>

      <View className="flex-1 bg-surface">
        {onglet === "alphabet" ? (
          <>
            <KeyboardAwareScrollView
              ref={scroll}
              className="flex-1"
              contentContainerClassName="pb-8"
              keyboardShouldPersistTaps="handled"
              refreshControl={refreshControl}
              onContentSizeChange={() => {
                // Liste reconstruite (recherche, téléchargement) : positions recalculées par onLayout.
                for (const l of [...positions.current.keys()]) if (!disponibles.has(l)) positions.current.delete(l)
              }}
            >
              {alphabetiques.length === 0 ? aucunResultat : liste(alphabetiques, { index: true })}
            </KeyboardAwareScrollView>
            {alphabetiques.length > 0 ? <IndexAlphabet disponibles={disponibles} onLettre={sauterA} /> : null}
          </>
        ) : null}

        {onglet === "numeros" ? (
          <KeyboardAwareScrollView className="flex-1" contentContainerClassName="pb-8 pt-2" keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
            {visibles.length === 0 ? (
              aucunResultat
            ) : (
              <View style={cadre} className="flex-row flex-wrap">
                {[...visibles]
                  .sort((a, b) => numeroDe(a).localeCompare(numeroDe(b)))
                  .map((c) => (
                    <Pressable
                      key={cleChant(c)}
                      onPress={() => ouvrir(c)}
                      accessibilityRole="button"
                      accessibilityLabel={`Chant numéro ${numeroDe(c)} : ${c.titre}`}
                      className="h-[56px] w-1/4 items-center justify-center rounded-field active:bg-surface-soft"
                    >
                      <Text className="font-sans-semibold text-[17px] tabular-nums text-ink-soft">{numeroDe(c)}</Text>
                    </Pressable>
                  ))}
              </View>
            )}
          </KeyboardAwareScrollView>
        ) : null}

        {onglet === "themes" ? (
          <KeyboardAwareScrollView className="flex-1" contentContainerClassName="pb-8" keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
            {theme === null ? (
              themes.length === 0 ? (
                aucunResultat
              ) : (
                <View style={cadre}>
                  {themes.map(([nom, nombre]) => (
                    <Pressable
                      key={nom}
                      onPress={() => setTheme(nom)}
                      accessibilityRole="button"
                      accessibilityLabel={`${nom}, ${nombre} chant${nombre > 1 ? "s" : ""}`}
                      className="flex-row items-center gap-2 py-3.5 active:opacity-60"
                    >
                      <View className="min-w-0 flex-1">
                        <Text className="font-sans-semibold text-[16px] text-ink">{nom}</Text>
                        <Text className="mt-0.5 font-sans text-[13px] tabular-nums text-ink-light">
                          {nombre} chant{nombre > 1 ? "s" : ""}
                        </Text>
                      </View>
                      <Chevron />
                    </Pressable>
                  ))}
                </View>
              )
            ) : (
              <>
                <View style={cadre}>
                  <Pressable
                    onPress={() => setTheme(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Retour aux thèmes"
                    className="-ml-1.5 flex-row items-center gap-1 self-start py-3 active:opacity-60"
                  >
                    <ChevronLeft size={18} color={colors.navy} strokeWidth={2} />
                    <Text className="font-sans-semibold text-[14px] text-navy">Thèmes</Text>
                    <Text className="font-sans text-[14px] text-ink-light"> · {theme}</Text>
                  </Pressable>
                </View>
                {liste(trierParTitre(visibles.filter((c) => (c.categorie || "Non classé") === theme)))}
              </>
            )}
          </KeyboardAwareScrollView>
        ) : null}

        {onglet === "favoris" ? (
          <KeyboardAwareScrollView className="flex-1" contentContainerClassName="pb-8" keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
            {(() => {
              const favs = alphabetiques.filter((c) => favoris.has(cleChant(c)))
              if (favs.length > 0) return liste(favs)
              return q ? (
                aucunResultat
              ) : (
                <EmptyState icon={Heart} title="Aucun favori" subtitle="Ouvrez un chant et touchez le cœur pour le retrouver ici." />
              )
            })()}
          </KeyboardAwareScrollView>
        ) : null}
      </View>
    </SafeAreaView>
  )
}
