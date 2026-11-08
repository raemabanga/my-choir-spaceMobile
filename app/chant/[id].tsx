// Page « Détail du chant » (plein écran) : titre, audio, partition, paroles, puis l'auteur en bas.

import { router, useLocalSearchParams } from "expo-router"
import { FileText, Music, Pencil, Play } from "lucide-react-native"
import { ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { BackHeader } from "../../components/AppHeader"
import { Container } from "../../components/layout"
import { ChantFormSheet } from "../../components/sheets/ChantSheets"
import { Button, Card, EmptyState, Pill, ProgressBar, RowBetween, SectionHeader } from "../../components/ui"
import { colors } from "../../constants/theme"
import { errorMessage, useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"

export default function ChantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { chants, can, isDemo, proposeDeleteSong, deleteSong } = useApp()
  const { openSheet } = useSheet()
  const { toast } = useToast()
  const chant = chants.find((c) => c.id === Number(id))

  // L'API ne permet pas encore de modifier un chant, ni de proposer sa suppression :
  // ces actions restent réservées à la démonstration.
  const canEdit = isDemo && can("chantsCreer")
  // Comme sur le web, seul le bureau supprime ; qui peut ajouter sans supprimer (commission musicale) propose.
  const canPropose = isDemo && chant !== undefined && can("chantsCreer") && !can("chantsGerer") && chant.statut !== "a_valider"
  // Démonstration : le bureau valide une suppression proposée. API : le bureau supprime directement.
  const canDelete = chant !== undefined && can("chantsGerer") && (!isDemo || chant.statut === "a_valider")

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
      <BackHeader
        title="Chant"
        right={
          chant && canEdit ? (
            <Button title="Modifier" icon={Pencil} variant="outline" small onPress={() => openSheet(<ChantFormSheet chant={chant} />)} />
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
              <View className="mb-4 mt-3 flex-row flex-wrap gap-1.5">
                <Pill>{chant.categorie}</Pill>
                {chant.tonalite ? <Pill variant="gold">{chant.tonalite}</Pill> : null}
                {chant.statut === "a_valider" ? <Pill variant="pending">Suppression proposée</Pill> : null}
              </View>

              <Card>
                <RowBetween>
                  <View className="flex-row items-center gap-2">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-navy">
                      <Play size={16} color={colors.goldSoft} fill={colors.goldSoft} />
                    </View>
                    <Text className="font-sans-bold text-[14px] text-ink">Écouter l'audio</Text>
                  </View>
                  <Text className="font-sans text-[12.5px] tabular-nums text-ink-light">02:41</Text>
                </RowBetween>
                <ProgressBar percent={30} />
              </Card>

              <Button title="Voir la partition (PDF)" icon={FileText} variant="ghost" block onPress={() => toast("Fonctionnalité à venir")} />

              {canPropose ? (
                <Button
                  title="Proposer la suppression"
                  variant="danger"
                  block
                  className="mt-2"
                  onPress={() => {
                    proposeDeleteSong(chant.id)
                    toast("Suppression proposée au bureau exécutif")
                  }}
                />
              ) : null}
              {canDelete ? (
                <Button
                  title={isDemo ? "Valider la suppression" : "Supprimer le chant"}
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
