// Écran Accueil — design system My Choir Space : en-tête marine à cercles, carte « Reste à payer »,
// raccourcis, prochain événement, puis les blocs selon les droits du compte.
// Style en classes NativeWind (tailwind.config.js).
import { router, useFocusEffect } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { CalendarDays, Music, Wallet, type LucideIcon } from "lucide-react-native"
import { useCallback } from "react"
import { Text, View } from "react-native"

import { Screen, useResponsive } from "../../components/layout"
import { ChantFormSheet } from "../../components/sheets/ChantSheets"
import { QuickPaymentSheet } from "../../components/sheets/CotisationSheets"
import { EventDetailSheet } from "../../components/sheets/EventSheets"
import {
  Button,
  Card,
  CardTitle,
  cx,
  initials,
  Muted,
  NavyCircles,
  Numeric,
  Pill,
  PressableScale,
  ProgressBar,
  RowBetween,
  SectionHeader,
} from "../../components/ui"
import { colors, shadows } from "../../constants/theme"
import { errorMessage, useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { eventBilan, fmt, formatDateLong, nextEvent as findNextEvent } from "../../lib/format"

/** Colonne libellé / montant du bloc « Budget global ». `colorClassName` : couleur du montant. */
function BudgetStat({ label, amount, colorClassName = "text-ink" }: { label: string; amount: number; colorClassName?: string }) {
  return (
    <View className="shrink">
      <Muted>{label}</Muted>
      <Numeric className={cx("font-sans-semibold text-[14px]", colorClassName)}>{fmt(amount)}</Numeric>
    </View>
  )
}

/** Raccourci de l'accueil : tuile blanche, icône dans un carré turquoise doux, libellé. */
function QuickTile({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <PressableScale
      scale={0.97}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-[88px] flex-1 items-center justify-center gap-2 rounded-card border border-line bg-paper px-2 py-3"
      style={shadows.card}
    >
      <View className="h-10 w-10 items-center justify-center rounded-tile bg-gold-soft">
        <Icon size={20} color={colors.goldStrong} strokeWidth={1.75} />
      </View>
      <Text numberOfLines={1} className="font-sans-medium text-[13px] text-ink">
        {label}
      </Text>
    </PressableScale>
  )
}

/** Tuile de date « 20 / DÉC. » des événements. */
function DateTile({ iso }: { iso: string }) {
  const d = iso ? new Date(iso) : null
  return (
    <View className="h-14 w-14 items-center justify-center rounded-tile bg-primary-soft">
      {d ? (
        <>
          <Text className="font-sans-semibold text-[20px] leading-[22px] tabular-nums text-navy">{d.getDate()}</Text>
          <Text className="font-sans-semibold text-[10px] uppercase tracking-[0.6px] text-navy">
            {d.toLocaleDateString("fr-FR", { month: "short" })}
          </Text>
        </>
      ) : (
        <CalendarDays size={20} color={colors.navy} strokeWidth={1.75} />
      )}
    </View>
  )
}

export default function HomeScreen() {
  const { currentUser, statutaire, events, chants, can, deleteSong, annee, mensualite } = useApp()
  const { openSheet } = useSheet()
  const { toast } = useToast()
  const { gutter, maxWidth } = useResponsive()

  // En-tête marine : barre d'état en clair tant que l'accueil est affiché.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setStyle("light")
      return () => StatusBar.setStyle("dark")
    }, [])
  )

  if (!currentUser) return null

  const myPaid = (statutaire[currentUser.id] ?? []).filter(Boolean).length
  const resteAPayer = Math.max(0, 12 - myPaid) * mensualite
  const firstName = currentUser.name.split(" ")[0]
  const next = findNextEvent(events)

  // Bandeau marine (motif de cercles) + carte blanche « Reste à payer » qui le chevauche.
  const hero = (
    <View>
      <View className="relative overflow-hidden bg-navy pb-16 pt-3">
        <NavyCircles />
        <View className="w-full flex-row items-center gap-3 self-center" style={{ maxWidth, paddingHorizontal: gutter }}>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-on-navy-fill">
            <Text className="font-sans-semibold text-[14px] text-luna-100">{initials(currentUser.name)}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-sans text-[13px] text-on-navy-muted">Bonjour,</Text>
            <Text accessibilityRole="header" numberOfLines={1} className="font-sans-semibold text-[20px] tracking-[-0.4px] text-paper">
              {firstName}
            </Text>
          </View>
        </View>
      </View>
      <View className="-mt-12 w-full self-center" style={{ maxWidth, paddingHorizontal: gutter }}>
        <PressableScale
          scale={0.98}
          onPress={() => router.push("/(tabs)/cotisations")}
          accessibilityRole="button"
          accessibilityLabel={`Reste à payer en ${annee} : ${fmt(resteAPayer)}. Ouvrir ma carte de cotisation`}
          className="rounded-card border border-line bg-paper p-4"
          style={shadows.hero}
        >
          <Muted>Reste à payer en {annee}</Muted>
          <Text className="mt-1 font-sans-semibold text-[30px] leading-[34px] tracking-[-0.6px] tabular-nums text-ink">
            {resteAPayer.toLocaleString("fr-FR")}
            <Text className="font-sans-medium text-[15px] tracking-normal text-ink-light"> FCFA</Text>
          </Text>
          <ProgressBar percent={(myPaid / 12) * 100} />
          <RowBetween>
            <Muted className="tabular-nums">
              {myPaid} / 12 mois payés
            </Muted>
            <Muted className="tabular-nums">{mensualite.toLocaleString("fr-FR")} FCFA / mois</Muted>
          </RowBetween>
        </PressableScale>
      </View>
    </View>
  )

  const totalRec = events.reduce((s, e) => s + eventBilan(e).recettes, 0)
  const totalDep = events.reduce((s, e) => s + eventBilan(e).validees, 0)

  const due = Object.values(statutaire)
    .flat()
    .filter((p) => !p).length

  const recentChant = chants[chants.length - 1]
  const pendingChant = chants.find((c) => c.statut === "a_valider")

  return (
    <Screen title="Accueil" hero={hero}>
      {/* Raccourcis */}
      <View className="mt-4 flex-row gap-3">
        <QuickTile icon={Wallet} label="Cotisations" onPress={() => router.push("/(tabs)/cotisations")} />
        <QuickTile icon={CalendarDays} label="Événements" onPress={() => router.push("/(tabs)/evenements")} />
        <QuickTile icon={Music} label="Répertoire" onPress={() => router.push("/(tabs)/chants")} />
      </View>

      {/* Prochain événement */}
      {next ? (
        <>
          <SectionHeader title="Prochain événement" />
          <Card onPress={() => openSheet(<EventDetailSheet eventId={next.id} />)} accessibilityLabel={`Prochain événement : ${next.titre}`}>
            <View className="flex-row items-center gap-3">
              <DateTile iso={next.date} />
              <View className="min-w-0 flex-1">
                <CardTitle className="mb-0.5">{next.titre}</CardTitle>
                <Muted className="tabular-nums">
                  {next.cotisationMontant > 0 ? `Cotisation : ${fmt(next.cotisationMontant)}` : formatDateLong(next.date)}
                </Muted>
              </View>
              <Pill variant="gold">{next.type}</Pill>
            </View>
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
              <Text className="font-sans-medium tabular-nums">{due}</Text> mensualités en attente
            </CardTitle>
            <Muted>Tous choristes confondus, cotisation statutaire {annee}.</Muted>
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
                deleteSong(pendingChant.id)
                  .then(() => toast("Chant supprimé du répertoire"))
                  .catch((e) => toast(errorMessage(e)))
              }}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  )
}
