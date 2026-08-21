import { useState } from "react"
import { ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AppHeader } from "../../components/AppHeader"
import { EventCotisationSheet, PaymentSheet } from "../../components/sheets/CotisationSheets"
import { Card, CardTitle, Chip, Muted, Pill, ProgressBar, RowBetween, Seal, Select } from "../../components/ui"
import { ANNEE, MENSUALITE, MONTHS } from "../../data/mockData"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { fmt } from "../../lib/format"

export default function CotisationsScreen() {
  const { currentUser, chorists, statutaire, events, can } = useApp()
  const { openSheet } = useSheet()
  const [subTab, setSubTab] = useState<"statutaire" | "evenementielle">("statutaire")
  const [viewChoristId, setViewChoristId] = useState(currentUser?.id ?? chorists[0].id)

  if (!currentUser) return null

  const canViewAll = can("viewAllCotisations")
  const viewId = canViewAll ? viewChoristId : currentUser.id
  const viewChorist = chorists.find((c) => c.id === viewId)!
  const canPay = can("registerPayment")
  const paid = statutaire[viewId]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["top"]}>
      <AppHeader title="Cotisations" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 100 }}>
        {canViewAll ? (
          <Select
            label="Afficher la cotisation de"
            value={viewChoristId}
            onChange={setViewChoristId}
            options={chorists.map((c) => ({
              label: c.name + (c.id === currentUser.id ? " (moi)" : ""),
              value: c.id,
            }))}
          />
        ) : null}

        <View style={{ flexDirection: "row", marginTop: canViewAll ? 14 : 0, marginBottom: 4 }}>
          <Chip label="Statutaire" active={subTab === "statutaire"} onPress={() => setSubTab("statutaire")} />
          <Chip label="Événementielle" active={subTab === "evenementielle"} onPress={() => setSubTab("evenementielle")} />
        </View>

        {subTab === "statutaire" ? (
          <View style={{ marginTop: 10 }}>
            <View
              style={{
                backgroundColor: "#fffdf8",
                borderWidth: 1.5,
                borderColor: colors.goldSoft,
                borderRadius: 18,
                padding: 16,
              }}
            >
              <RowBetween style={{ alignItems: "flex-start", marginBottom: 12 }}>
                <View>
                  <Text style={{ fontFamily: "SpaceMono_400Regular", fontSize: 9.5, letterSpacing: 1, color: colors.muted, textTransform: "uppercase" }}>
                    Carte de cotisation
                  </Text>
                  <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 17, color: colors.aubergine, marginTop: 2 }}>
                    {viewChorist.name}
                  </Text>
                </View>
                <Pill variant="gold">{ANNEE}</Pill>
              </RowBetween>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {MONTHS.map((m, i) => {
                  const isPaid = paid[i]
                  const clickable = canPay && !isPaid
                  return (
                    <View key={m} style={{ width: "22%" }}>
                      <Seal
                        month={m}
                        paid={isPaid}
                        clickable={clickable}
                        onPress={() => openSheet(<PaymentSheet chorishId={viewId} monthIndex={i} />)}
                      />
                    </View>
                  )
                })}
              </View>
              <RowBetween style={{ marginTop: 14 }}>
                <Muted>
                  {MENSUALITE.toLocaleString("fr-FR")} FCFA / mois · {paid.filter(Boolean).length}/12 réglés
                </Muted>
              </RowBetween>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 10 }}>
              {canPay
                ? "Touchez un mois non réglé pour enregistrer le paiement."
                : "Touchez une case pour voir le détail. Seuls la Trésorerie et la Commission recette peuvent enregistrer un paiement."}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 6 }}>
            {events.map((ev) => {
              const paidAmt = ev.contributions[viewId] || 0
              const pct = Math.min(100, Math.round((paidAmt / ev.cotisationMontant) * 100))
              const done = paidAmt >= ev.cotisationMontant
              return (
                <Card key={ev.id} onPress={() => openSheet(<EventCotisationSheet eventId={ev.id} chorishId={viewId} />)}>
                  <RowBetween>
                    <CardTitle>{ev.titre}</CardTitle>
                    {done ? <Pill variant="green">Réglé</Pill> : <Pill>{pct}%</Pill>}
                  </RowBetween>
                  <ProgressBar percent={pct} />
                  <Muted>
                    {fmt(paidAmt)} / {fmt(ev.cotisationMontant)}
                  </Muted>
                </Card>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
