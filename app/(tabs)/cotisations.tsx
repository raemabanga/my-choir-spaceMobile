import { ChevronLeft, ChevronRight } from "lucide-react-native"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"

import { Screen } from "../../components/layout"
import { EventCotisationSheet, PaymentSheet } from "../../components/sheets/CotisationSheets"
import { Card, CardTitle, Chip, ChipsRow, cx, Muted, Pill, ProgressBar, RowBetween, Seal, Select } from "../../components/ui"
import { colors, shadows } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { MONTHS } from "../../data/mockData"
import { fmt } from "../../lib/format"

/** Montant secondaire en Geist Mono (12,5px, couleur muted) ; pas via <Numeric> pour éviter un conflit text-[13px]/text-ink. */
const MUTED_NUM = "font-sans-medium text-[12.5px] tabular-nums text-ink-light"

/** Flèche du sélecteur d'exercice ; grisée quand il n'y a pas d'année avant / après. */
function YearArrow({ direction, target, onPress }: { direction: "prev" | "next"; target: number | null; onPress: (annee: number) => void }) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight
  const disabled = target === null
  return (
    <Pressable
      disabled={disabled}
      onPress={() => target !== null && onPress(target)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={direction === "prev" ? "Exercice précédent" : "Exercice suivant"}
      accessibilityState={{ disabled }}
      className={cx("h-7 w-7 items-center justify-center rounded-full", disabled && "opacity-30")}
    >
      <Icon size={18} color={colors.navy} />
    </Pressable>
  )
}

export default function CotisationsScreen() {
  const { currentUser, chorists, statutaireParAnnee, anneesStatutaire, events, can, mensualite, annee: anneeCourante } = useApp()
  const { openSheet } = useSheet()
  const [subTab, setSubTab] = useState<"statutaire" | "evenementielle">("statutaire")
  const [viewChoristId, setViewChoristId] = useState(currentUser?.id ?? chorists[0].id)
  // Exercice affiché (null : année en cours, qui suit le passage au 1er janvier). Comme sur le web.
  const [anneeChoisie, setAnneeChoisie] = useState<number | null>(null)

  if (!currentUser) return null

  const annee = anneeChoisie !== null && anneesStatutaire.includes(anneeChoisie) ? anneeChoisie : anneeCourante
  const idx = anneesStatutaire.indexOf(annee)
  const anneePrec = idx > 0 ? anneesStatutaire[idx - 1] : null
  const anneeSuiv = idx >= 0 && idx < anneesStatutaire.length - 1 ? anneesStatutaire[idx + 1] : null
  const choisir = (a: number) => setAnneeChoisie(a === anneeCourante ? null : a)

  const canViewAll = can("cotisations")
  const viewId = canViewAll ? viewChoristId : currentUser.id
  const viewChorist = chorists.find((c) => c.id === viewId) ?? currentUser
  const canPay = can("paiements")
  const paid = statutaireParAnnee[annee]?.[viewId] ?? Array<boolean>(12).fill(false)
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
                <Text className="font-sans-semibold text-[11px] uppercase tracking-[0.66px] text-ink-light">Carte de cotisation</Text>
                <Text className="mt-0.5 font-sans-semibold text-[17px] tracking-[-0.2px] text-navy">{viewChorist.name}</Text>
              </View>
              {/* Sélecteur d'exercice : ‹ année › (années ayant des cotisations, et l'année en cours). */}
              <View className="flex-row items-center gap-1">
                <YearArrow direction="prev" target={anneePrec} onPress={choisir} />
                <Pill variant="gold">{String(annee)}</Pill>
                <YearArrow direction="next" target={anneeSuiv} onPress={choisir} />
              </View>
            </View>
            {annee !== anneeCourante ? (
              <Muted className="-mt-1 mb-2.5">
                Exercice <Text className="font-sans-medium tabular-nums">{annee}</Text> ·{" "}
                <Text className="font-sans-semibold text-navy" onPress={() => choisir(anneeCourante)}>
                  revenir à {anneeCourante}
                </Text>
              </Muted>
            ) : null}

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
                            onPress={() => openSheet(<PaymentSheet chorishId={viewId} monthIndex={i} year={annee} />)}
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
                <Text className="font-sans-medium tabular-nums">{mensualite.toLocaleString("fr-FR")}</Text> FCFA / mois ·{" "}
                <Text className="font-sans-medium tabular-nums">{paidCount}/12</Text> réglés
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
          // Cotisation à 0 (événement sans collecte) : considérée comme réglée.
          const pct = ev.cotisationMontant > 0 ? Math.min(100, Math.round((paidAmt / ev.cotisationMontant) * 100)) : 100
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
