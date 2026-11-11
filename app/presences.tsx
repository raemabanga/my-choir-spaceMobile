// Écran « Présences » : faire l'appel d'une répétition, d'un culte (plusieurs par jour) ou d'un événement, et historique des feuilles.
// Équivalent mobile du module Présences du portail web (sans les statistiques). Marche hors ligne :
// la feuille est enregistrée sur le téléphone puis envoyée en entier (PUT /espace/presences/feuille).

import { useLocalSearchParams, usePreventRemove } from "expo-router"
import { CalendarDays, Check, ClipboardCheck, Clock3, Lock, Plus, Users } from "lucide-react-native"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, BackHandler, Pressable, RefreshControl, Text, View } from "react-native"
import { KeyboardAwareScrollView } from "../components/keyboard"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { BackHeader } from "../components/AppHeader"
import { DateField } from "../components/DateField"
import { Container } from "../components/layout"
import {
  ChoixCulte,
  ExcuseSheet,
  NouvelAppelSheet,
  premierCulteLibre,
  seanceDeEvenement,
  seanceDuJour,
  seancePrioritaire,
  totauxSeance,
  type CleAppel,
} from "../components/sheets/PresenceSheets"
import { OfflineBanner, RecordSyncBadge } from "../components/sync"
import {
  Avatar,
  Button,
  Card,
  CardTitle,
  Chip,
  ChipsRow,
  cx,
  EmptyState,
  Field,
  Muted,
  Pill,
  PressableScale,
  ProgressBar,
  RowBetween,
  SearchBar,
  Select,
} from "../components/ui"
import { colors, shadows } from "../constants/theme"
import { errorMessage, useApp } from "../context/AppContext"
import { parId } from "../context/choraleData"
import { useSheet } from "../context/SheetContext"
import { useToast } from "../context/ToastContext"
import { useOfflineCollection } from "../hooks/offline"
import { NUMERO_CULTE_MAX, nomCulte, type StatutPresence, type TypeSeance } from "../lib/api"
import { formatDateLong, formatDateShort, localISODate, MONTHS, parseLocalISODate, todayLocalISO } from "../lib/format"
import { syncManager, type OfflineRecord } from "../lib/offline"
import { evenementRepository, numeroSeance, presenceMembreRepository, seanceRepository, type SeanceData } from "../lib/offline/entities"
import type { Evenement } from "../types"

/** « liste » : les séances (écran d’arrivée) ; « appel » : la feuille d’une séance. */
type Vue = "appel" | "liste"
type Filtre = "tous" | "presents" | "excuses" | "absents"
type FiltreHistorique = "toutes" | "repetitions" | "cultes" | "evenements"

const TYPE_FILTRE: Record<Exclude<FiltreHistorique, "toutes">, TypeSeance> = {
  repetitions: "REPETITION",
  cultes: "CULTE",
  evenements: "EVENEMENT",
}
type Ligne = { statut: StatutPresence; motif: string | null }
type Brouillon = Map<number, Ligne>
/** Clé d'une feuille : la répétition d'un jour, un culte (jour et numéro), ou un événement (sa date n'en fait pas partie). */
type Cle = Exclude<CleAppel, { type: "EVENEMENT" }> | { type: "EVENEMENT"; eventId: number | null }
/** Clé de recherche d'une feuille (événement déjà retrouvé). */
type Recherche = Exclude<CleAppel, { type: "EVENEMENT" }> | { type: "EVENEMENT"; ev: Evenement | undefined }

const ABSENT: Ligne = { statut: "ABSENT", motif: null }

/** Historique : date décroissante, puis dernier enregistrement. Constante de module : tri stable pour useOfflineCollection. */
const TRI_SEANCES = (a: OfflineRecord<SeanceData>, b: OfflineRecord<SeanceData>) =>
  b.data.date.localeCompare(a.data.date) || (b.data.majLe ?? "").localeCompare(a.data.majLe ?? "")

const ACCES_RESERVE =
  "La prise des présences est réservée au bureau exécutif, au secrétariat, à la commission recette et à la commission présence."

/** Minuscules sans accents, pour la recherche. */
const plat = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

const LIBELLE_STATUT: Record<StatutPresence, string> = { PRESENT: "présent", EXCUSE: "excusé", ABSENT: "absent" }

/** Identifiants serveur et local d'un événement affiché (identifiant négatif : pas encore envoyé). */
const refEvenement = (ev: Evenement) => ({ serverId: ev.id > 0 ? ev.id : null, localId: ev.localId ?? null })

/** Feuille du téléphone correspondant à une clé (null : appel pas encore fait). */
function trouverSeance(seances: OfflineRecord<SeanceData>[], cle: Recherche) {
  if (cle.type === "EVENEMENT") return cle.ev ? seanceDeEvenement(seances, refEvenement(cle.ev)) : null
  return seanceDuJour(seances, cle)
}

/** Clé de recherche d'une clé d'écran (l'événement est retrouvé par son identifiant). */
function versRecherche(cle: Cle, events: Evenement[]): Recherche {
  if (cle.type !== "EVENEMENT") return cle
  return { type: "EVENEMENT", ev: cle.eventId != null ? parId(events, cle.eventId) : undefined }
}

/** Jour d'un événement pour sa feuille : jamais dans le futur (l'API refuserait l'envoi). */
function jourEvenement(ev: Evenement | undefined) {
  const aujourdhui = todayLocalISO()
  return ev?.date && ev.date.slice(0, 10) <= aujourdhui ? ev.date.slice(0, 10) : aujourdhui
}

/** Lien vers l'événement d'une feuille : identifiant serveur, sinon identifiant local (même règle qu'AppContext). */
function lienEvenement(ev: Evenement) {
  const record = ev.localId ? evenementRepository.getByLocalId(ev.localId) : null
  if (!record) throw new Error("Cet événement n'existe plus.")
  return record.serverId != null
    ? { evenementId: Number(record.serverId), evenementLocalId: null }
    : { evenementId: null, evenementLocalId: record.localId }
}

export default function PresencesScreen() {
  const { can, events, currentUser } = useApp()
  const { openSheet } = useSheet()
  const { toast } = useToast()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ vue?: string; type?: string; date?: string; numero?: string; evenementId?: string }>()
  const autorise = can("presences")

  const [vue, setVue] = useState<Vue>(params.vue === "appel" ? "appel" : "liste")
  const [refreshing, setRefreshing] = useState(false)

  /* ------------------------------ Données du téléphone ------------------------------ */

  const { items: seances } = useOfflineCollection(seanceRepository)
  const { items: membres } = useOfflineCollection(presenceMembreRepository)
  const { items: historique } = useOfflineCollection(seanceRepository, { sort: TRI_SEANCES })

  /** Événements proposés : passés, du jour ou sans date, du plus récent au plus ancien. */
  const evenementsAppel = useMemo(() => {
    const aujourdhui = todayLocalISO()
    return events
      .filter((e) => !e.date || e.date.slice(0, 10) <= aujourdhui)
      .sort((a, b) => (!a.date ? 1 : !b.date ? -1 : b.date.localeCompare(a.date)))
  }, [events])
  const evenementParDefaut = evenementsAppel.find((e) => e.date) ?? evenementsAppel[0]
  /** Événement demandé par la fiche d'un événement (identifiant négatif : créé hors ligne). */
  const evenementDemande = params.evenementId ? parId(events, Number(params.evenementId)) : undefined

  /* ------------------------------ Feuille en cours ------------------------------ */

  const [type, setType] = useState<TypeSeance>(params.type === "evenement" ? "EVENEMENT" : params.type === "culte" ? "CULTE" : "REPETITION")
  /** Jour de la répétition ou du culte (partagé : passer de l'un à l'autre garde le jour). */
  const [dateJour, setDateJour] = useState(() =>
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayLocalISO()
  )
  /** Numéro du culte dans la journée (1 à 5). */
  const [numero, setNumero] = useState(() => {
    const n = Number(params.numero)
    return Number.isInteger(n) && n >= 1 && n <= NUMERO_CULTE_MAX ? n : 1
  })
  const [eventId, setEventId] = useState<number | null>(() => (evenementDemande ?? evenementParDefaut)?.id ?? null)
  const [dateEvenement, setDateEvenement] = useState(todayLocalISO)
  const [titre, setTitre] = useState("")
  const [brouillon, setBrouillon] = useState<Brouillon>(() => new Map())
  const [modifie, setModifie] = useState(false)
  const [recherche, setRecherche] = useState("")
  const [filtre, setFiltre] = useState<Filtre>("tous")
  const [filtreHistorique, setFiltreHistorique] = useState<FiltreHistorique>("toutes")

  const ev = eventId != null ? parId(events, eventId) : undefined
  const date = type === "EVENEMENT" ? dateEvenement : dateJour
  const cleCourante = useMemo<Recherche>(
    () => (type === "EVENEMENT" ? { type, ev } : type === "CULTE" ? { type, date: dateJour, numero } : { type, date: dateJour }),
    [type, ev, dateJour, numero]
  )

  const seanceExistante = useMemo(() => trouverSeance(seances, cleCourante), [seances, cleCourante])

  /** Brouillon, intitulé et date repartent de la feuille enregistrée (ou d'une feuille vierge). */
  const initialiser = useCallback((seance: OfflineRecord<SeanceData> | null, evenement: Evenement | undefined) => {
    setBrouillon(new Map((seance?.data.presences ?? []).map((l) => [l.membreId, { statut: l.statut, motif: l.motif }])))
    setTitre(seance?.data.titre ?? "")
    setDateEvenement(seance?.data.date ?? jourEvenement(evenement))
    setModifie(false)
  }, [])

  // Feuille changée en dessous (téléchargement, résultat d'envoi) : on la reprend, sauf si l'appel
  // est en cours de modification (les saisies de l'utilisateur ne sont jamais écrasées).
  useEffect(() => {
    if (!modifie) initialiser(seanceExistante, ev)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seanceExistante])

  /** Change de feuille (type, jour d'une répétition ou d'un culte, numéro du culte, événement) et repart de sa version enregistrée. */
  const appliquer = useCallback(
    (cle: Cle) => {
      const recherche = versRecherche(cle, events)
      const evenement = recherche.type === "EVENEMENT" ? recherche.ev : undefined
      setType(cle.type)
      if (cle.type === "EVENEMENT") setEventId(cle.eventId)
      else {
        setDateJour(cle.date)
        if (cle.type === "CULTE") setNumero(cle.numero)
      }
      initialiser(trouverSeance(seances, recherche), evenement)
    },
    [events, seances, initialiser]
  )

  /** Même chose, après confirmation si l'appel en cours n'est pas enregistré. */
  const changerCle = (cle: Cle, apres?: () => void) => {
    if (!modifie) {
      appliquer(cle)
      apres?.()
      return
    }
    Alert.alert("Modifications non enregistrées", "Abandonner les modifications de cette feuille ?", [
      { text: "Continuer l'appel", style: "cancel" },
      {
        text: "Abandonner",
        style: "destructive",
        onPress: () => {
          appliquer(cle)
          apres?.()
        },
      },
    ])
  }

  // Événements pas encore lus à l'ouverture : on choisit l'événement demandé (sinon le plus récent) dès qu'ils arrivent.
  const evenementInitial = evenementDemande ?? evenementParDefaut
  useEffect(() => {
    if (type === "EVENEMENT" && eventId == null && !modifie && evenementInitial) appliquer({ type: "EVENEMENT", eventId: evenementInitial.id })
  }, [type, eventId, modifie, evenementInitial, appliquer])

  // Quitter l'écran (retour de l'en-tête, bouton retour Android, geste) avec un appel non enregistré.
  // SDK 58 : l'événement « beforeRemove » n'existe plus, usePreventRemove le remplace.
  usePreventRemove(modifie, ({ repeat }) => {
    Alert.alert("Modifications non enregistrées", "Abandonner les modifications de cette feuille ?", [
      { text: "Continuer l'appel", style: "cancel" },
      {
        text: "Abandonner",
        style: "destructive",
        onPress: () => {
          setModifie(false)
          repeat()
        },
      },
    ])
  })

  /* ------------------------------ Mise à jour depuis le serveur ------------------------------ */

  const actualiser = useCallback(async () => {
    await syncManager.refreshEntity("presenceMembres")
    await syncManager.refreshEntity("seances")
  }, [])

  useEffect(() => {
    // Copie du téléphone affichée tout de suite (marche hors ligne), puis mise à jour silencieuse.
    if (autorise) void actualiser()
  }, [autorise, actualiser])

  const rafraichir = useCallback(async () => {
    setRefreshing(true)
    await actualiser()
    setRefreshing(false)
  }, [actualiser])

  /* ------------------------------ Liste d'appel ------------------------------ */

  /** Choristes actifs (sans filtre de date) + membres déjà sur la feuille (comptes désactivés depuis). */
  const roster = useMemo(() => {
    const liste = new Map<number, { id: number; nom: string; actif: boolean }>()
    for (const m of membres) if (m.serverId) liste.set(Number(m.serverId), { id: Number(m.serverId), nom: m.data.nom, actif: true })
    for (const l of seanceExistante?.data.presences ?? []) {
      if (!liste.has(l.membreId)) liste.set(l.membreId, { id: l.membreId, nom: l.nom, actif: false })
    }
    return [...liste.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
  }, [membres, seanceExistante])

  const ligneDe = (membreId: number) => brouillon.get(membreId) ?? ABSENT

  const compteurs = useMemo(() => {
    const c = totauxSeance(roster.map((m) => brouillon.get(m.id) ?? ABSENT))
    return { ...c, taux: c.effectif ? Math.round((c.presents / c.effectif) * 100) : 0 }
  }, [roster, brouillon])

  const visibles = useMemo(() => {
    const q = plat(recherche.trim())
    return roster.filter((m) => {
      const statut = (brouillon.get(m.id) ?? ABSENT).statut
      if (filtre === "presents" && statut !== "PRESENT") return false
      if (filtre === "excuses" && statut !== "EXCUSE") return false
      if (filtre === "absents" && statut !== "ABSENT") return false
      return !q || plat(m.nom).includes(q)
    })
  }, [roster, brouillon, recherche, filtre])

  const modifier = (changer: (b: Brouillon) => void) => {
    setBrouillon((precedent) => {
      const suivant = new Map(precedent)
      changer(suivant)
      return suivant
    })
    setModifie(true)
  }

  /** Toucher la ligne : absent → présent, présent → absent, excusé → présent (motif effacé). */
  const basculer = (membreId: number) =>
    modifier((b) => b.set(membreId, { statut: (b.get(membreId) ?? ABSENT).statut === "PRESENT" ? "ABSENT" : "PRESENT", motif: null }))

  const toutPresent = () =>
    modifier((b) => {
      for (const m of roster) if ((b.get(m.id) ?? ABSENT).statut === "ABSENT") b.set(m.id, { statut: "PRESENT", motif: null })
    })

  const toutDecocher = () =>
    modifier((b) => {
      for (const m of roster) if ((b.get(m.id) ?? ABSENT).statut === "PRESENT") b.set(m.id, ABSENT)
    })

  const ouvrirExcuse = (m: { id: number; nom: string }) => {
    const ligne = ligneDe(m.id)
    openSheet(
      <ExcuseSheet
        nom={m.nom}
        motifInitial={ligne.motif}
        dejaExcuse={ligne.statut === "EXCUSE"}
        onConfirm={(motif) => modifier((b) => b.set(m.id, { statut: "EXCUSE", motif }))}
        onRetirer={() => modifier((b) => b.set(m.id, ABSENT))}
      />
    )
  }

  /* ------------------------------ Enregistrer / supprimer ------------------------------ */

  const peutEnregistrer = (type !== "EVENEMENT" || !!ev) && roster.length > 0 && (modifie || !seanceExistante)

  const enregistrer = () => {
    try {
      if (type === "EVENEMENT" && !ev) throw new Error("Choisissez l'événement de cette séance.")
      if (date > todayLocalISO()) throw new Error("La date de la séance ne peut pas être dans le futur.")
      // Relu dans SQLite (pas dans la liste affichée, rafraîchie un instant plus tard) : un double
      // appui sur « Enregistrer » ne crée jamais deux feuilles.
      const existante = trouverSeance(seanceRepository.getAll(), cleCourante)
      const data: SeanceData = {
        type,
        date,
        // Intitulé : répétition et culte ; numéro : culte seulement.
        titre: type !== "EVENEMENT" ? titre.trim() || null : null,
        numero: type === "CULTE" ? numero : null,
        ...(type === "EVENEMENT" && ev ? lienEvenement(ev) : { evenementId: null, evenementLocalId: null }),
        evenementTitre: type === "EVENEMENT" ? (ev?.titre ?? null) : null,
        presences: roster.map((m) => {
          const b = ligneDe(m.id)
          return { membreId: m.id, nom: m.nom, statut: b.statut, motif: b.statut === "EXCUSE" ? b.motif : null }
        }),
        auteur: currentUser?.name ?? null,
        majLe: new Date().toISOString(),
        // Version serveur d'où part la saisie (jamais l'heure du téléphone) : envoyée comme `base`.
        serveurMajLe: existante?.data.serveurMajLe ?? null,
      }
      if (existante) seanceRepository.update(existante.localId, data)
      else seanceRepository.create(data)
      setModifie(false)
      // Appel terminé : retour à la liste des séances, où la feuille apparaît.
      setVue("liste")
      toast("Feuille de présence enregistrée")
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  const supprimer = () => {
    if (!seanceExistante) return
    const localId = seanceExistante.localId
    const quoi = type === "CULTE" ? `du ${titre.trim() || nomCulte(numero)} du` : "de présence du"
    Alert.alert("Supprimer la feuille ?", `La feuille ${quoi} ${formatDateLong(date)} sera supprimée.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          try {
            setModifie(false)
            seanceRepository.remove(localId)
            setVue("liste")
            toast("Feuille supprimée")
          } catch (e) {
            toast(errorMessage(e))
          }
        },
      },
    ])
  }

  /* ------------------------------ Historique ------------------------------ */

  /** Une ligne par feuille (deux enregistrements locaux peuvent partager une clé un court instant). */
  const feuilles = useMemo(() => {
    const parCle = new Map<string, OfflineRecord<SeanceData>>()
    const ordre: string[] = []
    for (const s of historique) {
      let cle = `REPETITION:${s.data.date}`
      if (s.data.type === "CULTE") cle = `CULTE:${s.data.date}:${numeroSeance(s.data)}`
      else if (s.data.type === "EVENEMENT") {
        const serveur =
          s.data.evenementId ?? (s.data.evenementLocalId ? evenementRepository.getByLocalId(s.data.evenementLocalId)?.serverId : null)
        cle = serveur != null ? `EVENEMENT:${serveur}` : `EVENEMENT:local:${s.data.evenementLocalId ?? s.localId}`
      }
      const deja = parCle.get(cle)
      if (!deja) ordre.push(cle)
      parCle.set(cle, deja ? seancePrioritaire(deja, s) : s)
    }
    return ordre.map((cle) => parCle.get(cle)!)
  }, [historique])

  const compteHistorique = {
    toutes: feuilles.length,
    repetitions: feuilles.filter((s) => s.data.type === "REPETITION").length,
    cultes: feuilles.filter((s) => s.data.type === "CULTE").length,
    evenements: feuilles.filter((s) => s.data.type === "EVENEMENT").length,
  }
  const feuillesVisibles = feuilles.filter((s) => filtreHistorique === "toutes" || s.data.type === TYPE_FILTRE[filtreHistorique])

  const evenementDeSeance = (s: OfflineRecord<SeanceData>) =>
    events.find(
      (e) =>
        (s.data.evenementId != null && e.id === s.data.evenementId) || (!!s.data.evenementLocalId && e.localId === s.data.evenementLocalId)
    )

  /** Libellé d'une feuille, comme le `libelle` de l'API (culte : intitulé, sinon « 2e culte »). */
  const libelleSeance = (s: OfflineRecord<SeanceData>) =>
    s.data.type === "REPETITION"
      ? (s.data.titre ?? "Répétition")
      : s.data.type === "CULTE"
        ? (s.data.titre ?? nomCulte(numeroSeance(s.data)))
        : (s.data.evenementTitre ?? "Événement")

  const ouvrirFeuille = (s: OfflineRecord<SeanceData>) => {
    if (s.data.type === "REPETITION") {
      changerCle({ type: "REPETITION", date: s.data.date }, () => setVue("appel"))
      return
    }
    if (s.data.type === "CULTE") {
      changerCle({ type: "CULTE", date: s.data.date, numero: numeroSeance(s.data) ?? 1 }, () => setVue("appel"))
      return
    }
    const evenement = evenementDeSeance(s)
    if (!evenement) {
      toast("Cet événement n'existe plus.")
      return
    }
    changerCle({ type: "EVENEMENT", eventId: evenement.id }, () => setVue("appel"))
  }

  /** « Nouvel appel » : choisir la séance, puis ouvrir sa feuille (déjà faite : elle est reprise). */
  const nouvelAppel = () =>
    openSheet(
      <NouvelAppelSheet
        evenements={evenementsAppel.map((e) => ({ value: e.id, label: e.date ? `${e.titre} · ${formatDateShort(e.date)}` : e.titre }))}
        aujourdhui={todayLocalISO()}
        existe={(cle) => !!trouverSeance(seances, versRecherche(cle, events))}
        onCommencer={(cle) => {
          setRecherche("")
          setFiltre("tous")
          changerCle(cle, () => setVue("appel"))
        }}
      />
    )

  /** Retour de la feuille vers la liste (confirmation si l’appel n’est pas enregistré). */
  const retourListe = useCallback(() => {
    if (!modifie) {
      setVue("liste")
      return
    }
    Alert.alert("Modifications non enregistrées", "Abandonner les modifications de cette feuille ?", [
      { text: "Continuer l'appel", style: "cancel" },
      {
        text: "Abandonner",
        style: "destructive",
        onPress: () => {
          initialiser(seanceExistante, ev)
          setVue("liste")
        },
      },
    ])
  }, [modifie, initialiser, seanceExistante, ev])

  // Bouton retour Android sur une feuille : revient à la liste plutôt que de quitter l’écran.
  useEffect(() => {
    if (vue !== "appel") return
    const abonnement = BackHandler.addEventListener("hardwareBackPress", () => {
      retourListe()
      return true
    })
    return () => abonnement.remove()
  }, [vue, retourListe])

  /* ------------------------------ Rendu ------------------------------ */

  const optionsEvenements = useMemo(() => {
    // L'événement choisi reste proposé même s'il est à venir (ouvert depuis sa fiche).
    const liste = ev && !evenementsAppel.includes(ev) ? [ev, ...evenementsAppel] : evenementsAppel
    return liste.map((e) => ({ value: e.id, label: e.date ? `${e.titre} · ${formatDateShort(e.date)}` : e.titre }))
  }, [evenementsAppel, ev])

  const feuillePrete = type !== "EVENEMENT" || !!ev

  /** Champ « Intitulé » des répétitions et des cultes. */
  const champIntitule = (placeholder: string) => (
    <Field
      label="Intitulé (facultatif)"
      placeholder={placeholder}
      maxLength={80}
      value={titre}
      onChangeText={(t) => {
        setTitre(t)
        setModifie(true)
      }}
    />
  )
  // Pas de barre sans feuille à enregistrer (aucun événement choisi).
  const barreVisible = autorise && vue === "appel" && feuillePrete

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
      <BackHeader title={vue === "appel" ? "Feuille d'appel" : "Présences"} onBack={vue === "appel" ? retourListe : undefined} />
      {/* Hors du défilement : reste visible pendant l'appel (rien d'affiché quand tout est envoyé). */}
      <View className="bg-surface">
        <Container>
          <OfflineBanner className="mt-3" />
        </Container>
      </View>
      <KeyboardAwareScrollView
        className="flex-1 bg-surface"
        // Place de la barre d'enregistrement fixe (hauteur variable selon l'appareil : en style).
        contentContainerStyle={{ paddingTop: 16, paddingBottom: barreVisible ? 104 + insets.bottom : 28 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          autorise ? (
            // Composant tiers : couleur passée en props.
            <RefreshControl refreshing={refreshing} onRefresh={rafraichir} tintColor={colors.navy} colors={[colors.navy]} />
          ) : undefined
        }
      >
        <Container>
          {!autorise ? (
            <EmptyState icon={Lock} title="Accès réservé" subtitle={ACCES_RESERVE} />
          ) : (
            <>

              {vue === "appel" ? (
                <>
                  {/* Séance : répétition du jour choisi, culte (jour et numéro), ou événement. */}
                  <Card>
                    <CardTitle>Séance</CardTitle>
                    <ChipsRow className="mb-0 mt-1.5">
                      <Chip
                        label="Répétition"
                        active={type === "REPETITION"}
                        onPress={() => type !== "REPETITION" && changerCle({ type: "REPETITION", date: dateJour })}
                      />
                      <Chip
                        label="Culte"
                        active={type === "CULTE"}
                        onPress={() =>
                          type !== "CULTE" &&
                          changerCle({
                            type: "CULTE",
                            date: dateJour,
                            numero: premierCulteLibre(dateJour, (c) => !!trouverSeance(seances, versRecherche(c, events))),
                          })
                        }
                      />
                      <Chip
                        label="Événement"
                        active={type === "EVENEMENT"}
                        onPress={() => type !== "EVENEMENT" && changerCle({ type: "EVENEMENT", eventId: eventId ?? evenementParDefaut?.id ?? null })}
                      />
                    </ChipsRow>
                    {type === "REPETITION" ? (
                      <>
                        <DateField
                          label="Date"
                          value={parseLocalISODate(dateJour)}
                          onChange={(d) => {
                            const jour = localISODate(d)
                            if (jour !== dateJour) changerCle({ type: "REPETITION", date: jour })
                          }}
                          maximumDate={new Date()}
                        />
                        {champIntitule("Ex. Répétition générale")}
                      </>
                    ) : type === "CULTE" ? (
                      <>
                        <DateField
                          label="Date du culte"
                          value={parseLocalISODate(dateJour)}
                          onChange={(d) => {
                            const jour = localISODate(d)
                            if (jour !== dateJour) changerCle({ type: "CULTE", date: jour, numero })
                          }}
                          maximumDate={new Date()}
                        />
                        <ChoixCulte numero={numero} onChange={(n) => changerCle({ type: "CULTE", date: dateJour, numero: n })} />
                        {champIntitule("Ex. Culte de 7 h")}
                      </>
                    ) : evenementsAppel.length === 0 && !ev ? (
                      <EmptyState icon={CalendarDays} title="Aucun événement" subtitle="Créez d'abord l'événement, puis faites l'appel." />
                    ) : (
                      <>
                        <Select
                          label="Événement"
                          value={eventId ?? 0}
                          placeholder="Choisir un événement"
                          options={optionsEvenements}
                          onChange={(id) => id !== eventId && changerCle({ type: "EVENEMENT", eventId: id })}
                        />
                        {ev ? (
                          <DateField
                            label="Date"
                            value={parseLocalISODate(dateEvenement)}
                            onChange={(d) => {
                              const jour = localISODate(d)
                              if (jour === dateEvenement) return
                              setDateEvenement(jour)
                              setModifie(true)
                            }}
                            maximumDate={new Date()}
                          />
                        ) : null}
                      </>
                    )}
                  </Card>

                  {!feuillePrete ? null : (
                    <>
                      {/* Résumé de la feuille. */}
                      <Card>
                        <View className="flex-row flex-wrap gap-1.5">
                          <Pill variant="green" mono>{`Présents ${compteurs.presents}`}</Pill>
                          <Pill variant="pending" mono>{`Excusés ${compteurs.excuses}`}</Pill>
                          <Pill variant="burg" mono>{`Absents ${compteurs.absents}`}</Pill>
                        </View>
                        <ProgressBar percent={compteurs.effectif ? (compteurs.presents / compteurs.effectif) * 100 : 0} />
                        <Muted>{`${compteurs.presents} / ${compteurs.effectif} présents · ${compteurs.taux} %`}</Muted>
                        {seanceExistante ? (
                          <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
                            {seanceExistante.data.auteur ? <Muted>{`Enregistrée par ${seanceExistante.data.auteur}`}</Muted> : null}
                            <RecordSyncBadge status={seanceExistante.syncStatus} />
                          </View>
                        ) : (
                          <Muted className="mt-1.5">Nouvelle feuille, pas encore enregistrée</Muted>
                        )}
                      </Card>

                      {roster.length === 0 ? (
                        <EmptyState
                          icon={Users}
                          title="Aucun choriste"
                          subtitle="La liste des choristes n'est pas encore téléchargée. Connectez-vous à internet puis tirez pour actualiser."
                        />
                      ) : (
                        <>
                          <SearchBar
                            value={recherche}
                            onChangeText={setRecherche}
                            placeholder="Rechercher un choriste"
                            autoCorrect={false}
                            returnKeyType="search"
                          />
                          <View className="mb-3 flex-row flex-wrap gap-2">
                            <Button small variant="outline" title="Tout marquer présent" onPress={toutPresent} />
                            <Button small variant="ghost" title="Tout décocher" onPress={toutDecocher} />
                          </View>
                          <ChipsRow>
                            <Chip label={`Tous ${compteurs.effectif}`} active={filtre === "tous"} onPress={() => setFiltre("tous")} />
                            <Chip label={`Présents ${compteurs.presents}`} active={filtre === "presents"} onPress={() => setFiltre("presents")} />
                            <Chip label={`Excusés ${compteurs.excuses}`} active={filtre === "excuses"} onPress={() => setFiltre("excuses")} />
                            <Chip label={`Absents ${compteurs.absents}`} active={filtre === "absents"} onPress={() => setFiltre("absents")} />
                          </ChipsRow>

                          {visibles.length === 0 ? (
                            <EmptyState title="Aucun résultat" subtitle="Modifiez la recherche ou le filtre." />
                          ) : (
                            <Card className="py-1">
                              {visibles.map((m, i) => (
                                <LigneAppel
                                  key={m.id}
                                  membre={m}
                                  ligne={ligneDe(m.id)}
                                  inscrit={type === "EVENEMENT" && !!ev?.inscrits?.some((x) => x.id === m.id)}
                                  last={i === visibles.length - 1}
                                  onBasculer={() => basculer(m.id)}
                                  onExcuser={() => ouvrirExcuse(m)}
                                />
                              ))}
                            </Card>
                          )}
                        </>
                      )}

                      {seanceExistante ? (
                        <Button variant="danger" small title="Supprimer cette feuille" className="mt-2" onPress={supprimer} />
                      ) : null}
                    </>
                  )}
                </>
              ) : (
                <>
                  <Button title="Nouvel appel" icon={Plus} block className="mb-3" onPress={nouvelAppel} />
                  <ChipsRow>
                    <Chip label={`Toutes ${compteHistorique.toutes}`} active={filtreHistorique === "toutes"} onPress={() => setFiltreHistorique("toutes")} />
                    <Chip
                      label={`Répétitions ${compteHistorique.repetitions}`}
                      active={filtreHistorique === "repetitions"}
                      onPress={() => setFiltreHistorique("repetitions")}
                    />
                    <Chip label={`Cultes ${compteHistorique.cultes}`} active={filtreHistorique === "cultes"} onPress={() => setFiltreHistorique("cultes")} />
                    <Chip
                      label={`Événements ${compteHistorique.evenements}`}
                      active={filtreHistorique === "evenements"}
                      onPress={() => setFiltreHistorique("evenements")}
                    />
                  </ChipsRow>
                  {feuillesVisibles.length === 0 ? (
                    <EmptyState icon={ClipboardCheck} title="Aucune feuille" subtitle="Touchez « Nouvel appel » pour faire l'appel d'une répétition, d'un culte ou d'un événement." />
                  ) : (
                    <Card className="py-1">
                      {feuillesVisibles.map((s, i) => (
                        <LigneHistorique
                          key={s.localId}
                          seance={s}
                          libelle={libelleSeance(s)}
                          last={i === feuillesVisibles.length - 1}
                          onPress={() => ouvrirFeuille(s)}
                        />
                      ))}
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </Container>
      </KeyboardAwareScrollView>

      {barreVisible ? (
        // Barre d'enregistrement fixe ; marge basse = zone de sécurité de l'appareil (en style).
        <View className="absolute bottom-0 left-0 right-0 border-t border-line bg-paper px-4 pt-3" style={[shadows.card, { paddingBottom: insets.bottom + 12 }]}>
          <RowBetween>
            <Muted className="shrink">{`${compteurs.presents} présents · ${compteurs.excuses} excusés · ${compteurs.absents} absents`}</Muted>
            <Button title="Enregistrer" onPress={enregistrer} disabled={!peutEnregistrer} />
          </RowBetween>
        </View>
      ) : null}
    </SafeAreaView>
  )
}

/** Ligne d'un choriste : toucher coche ou décoche sa présence ; « Excuser » ouvre le motif. */
function LigneAppel({
  membre,
  ligne,
  inscrit,
  last,
  onBasculer,
  onExcuser,
}: {
  membre: { id: number; nom: string; actif: boolean }
  ligne: Ligne
  inscrit: boolean
  last: boolean
  onBasculer: () => void
  onExcuser: () => void
}) {
  const { statut, motif } = ligne
  // Un seul sous-titre : l'excuse d'abord, puis le compte désactivé, puis l'inscription.
  const sousTitre =
    statut === "EXCUSE" ? (motif ? `Excusé · ${motif}` : "Excusé") : !membre.actif ? "Compte désactivé" : inscrit ? "Inscrit" : null
  return (
    <PressableScale
      scale={0.99}
      onPress={onBasculer}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: statut === "PRESENT" }}
      accessibilityLabel={`${membre.nom}, ${LIBELLE_STATUT[statut]}`}
      className={cx("min-h-touch flex-row items-center gap-3 py-2.5", !last && "border-b border-line")}
    >
      <Avatar id={membre.id} name={membre.nom} size={36} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-sans-medium text-[14px] text-ink">
          {membre.nom}
        </Text>
        {sousTitre ? (
          <Text numberOfLines={1} className={cx("font-sans text-[12px]", statut === "EXCUSE" ? "text-warning" : "text-ink-light")}>
            {sousTitre}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onExcuser}
        accessibilityRole="button"
        accessibilityLabel={statut === "EXCUSE" ? `Modifier l'excuse de ${membre.nom}` : `Excuser ${membre.nom}`}
        hitSlop={6}
      >
        {statut === "EXCUSE" ? (
          <Pill variant="pending">Excusé</Pill>
        ) : (
          <View className="rounded-full bg-surface-soft px-2.5 py-1">
            <Text className="font-sans-medium text-[12px] text-ink-soft">Excuser</Text>
          </View>
        )}
      </Pressable>
      <View
        className={cx(
          "h-7 w-7 items-center justify-center rounded-full",
          statut === "PRESENT" ? "bg-success" : statut === "EXCUSE" ? "bg-warning-bg" : "border-2 border-line-strong"
        )}
      >
        {statut === "PRESENT" ? <Check size={16} color={colors.paper} strokeWidth={2.5} /> : null}
        {statut === "EXCUSE" ? <Clock3 size={15} color={colors.warning} strokeWidth={2} /> : null}
      </View>
    </PressableScale>
  )
}

/** Ligne de l'historique : date, séance, totaux et taux de présence. */
function LigneHistorique({
  seance,
  libelle,
  last,
  onPress,
}: {
  seance: OfflineRecord<SeanceData>
  libelle: string
  last: boolean
  onPress: () => void
}) {
  const { date } = seance.data
  const t = totauxSeance(seance.data.presences)
  const taux = t.effectif ? Math.round((t.presents / t.effectif) * 100) : 0
  const jour = Number(date.slice(8, 10))
  const mois = MONTHS[Number(date.slice(5, 7)) - 1] ?? ""
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${libelle}, ${formatDateLong(date)} : ${t.presents} présents sur ${t.effectif}. Ouvrir la feuille`}
      className={cx("min-h-touch flex-row items-center gap-3 py-3 active:opacity-70", !last && "border-b border-line-soft")}
    >
      <View className="w-10 items-center">
        <Text className="font-sans-semibold text-[18px] tabular-nums text-ink">{jour}</Text>
        <Text className="font-sans text-[11px] text-ink-light">{mois}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-sans-medium text-[14px] text-ink">
          {libelle}
        </Text>
        <Text numberOfLines={1} className="font-sans text-[12px] text-ink-light">
          {`${t.presents} présents · ${t.excuses} excusés · ${t.absents} absents`}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text className="font-sans-semibold text-[14px] tabular-nums text-ink">{`${taux} %`}</Text>
        <RecordSyncBadge status={seance.syncStatus} />
      </View>
    </Pressable>
  )
}
