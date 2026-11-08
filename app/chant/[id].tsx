// Page « Détail du chant » (plein écran) : titre, audio, partition, paroles, puis l'auteur en bas.

import { router, useLocalSearchParams } from "expo-router"
import { FileText, Heart, Music } from "lucide-react-native"
import { useMemo, useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { BackHeader } from "../../components/AppHeader"
import { ChantAudio } from "../../components/ChantAudio"
import { Container } from "../../components/layout"
import { Button, Card, EmptyState, Muted, Pill, SectionHeader } from "../../components/ui"
import { colors } from "../../constants/theme"
import { errorMessage, useApp } from "../../context/AppContext"
import { parId } from "../../context/choraleData"
import { useToast } from "../../context/ToastContext"
import { cleChant, numerosChants } from "../../lib/chants"
import { ouvrirDocumentChant } from "../../lib/fichiersChant"
import { basculerFavori, useFavoris } from "../../lib/favoris"

export default function ChantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { chants, can, deleteSong } = useApp()
  const { toast } = useToast()
  // parId : la page d'un chant créé hors ligne reste valable après son envoi au serveur.
  const chant = parId(chants, Number(id))

  // Comme sur le web, seul le bureau supprime un chant (l'API ne permet pas encore de le modifier).
  const canDelete = chant !== undefined && can("chantsGerer")

  // Numéro automatique (ordre d'ajout au répertoire) et favori (enregistré sur le téléphone).
  const numeros = useMemo(() => numerosChants(chants), [chants])
  const favoris = useFavoris()
  const cle = chant ? cleChant(chant) : null
  const favori = cle !== null && favoris.has(cle)
  const [ouverture, setOuverture] = useState(false)

  /** Ouvre la partition avec une application du téléphone (téléchargée une fois, puis hors connexion). */
  async function ouvrirPartition() {
    if (!chant?.document || chant.id < 0 || ouverture) return
    setOuverture(true)
    try {
      await ouvrirDocumentChant(chant.id, chant.document)
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setOuverture(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
      <BackHeader
        title="Chant"
        right={
          cle ? (
            <Pressable
              onPress={() => toast(basculerFavori(cle) ? "Ajouté aux favoris" : "Retiré des favoris")}
              accessibilityRole="button"
              accessibilityLabel={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
              accessibilityState={{ selected: favori }}
              hitSlop={6}
              className="min-h-touch min-w-touch items-center justify-center rounded-full active:opacity-60"
            >
              {/* Icône lucide : couleurs en props ; cœur plein quand le chant est favori. */}
              <Heart size={24} color={favori ? colors.danger : colors.n400} fill={favori ? colors.danger : "transparent"} strokeWidth={2} />
            </Pressable>
          ) : null
        }
      />
      {/* grow + flex-1 : la page occupe tout l'écran, l'auteur reste collé en bas même avec des paroles courtes. */}
      <ScrollView className="flex-1 bg-surface" contentContainerClassName="grow pb-10 pt-5">
        <Container className="flex-1">
          {!chant ? (
            <EmptyState icon={Music} title="Chant introuvable" subtitle="Il a peut-être été retiré du répertoire." />
          ) : (
            <>
              <Text accessibilityRole="header" className="font-sans-semibold text-[26px] leading-[32px] tracking-[-0.3px] text-navy">
                {chant.titre}
              </Text>
              <Text className="mt-1 font-sans-medium text-[14px] tabular-nums text-ink-light">N° {numeros.get(cleChant(chant)) ?? "—"}</Text>
              <View className="mb-4 mt-3 flex-row flex-wrap gap-1.5">
                <Pill>{chant.categorie}</Pill>
                {chant.tonalite ? <Pill variant="gold">{chant.tonalite}</Pill> : null}
              </View>

              {/* Audio et partition : ajoutés depuis le portail web (chant déjà envoyé au serveur). */}
              {chant.audio && chant.id >= 0 ? <ChantAudio chantId={chant.id} meta={chant.audio} /> : null}
              {chant.document && chant.id >= 0 ? (
                <Button
                  title={ouverture ? "Ouverture…" : "Voir la partition"}
                  icon={FileText}
                  variant="ghost"
                  block
                  disabled={ouverture}
                  onPress={ouvrirPartition}
                />
              ) : null}
              {!chant.audio && !chant.document ? (
                <Muted className="mb-2">Pas encore d'audio ni de partition : ils s'ajoutent depuis le portail web.</Muted>
              ) : null}

              {canDelete ? (
                <Button
                  title="Supprimer le chant"
                  variant="danger"
                  block
                  className="mt-2"
                  onPress={() => {
                    deleteSong(chant.id)
                      .then(() => {
                        router.back()
                        toast("Chant supprimé du répertoire")
                      })
                      .catch((e) => toast(errorMessage(e)))
                  }}
                />
              ) : null}

              <SectionHeader title="Paroles" />
              <Card className="px-5 py-5">
                {chant.paroles.trim() ? (
                  <Text selectable className="font-sans text-[16px] leading-[26px] text-ink">
                    {chant.paroles}
                  </Text>
                ) : (
                  <Text className="font-sans text-[14px] text-ink-light">Aucunes paroles saisies pour ce chant.</Text>
                )}
              </Card>

              {/* Auteur en bas de page, comme la signature d'une partition. */}
              <View className="min-h-6 flex-1" />
              <View className="items-end border-t border-line pt-4">
                <Text className="font-sans-semibold text-[11px] uppercase tracking-[0.6px] text-ink-light">Auteur / compositeur</Text>
                <Text className="mt-1 font-sans-semibold text-[16px] text-navy">{chant.compositeur.trim() || "Auteur inconnu"}</Text>
              </View>
            </>
          )}
        </Container>
      </ScrollView>
    </SafeAreaView>
  )
}
