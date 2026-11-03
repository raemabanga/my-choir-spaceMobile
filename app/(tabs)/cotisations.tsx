import { useState } from "react"
import { Text, View } from "react-native"

import { Screen } from "../../components/layout"
import { EventCotisationSheet, PaymentSheet } from "../../components/sheets/CotisationSheets"
import { Card, CardTitle, Chip, ChipsRow, Muted, Pill, ProgressBar, RowBetween, Seal, Select } from "../../components/ui"
import { shadows } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { ANNEE, MENSUALITE, MONTHS } from "../../data/mockData"
import { fmt } from "../../lib/format"

/** Montant secondaire en Geist Mono (12,5px, couleur muted) ; pas via <Numeric> pour éviter un conflit text-[13px]/text-ink. */
const MUTED_NUM = "font-mono-medium text-[12.5px] tabular-nums text-ink-light"

export default function CotisationsScreen() {
  const { currentUser, chorists, statutaire, events, can } = useApp()
  const { openSheet } = useSheet()
  const [subTab, setSubTab] = useState<"statutaire" | "evenementielle">("statutaire")
  const [viewChoristId, setViewChoristId] = useState(currentUser?.id ?? chorists[0].id)

  if (!currentUser) return null

  const canViewAll = can("cotisations")
  const viewId = canViewAll ? viewChoristId : currentUser.id
  const viewChorist = chorists.find((c) => c.id === viewId)!
  const canPay = can("paiements")
  const paid = statutaire[viewId]
  const paidCount = paid.filter(Boolean).length

  // Grille 4 colonnes (.seals) : 3 rangées de 4 cases flex-1, gap 10px, cases plafonnées à 96px (tablette).
  const rows = [0, 1, 2].map((r) => MONTHS.slice(r * 4, r * 4 + 4).map((m, j) => ({ m, i: r * 4 + j })))

  return (
    <Screen title="Cotisations">
      {canViewAll ? (
        // label.field:first-child → pas de marge haute.
        <View className="mb-3">
          <Select
            first
            label="Afficher la cotisation de"
            value={viewChoristId}
            onChange={setViewChoristId}
            options={chorists.map((c) => ({
              label: c.name + (c.id === currentUser.id ? " (moi)" : ""),
              value: c.id,
            }))}
          />
        </View>
      ) : null}

      <ChipsRow>
        <Chip label="Statutaire" active={subTab === "statutaire"} onPress={() => setSubTab("statutaire")} />
        <Chip label="Événementielle" active={subTab === "evenementielle"} onPress={() => setSubTab("evenementielle")} />
      </ChipsRow>

      {subTab === "statutaire" ? (
        <>
          {/* .cardstock (bloc Refonte) — ombre en style (non exprimable en classe). */}
          <View className="mb-3.5 rounded-card border border-line bg-paper px-4 pb-3.5 pt-[18px]" style={shadows.card}>
            <View className="mb-3 flex-row items-start justify-between gap-2.5">
              <View className="min-w-0 flex-1">
                <Text className="font-mono text-[9.5px] uppercase tracking-[1px] text-ink-light">Carte de cotisation</Text>
                <Text className="mt-0.5 font-sans-semibold text-[17px] tracking-[-0.2px] text-navy">{viewChorist.name}</Text>
              </View>
              <Pill variant="gold">{String(ANNEE)}</Pill>
            </View>

            <View className="gap-2.5">
              {rows.map((row, r) => (
                <View key={r} className="flex-row gap-2.5">
                  {row.map(({ m, i }) => {
                    const isPaid = paid[i]
                    const clickable = canPay && !isPaid
                    return (
                      <View key={m} className="min-w-0 flex-1 items-center">
                        <View className="w-full max-w-[96px]">
                          <Seal
                            month={m}
                            paid={isPaid}
                            clickable={clickable}
                            onPress={() => openSheet(<PaymentSheet chorishId={viewId} monthIndex={i} />)}
                          />
                        </View>
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>

            <RowBetween className="mt-3.5">
              <Muted className="tabular-nums">
                <Text className="font-mono-medium tabular-nums">{MENSUALITE.toLocaleString("fr-FR")}</Text> FCFA / mois ·{" "}
                <Text className="font-mono-medium tabular-nums">{paidCount}/12</Text> réglés
              </Muted>
            </RowBetween>
          </View>

          <Muted className="text-center">
            {canPay
              ? "Touchez un mois non réglé pour enregistrer le paiement."
              : "Touchez une case pour voir le détail. Seuls la Trésorerie et la Commission recette peuvent enregistrer un paiement."}
          </Muted>
        </>
      ) : (
        events.map((ev) => {
          const paidAmt = ev.contributions[viewId] || 0
          const pct = Math.min(100, Math.round((paidAmt / ev.cotisationMontant) * 100))
          const done = paidAmt >= ev.cotisationMontant
          return (
            <Card
              key={ev.id}
              accessibilityLabel={`${ev.titre}, ${done ? "réglé" : pct + " %"}`}
              onPress={() => openSheet(<EventCotisationSheet eventId={ev.id} chorishId={viewId} />)}
            >
              <RowBetween>
                <View className="min-w-0 flex-1">
                  <CardTitle>{ev.titre}</CardTitle>
                </View>
                {done ? <Pill variant="green">Réglé</Pill> : <Pill>{`${pct}%`}</Pill>}
              </RowBetween>
              <ProgressBar percent={pct} />
              <Muted>
                <Text className={MUTED_NUM}>{fmt(paidAmt)}</Text> / <Text className={MUTED_NUM}>{fmt(ev.cotisationMontant)}</Text>
              </Muted>
            </Card>
          )
        })
      )}
    </Screen>
  )
}
