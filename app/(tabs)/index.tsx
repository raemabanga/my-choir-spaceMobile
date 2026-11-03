// Écran Accueil — conforme à renderHome() du prototype cantoria-app-mobile-v2.html.
// Style en classes NativeWind (tailwind.config.js).
import { router } from "expo-router"
import { Text, View } from "react-native"

import { Screen } from "../../components/layout"
import { ChantFormSheet } from "../../components/sheets/ChantSheets"
import { QuickPaymentSheet } from "../../components/sheets/CotisationSheets"
import { EventDetailSheet } from "../../components/sheets/EventSheets"
import { Button, Card, CardTitle, cx, Muted, Numeric, Pill, ProgressBar, RowBetween, SectionHeader } from "../../components/ui"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { ANNEE } from "../../data/mockData"
import { eventBilan, fmt, formatDateLong, nextEvent as findNextEvent } from "../../lib/format"

/** Colonne libellé / montant du bloc « Budget global ». `colorClassName` : couleur du montant. */
function BudgetStat({ label, amount, colorClassName = "text-ink" }: { label: string; amount: number; colorClassName?: string }) {
  return (
    <View className="shrink">
      <Muted>{label}</Muted>
      <Numeric className={cx("font-mono-semibold", colorClassName)}>{fmt(amount)}</Numeric>
    </View>
  )
}

export default function HomeScreen() {
  const { currentUser, statutaire, events, chants, can, validateDeleteSong } = useApp()
  const { openSheet } = useSheet()
  const { toast } = useToast()

  if (!currentUser) return null

  const myPaid = statutaire[currentUser.id].filter(Boolean).length
  const firstName = currentUser.name.split(" ")[0]
  const next = findNextEvent(events)

  const totalRec = events.reduce((s, e) => s + eventBilan(e).recettes, 0)
  const totalDep = events.reduce((s, e) => s + eventBilan(e).validees, 0)

  const due = Object.values(statutaire)
    .flat()
    .filter((p) => !p).length

  const recentChant = chants[chants.length - 1]
  const pendingChant = chants.find((c) => c.statut === "a_valider")

  return (
    <Screen title="Accueil">
      {/* Carte sombre : salutation + ma cotisation */}
      <Card tint>
        <Muted light>Bonjour,</Muted>
        <CardTitle light>{firstName}</CardTitle>
        <RowBetween className="mt-2.5">
          <View>
            <Muted light>Cotisation {ANNEE}</Muted>
            <Text className="font-sans text-[20px] tabular-nums text-paper">{myPaid}/12 mois</Text>
          </View>
          <Button title="Ma carte →" variant="gold" small onPress={() => router.push("/(tabs)/cotisations")} />
        </RowBetween>
        <ProgressBar percent={(myPaid / 12) * 100} light />
      </Card>

      {/* Prochain événement */}
      {next ? (
        <>
          <SectionHeader title="Prochain événement" />
          <Card onPress={() => openSheet(<EventDetailSheet eventId={next.id} />)} accessibilityLabel={`Prochain événement : ${next.titre}`}>
            <RowBetween>
              <CardTitle className="shrink">{next.titre}</CardTitle>
              <Pill variant="gold">{next.type}</Pill>
            </RowBetween>
            <Muted className="font-mono-medium tabular-nums">{formatDateLong(next.date)}</Muted>
          </Card>
        </>
      ) : null}

      {/* Budget global */}
      {can("budget") ? (
        <>
          <SectionHeader title="Budget global" />
          <Card>
            <RowBetween>
              <BudgetStat label="Recettes" amount={totalRec} colorClassName="text-success" />
              <BudgetStat label="Dépenses" amount={totalDep} colorClassName="text-danger" />
              <BudgetStat label="Solde" amount={totalRec - totalDep} />
            </RowBetween>
            <Button title="Voir le détail par événement" variant="outline" block className="mt-3" onPress={() => router.push("/(tabs)/evenements")} />
          </Card>
        </>
      ) : null}

      {/* Collecte des cotisations */}
      {can("paiements") ? (
        <>
          <SectionHeader title="Collecte des cotisations" />
          <Card>
            <CardTitle>
              <Text className="font-mono-medium tabular-nums">{due}</Text> mensualités en attente
            </CardTitle>
            <Muted>Tous choristes confondus, cotisation statutaire {ANNEE}.</Muted>
            <Button title="Enregistrer un paiement" variant="primary" block className="mt-3" onPress={() => openSheet(<QuickPaymentSheet />)} />
          </Card>
        </>
      ) : null}

      {/* Répertoire de chants */}
      {can("chantsCreer") ? (
        <>
          <SectionHeader title="Répertoire de chants" />
          <Card>
            <Muted>Dernier chant ajouté</Muted>
            {recentChant ? <CardTitle>{recentChant.titre}</CardTitle> : null}
            <Button title="Ajouter un chant" variant="outline" block className="mt-2.5" onPress={() => openSheet(<ChantFormSheet />)} />
          </Card>
        </>
      ) : null}

      {/* À valider */}
      {can("chantsGerer") && pendingChant ? (
        <>
          <SectionHeader title="À valider" />
          <Card>
            <RowBetween>
              <CardTitle className="shrink">{pendingChant.titre}</CardTitle>
              <Pill variant="pending">Suppression proposée</Pill>
            </RowBetween>
            <Muted>Proposée par la commission musicale.</Muted>
            <Button
              title="Valider la suppression"
              variant="danger"
              block
              className="mt-2.5"
              onPress={() => {
                validateDeleteSong(pendingChant.id)
                toast("Chant supprimé du répertoire")
              }}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  )
}
