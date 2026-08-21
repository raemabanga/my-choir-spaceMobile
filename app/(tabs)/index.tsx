import { router } from "expo-router"
import { ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AppHeader } from "../../components/AppHeader"
import { ChantFormSheet } from "../../components/sheets/ChantSheets"
import { EventDetailSheet } from "../../components/sheets/EventSheets"
import { QuickPaymentSheet } from "../../components/sheets/CotisationSheets"
import { Button, Card, CardTitle, Muted, Pill, ProgressBar, RowBetween, SectionHeader } from "../../components/ui"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { fmt, formatDateLong } from "../../lib/format"

export default function HomeScreen() {
  const { currentUser, statutaire, events, chants, can, validateDeleteSong } = useApp()
  const { openSheet } = useSheet()
  const { toast } = useToast()

  if (!currentUser) return null

  const myPaid = statutaire[currentUser.id].filter(Boolean).length
  const nextEvent = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]

  const totalRec = events.reduce((s, e) => s + Object.values(e.contributions).reduce((a, b) => a + b, 0), 0)
  const totalDep = events.reduce((s, e) => s + e.depenses.filter((d) => d.valide).reduce((a, b) => a + b.montant, 0), 0)

  let due = 0
  Object.values(statutaire).forEach((months) => {
    due += months.filter((p) => !p).length
  })

  const lastChant = chants[chants.length - 1]
  const pendingChant = chants.find((c) => c.statut === "a_valider")

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["top"]}>
      <AppHeader title="Accueil" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 100 }}>
        <Card tint>
          <Muted light>Bonjour,</Muted>
          <CardTitle light>{currentUser.name.split(" ")[0]} 👋</CardTitle>
          <RowBetween style={{ marginTop: 10 }}>
            <View>
              <Muted light>Cotisation 2026</Muted>
              <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 20, color: colors.white }}>{myPaid}/12 mois</Text>
            </View>
            <Button title="Ma carte →" variant="gold" small onPress={() => router.push("/(tabs)/cotisations")} />
          </RowBetween>
          <ProgressBar percent={(myPaid / 12) * 100} light />
        </Card>

        <SectionHeader title="Prochain événement" />
        <Card onPress={() => openSheet(<EventDetailSheet eventId={nextEvent.id} />)}>
          <RowBetween>
            <CardTitle>{nextEvent.titre}</CardTitle>
            <Pill variant="gold">{nextEvent.type}</Pill>
          </RowBetween>
          <Muted>{formatDateLong(nextEvent.date)}</Muted>
        </Card>

        {can("viewBudget") ? (
          <>
            <SectionHeader title="Budget global" />
            <Card>
              <RowBetween>
                <View>
                  <Muted>Recettes</Muted>
                  <Text style={{ fontFamily: "Inter_700Bold", color: colors.green }}>{fmt(totalRec)}</Text>
                </View>
                <View>
                  <Muted>Dépenses</Muted>
                  <Text style={{ fontFamily: "Inter_700Bold", color: colors.burgundy }}>{fmt(totalDep)}</Text>
                </View>
                <View>
                  <Muted>Solde</Muted>
                  <Text style={{ fontFamily: "Inter_700Bold", color: colors.ink }}>{fmt(totalRec - totalDep)}</Text>
                </View>
              </RowBetween>
              <Button
                title="Voir le détail par événement"
                variant="outline"
                block
                style={{ marginTop: 12 }}
                onPress={() => router.push("/(tabs)/evenements")}
              />
            </Card>
          </>
        ) : null}

        {can("registerPayment") ? (
          <>
            <SectionHeader title="Collecte des cotisations" />
            <Card>
              <CardTitle>{due} mensualités en attente</CardTitle>
              <Muted>Tous choristes confondus, cotisation statutaire 2026.</Muted>
              <Button
                title="Enregistrer un paiement"
                block
                style={{ marginTop: 12 }}
                onPress={() => openSheet(<QuickPaymentSheet />)}
              />
            </Card>
          </>
        ) : null}

        {can("addSong") ? (
          <>
            <SectionHeader title="Répertoire de chants" />
            <Card>
              <Muted>Dernier chant ajouté</Muted>
              <CardTitle>{lastChant.titre}</CardTitle>
              <Button
                title="Ajouter un chant"
                variant="outline"
                block
                style={{ marginTop: 10 }}
                onPress={() => openSheet(<ChantFormSheet />)}
              />
            </Card>
          </>
        ) : null}

        {can("validateDeleteSong") && pendingChant ? (
          <>
            <SectionHeader title="À valider" />
            <Card>
              <RowBetween>
                <CardTitle>{pendingChant.titre}</CardTitle>
                <Pill variant="pending">Suppression proposée</Pill>
              </RowBetween>
              <Muted>Proposée par la commission musicale.</Muted>
              <Button
                title="Valider la suppression"
                variant="danger"
                block
                style={{ marginTop: 10 }}
                onPress={() => {
                  validateDeleteSong(pendingChant.id)
                  toast("Chant supprimé du répertoire")
                }}
              />
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}
