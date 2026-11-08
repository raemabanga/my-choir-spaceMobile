// Données de la chorale telles que les écrans les affichent, lues dans SQLite (mode hors ligne).
//
// Les cartes de cotisation et les contributions aux événements partent de la dernière version du
// serveur, puis sont complétées par les paiements du téléphone : un paiement saisi hors ligne coche
// tout de suite son mois ; une annulation en attente le décoche.

import type * as api from "../lib/api"
import {
  chantRepository,
  depenseRepository,
  evenementRepository,
  historiqueRolesRepository,
  inscriptionRepository,
  membreRepository,
  paiementRepository,
  parametresRepository,
  singleton,
  statutaireRepository,
  type PaiementData,
} from "../lib/offline/entities"
import type { OfflineRecord } from "../lib/offline"
import type { Chant, Chorist, Depense, Evenement, Recu, RoleHistoryEntry } from "../types"

export interface ChoraleData {
  events: Evenement[]
  chants: Chant[]
  recus: Recu[]
  statutaireParAnnee: Record<number, Record<number, boolean[]>>
  /** Membres connus (hors membre connecté), triés par nom. */
  membres: Chorist[]
  mensualite: number
  parametres: Omit<api.Parametres, "mensualite"> | null
  historiqueRoles: RoleHistoryEntry[]
}

export const EMPTY_DATA: ChoraleData = {
  events: [],
  chants: [],
  recus: [],
  statutaireParAnnee: {},
  membres: [],
  mensualite: 0,
  parametres: null,
  historiqueRoles: [],
}

const emptyCard = () => Array<boolean>(12).fill(false)

/* ------------------------------ Identifiants provisoires ------------------------------ */
// Les écrans désignent événements, chants et dépenses par un identifiant numérique (celui du serveur).
// Un élément créé hors ligne n'en a pas encore : il reçoit un identifiant négatif, stable pendant
// toute la session de l'app.

const provisoires = new Map<string, number>()
/** Sens inverse : un écran ouvert avec l'identifiant provisoire retrouve l'élément après son envoi. */
const localParProvisoire = new Map<number, string>()
let prochainProvisoire = -1

function idProvisoire(localId: string) {
  let id = provisoires.get(localId)
  if (id === undefined) {
    id = prochainProvisoire--
    provisoires.set(localId, id)
    localParProvisoire.set(id, localId)
  }
  return id
}

/**
 * Élément d'une liste par son identifiant affiché. Un identifiant provisoire (négatif) reste valable
 * après l'envoi au serveur : une feuille ou une page ouverte avant l'envoi retrouve toujours l'élément.
 */
export function parId<T extends { id: number; localId?: string }>(liste: T[], id: number): T | undefined {
  const direct = liste.find((e) => e.id === id)
  if (direct || id >= 0) return direct
  const localId = localParProvisoire.get(id)
  return localId ? liste.find((e) => e.localId === localId) : undefined
}

/**
 * Paiements ou dépenses rattachés à un événement, comme le compte le serveur pour refuser sa
 * suppression (409) : paiements annulés et dépenses rejetées compris.
 */
export function evenementARattachements(evenement: { localId: string; serverId: string | null }) {
  const vise = (d: { evenementId: number | null; evenementLocalId?: string | null }) =>
    (evenement.serverId != null && d.evenementId === Number(evenement.serverId)) || d.evenementLocalId === evenement.localId
  return (
    [...paiementRepository.getAll(), ...paiementRepository.getDeleted()].some((p) => vise(p.data)) ||
    [...depenseRepository.getAll(), ...depenseRepository.getDeleted()].some((d) => vise(d.data))
  )
}

/** Identifiant affiché d'un élément : celui du serveur, sinon un identifiant provisoire négatif. */
export function idAffiche(record: { localId: string; serverId: string | null }) {
  return record.serverId != null ? Number(record.serverId) : idProvisoire(record.localId)
}

/** "AAAA-MM-JJ" → "JJ/MM/AAAA" (sans passer par Date : pas de décalage de fuseau). */
const frDateISO = (iso: string) => iso.split("-").reverse().join("/")
const frDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR")
}

/**
 * Un paiement compte s'il n'est pas annulé, ni refusé définitivement avant même d'atteindre le serveur.
 */
const compte = (p: OfflineRecord<PaiementData>) => !p.data.annule && !(p.syncStatus === "failed" && p.serverId == null)

/**
 * Lit toutes les données de la chorale dans SQLite.
 * `membreConnecte` : sa carte de l'année en cours existe toujours (vierge au besoin).
 */
export function lireDonneesChorale(membreConnecte: number, annee: number): ChoraleData {
  /* ---------- Événements (identifiant affiché par identifiant local) ---------- */
  const evRecords = evenementRepository.getAll()
  const evIdParLocal = new Map(evRecords.map((r) => [r.localId, idAffiche(r)]))
  /** Événement visé par un paiement ou une dépense (serveur ou créé hors ligne). */
  const evenementDe = (d: { evenementId: number | null; evenementLocalId?: string | null }) =>
    d.evenementId != null ? d.evenementId : d.evenementLocalId ? (evIdParLocal.get(d.evenementLocalId) ?? null) : null

  /* ---------- Paiements ---------- */
  // Paiements annulés sur le serveur : gardés pour la règle de suppression, invisibles ailleurs.
  const paiements = paiementRepository.getAll().filter((p) => !p.data.annule)
  const actifs = paiements.filter(compte)
  // Annulés sur le téléphone, annulation pas encore confirmée.
  const annules = paiementRepository.getDeleted()

  const contributions = new Map<number, Record<number, number>>()
  for (const p of actifs) {
    if (p.data.type !== "EVENEMENTIELLE") continue
    const ev = evenementDe(p.data)
    if (ev == null) continue
    const parMembre = contributions.get(ev) ?? {}
    parMembre[p.data.membreId] = (parMembre[p.data.membreId] ?? 0) + p.data.montant
    contributions.set(ev, parMembre)
  }

  /* ---------- Dépenses ---------- */
  const depensesParEvenement = new Map<number, Depense[]>()
  for (const d of depenseRepository.getAll()) {
    if (d.data.statut === "REJETEE") continue
    const ev = evenementDe(d.data)
    if (ev == null) continue
    const liste = depensesParEvenement.get(ev) ?? []
    liste.push({
      id: idAffiche(d),
      localId: d.localId,
      syncStatus: d.syncStatus,
      label: d.data.libelle,
      montant: d.data.montant,
      // Une validation compte une fois acceptée par le serveur (il peut la refuser : sa propre dépense…).
      valide: d.data.statut === "VALIDEE" && d.syncStatus === "synced",
      saisiParId: d.data.saisiParId ?? null,
    })
    depensesParEvenement.set(ev, liste)
  }

  /* ---------- Inscriptions (serveur + faites sur le téléphone, désinscriptions en attente exclues) ---------- */
  const inscriptionsParEvenement = new Map<number, { id: number; nom: string }[]>()
  for (const i of inscriptionRepository.getAll()) {
    if (i.syncStatus === "failed" && i.serverId == null) continue
    const ev = evenementDe(i.data)
    if (ev == null) continue
    const liste = inscriptionsParEvenement.get(ev) ?? []
    if (!liste.some((x) => x.id === i.data.membreId)) liste.push({ id: i.data.membreId, nom: i.data.nom })
    inscriptionsParEvenement.set(ev, liste)
  }

  const events: Evenement[] = evRecords.map((r): Evenement => {
    const id = idAffiche(r)
    return {
      id,
      localId: r.localId,
      syncStatus: r.syncStatus,
      titre: r.data.titre,
      type: r.data.type,
      date: r.data.date,
      description: "",
      budgetPrevisionnel: r.data.budgetPrevisionnel,
      cotisationMontant: r.data.cotisationMontant,
      depenses: depensesParEvenement.get(id) ?? [],
      contributions: contributions.get(id) ?? {},
      inscriptionsOuvertes: r.data.inscriptionsOuvertes ?? false,
      inscrits: inscriptionsParEvenement.get(id) ?? [],
      inscrit: (inscriptionsParEvenement.get(id) ?? []).some((x) => x.id === membreConnecte),
    }
  })
  // Même ordre que le serveur : par date, les événements sans date à la fin.
  events.sort((a, b) => Number(a.date === "") - Number(b.date === "") || a.date.localeCompare(b.date) || a.id - b.id)

  /* ---------- Cartes de cotisation ---------- */
  const snapshot = singleton(statutaireRepository)
  const parAnnee: Record<number, Record<number, boolean[]>> = {}
  for (const e of snapshot?.exercices ?? []) {
    parAnnee[e.annee] = Object.fromEntries(e.cartes.map((c) => [c.membreId, [...c.payes]]))
  }
  const carte = (an: number, membre: number) => {
    parAnnee[an] ??= {}
    parAnnee[an][membre] ??= emptyCard()
    return parAnnee[an][membre]
  }
  const cle = (p: PaiementData) => `${p.membreId}:${p.annee}:${p.mois}`
  const moisPayes = new Set<string>()
  for (const p of actifs) {
    if (p.data.type !== "STATUTAIRE" || p.data.mois == null || p.data.annee == null) continue
    carte(p.data.annee, p.data.membreId)[p.data.mois] = true
    moisPayes.add(cle(p.data))
  }
  // Annulation pas encore confirmée par un téléchargement : le mois redevient impayé.
  for (const p of annules) {
    if (p.data.type !== "STATUTAIRE" || p.data.mois == null || p.data.annee == null) continue
    if (!moisPayes.has(cle(p.data))) carte(p.data.annee, p.data.membreId)[p.data.mois] = false
  }
  carte(annee, membreConnecte)

  /* ---------- Reçus (du plus récent au plus ancien) ---------- */
  const recus: Recu[] = [...paiements]
    .sort((a, b) => b.data.saisiLe.localeCompare(a.data.saisiLe))
    .map((p) => ({
      id: p.data.recu ?? "En attente",
      localId: p.localId,
      syncStatus: p.syncStatus,
      chorishId: p.data.membreId,
      type: p.data.type === "STATUTAIRE" ? "Statutaire" : "Événementielle",
      label: p.data.libelle,
      montant: p.data.montant,
      date: p.data.datePaiement ? frDateISO(p.data.datePaiement) : frDate(p.data.saisiLe),
      enregistrePar: p.data.auteur,
      eventId: evenementDe(p.data) ?? undefined,
      mode: p.data.mode ?? undefined,
    }))

  /* ---------- Membres : liste des rôles financiers, sinon ceux des cartes visibles ---------- */
  const noms = new Map<number, string>()
  for (const m of membreRepository.getAll()) if (m.serverId) noms.set(Number(m.serverId), m.data.nom)
  for (const c of snapshot?.exercices.find((e) => e.annee === annee)?.cartes ?? []) if (!noms.has(c.membreId)) noms.set(c.membreId, c.nom)
  noms.delete(membreConnecte)
  const membres: Chorist[] = [...noms]
    .map(([id, nom]) => ({ id, name: nom, roles: ["choriste" as const], numero: String(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))

  /* ---------- Chants, paramètres, historique ---------- */
  const chants: Chant[] = chantRepository.getAll().map((r) => ({ id: idAffiche(r), localId: r.localId, syncStatus: r.syncStatus, ...r.data }))
  const params = singleton(parametresRepository)
  const parametres = params ? (({ mensualite: _m, ...listes }) => listes)(params) : null

  return {
    events,
    chants,
    recus,
    statutaireParAnnee: parAnnee,
    membres,
    mensualite: params?.mensualite ?? snapshot?.mensualite ?? 0,
    parametres,
    historiqueRoles: singleton(historiqueRolesRepository)?.entrees ?? [],
  }
}
