// Écran Accueil — design system Harmonix : en-tête marine à cercles, carte « Reste à payer »,
// raccourcis, prochain événement, puis les blocs selon les droits du compte.
// Style en classes NativeWind (tailwind.config.js).
import { router, useFocusEffect } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { CalendarDays, ClipboardCheck, Music, Wallet, type LucideIcon } from "lucide-react-native"
import { useCallback, useEffect, useState } from "react"
import { Image, Text, View, type ImageSourcePropType } from "react-native"

import { Screen, useResponsive } from "../../components/layout"
import { ChantFormSheet } from "../../components/sheets/ChantSheets"
import { QuickPaymentSheet } from "../../components/sheets/CotisationSheets"
import { EventDetailSheet } from "../../components/sheets/EventSheets"
import { NotificationButton } from "../../components/notifications/NotificationButton"
import { ConnectionRing, OfflineLabel, SyncButton, useConnectionRing } from "../../components/sync"
import {
  Button,
  Card,
  CardTitle,
  cx,
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
import * as api from "../../lib/api"
import { eventBilan, fmt, formatDateLong, nextEvent as findNextEvent, upcomingEvents } from "../../lib/format"
import type { Evenement } from "../../types"

/** Nom affiché sous le petit libellé « Chorale », sans répéter le mot s'il ouvre déjà le nom. */
function nomSansPrefixe(nom: string) {
  return nom.trim().replace(/^chorale\s+/i, "") || nom
}

/** Logo de la chorale (Paramètres du portail web), sinon le glyphe Music. */
function LogoChorale({ version, nom }: { version: string | null; nom: string }) {
  const [source, setSource] = useState<ImageSourcePropType | null>(null)
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    let actif = true
    setSource(null)
    setErreur(false)
    if (version) void api.logoSource(version).then((s) => actif && setSource(s))
    return () => {
      actif = false
    }
  }, [version])

  if (source && !erreur) {
    return (
      <Image
        source={source}
        onError={() => setErreur(true)}
        accessibilityLabel={`Logo de ${nom}`}
        resizeMode="contain"
        className="h-[47px] w-[47px] rounded-full bg-paper"
      />
    )
  }
  return (
    <View className="h-[47px] w-[47px] items-center justify-center rounded-full bg-on-navy-fill">
      <Music size={20} color={colors.gold} strokeWidth={1.75} />
    </View>
  )
}

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

/** Carte d'un événement de l'accueil : date, titre, cotisation ou date longue, type ; S'inscrire si ouvert. */
function CarteEvenement({ ev, onOuvrir, onInscription }: { ev: Evenement; onOuvrir: () => void; onInscription: (inscrire: boolean) => void }) {
  return (
    <Card onPress={onOuvrir} accessibilityLabel={`${ev.titre}, ${formatDateLong(ev.date)}`}>
      <View className="flex-row items-center gap-3">
        <DateTile iso={ev.date} />
        <View className="min-w-0 flex-1">
          <CardTitle className="mb-0.5">{ev.titre}</CardTitle>
          <Muted className="tabular-nums">{formatDateLong(ev.date)}</Muted>
          {ev.cotisationMontant > 0 ? <Muted className="tabular-nums">Cotisation : {fmt(ev.cotisationMontant)}</Muted> : null}
        </View>
        <Pill variant="gold">{ev.type}</Pill>
      </View>
      {ev.inscrit || ev.inscriptionsOuvertes ? (
        <Button
          title={ev.inscrit ? "Se désinscrire" : "S'inscrire"}
          variant={ev.inscrit ? "outline" : "primary"}
          small
          className="mt-3"
          onPress={() => onInscription(!ev.inscrit)}
        />
      ) : null}
    </Card>
  )
}

export default function HomeScreen() {
  const { currentUser, statutaire, nonDu, events, chants, can, annee, mensualite, choraleNom, parametres, toggleInscription } = useApp()
  const { toast } = useToast()
  const connexion = useConnectionRing()
  const { openSheet } = useSheet()
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
  // Mois antérieurs à l'adhésion : non dus, hors du reste à payer (comme sur le web).
  const mesNonDus = (nonDu[currentUser.id] ?? []).filter((n, i) => n && !statutaire[currentUser.id]?.[i]).length
  const resteAPayer = Math.max(0, 12 - mesNonDus - myPaid) * mensualite
  const firstName = currentUser.name.split(" ")[0]
  const next = findNextEvent(events)

  // Bandeau marine (motif de cercles) + carte blanche « Reste à payer » qui le chevauche.
  const hero = (
    <View>
      <View className="relative overflow-hidden bg-navy pb-16 pt-3">
        <NavyCircles />
        <View className="w-full flex-row items-center gap-3 self-center" style={{ maxWidth, paddingHorizontal: gutter }}>
          {/* Logo rond : anneau vert 5 s quand l'app est connectée, rouge tant qu'elle est hors ligne. */}
          <ConnectionRing status={connexion}>
            <LogoChorale version={parametres.logoVersion} nom={choraleNom} />
          </ConnectionRing>
          <View className="min-w-0 flex-1">
            <Text className="font-sans text-[13px] text-on-navy-muted">Chorale</Text>
            <Text accessibilityRole="header" numberOfLines={2} className="font-sans-semibold text-[20px] tracking-[-0.4px] text-paper">
              {nomSansPrefixe(choraleNom)}
            </Text>
            <OfflineLabel status={connexion} className="mt-1" />
          </View>
          {/* Actions de l'en-tête : la cloche (la plus utilisée) au bord droit, sous le pouce ;
              la synchro, secondaire (le geste « tirer pour actualiser » fait la même chose), à sa gauche. */}
          <View className="flex-row items-center gap-2">
            <SyncButton light />
            <NotificationButton light />
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
          <Text numberOfLines={1} className="mb-1 font-sans-semibold text-[16px] tracking-[-0.2px] text-ink">
            Bonjour, {firstName}
          </Text>
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

  const due = Object.entries(statutaire)
    .flatMap(([id, mois]) => mois.map((p, i) => !p && !nonDu[Number(id)]?.[i]))
    .filter(Boolean).length

  const recentChant = chants[chants.length - 1]

  // Choriste, commission musicale… (ni budget ni encaissement) : l'accueil a peu de blocs,
  // on y montre les 4 prochains événements plutôt qu'un seul.
  const vueChoriste = !can("budget") && !can("paiements")
  const prochains = vueChoriste ? upcomingEvents(events, 4) : next ? [next] : []
  const inscription = (eventId: number, inscrire: boolean) =>
    toggleInscription(eventId, inscrire)
      .then(() => toast(inscrire ? "Inscription enregistrée" : "Désinscription enregistrée"))
      .catch((e) => toast(errorMessage(e)))

  return (
    <Screen title="Accueil" hero={hero}>
      {/* Raccourcis */}
      <View className="mt-4 flex-row gap-3">
        <QuickTile icon={Wallet} label="Cotisations" onPress={() => router.push("/(tabs)/cotisations")} />
        {/* Rôles « présences » : faire l'appel ; les événements restent dans la barre d'onglets. */}
        {can("presences") ? (
          <QuickTile icon={ClipboardCheck} label="Présence" onPress={() => router.push("/presences")} />
        ) : (
          <QuickTile icon={CalendarDays} label="Événements" onPress={() => router.push("/(tabs)/evenements")} />
        )}
        <QuickTile icon={Music} label="Répertoire" onPress={() => router.push("/(tabs)/chants")} />
      </View>

      {/* Prochain(s) événement(s) : 4 pour la vue choriste, 1 pour les rôles financiers. */}
      {prochains.length > 0 ? (
        <>
          <SectionHeader title={prochains.length > 1 ? "Prochains événements" : "Prochain événement"} />
          {prochains.map((ev) => (
            <CarteEvenement
              key={ev.id}
              ev={ev}
              onOuvrir={() => openSheet(<EventDetailSheet eventId={ev.id} />)}
              onInscription={(inscrire) => inscription(ev.id, inscrire)}
            />
          ))}
          {vueChoriste ? (
            <Button title="Voir tous les événements" variant="ghost" block onPress={() => router.push("/(tabs)/evenements")} />
          ) : null}
        </>
      ) : vueChoriste ? (
        <>
          <SectionHeader title="Prochains événements" />
          <Card>
            <Muted>Aucun événement à venir pour le moment.</Muted>
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
    </Screen>
  )
}
