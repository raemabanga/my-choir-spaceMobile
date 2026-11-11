// Déclarations des entités disponibles hors ligne (voir lib/offline/README.md).
//
// Importé par app/_layout.tsx AVANT le démarrage du syncManager. Chaque entité est téléchargée à
// la synchronisation initiale ; ses opérations en attente sont envoyées au retour du réseau.
//
// Les écrans ne lisent jamais l'API : AppContext lit ces repositories (SQLite) et y écrit.

import * as api from "../api"
import { addDaysISO, todayLocalISO } from "../format"
import type { Chant, Evenement, RoleHistoryEntry } from "../../types"
import type { RemoteRecord } from "./offline-repository"
import { defineOfflineEntity, DependencyPendingError } from "./registry"

/**
 * Version des entités déclarées. À augmenter quand on en ajoute ou qu'on change leur forme :
 * les téléphones déjà synchronisés refont alors la synchronisation initiale.
 */
export const OFFLINE_DATA_VERSION = "6"

/** Clé de l'unique enregistrement des entités « singleton » (paramètres, cartes de cotisation…). */
const SINGLETON = "current"

/** Erreur définitive (traitée comme un refus 400 par le syncManager). */
function erreurDefinitive(message: string) {
  return Object.assign(new Error(message), { status: 400 })
}

/* ------------------------------------ Formes stockées ------------------------------------ */

export interface MembreData {
  nom: string
}

export interface EvenementData {
  titre: string
  /** Avec majuscule initiale (« Concert ») ; l'API l'enregistre en minuscules. */
  type: string
  /** "AAAA-MM-JJ", ou "" si la date n'est pas fixée. */
  date: string
  budgetPrevisionnel: number
  cotisationMontant: number
  /** Les choristes peuvent s'inscrire. */
  inscriptionsOuvertes?: boolean
  /** Une feuille de présence existe côté serveur (EvenementEntity.presence) : suppression refusée. */
  aFeuillePresence?: boolean
}

/** Inscription d'un membre à un événement (le membre connecté, pour une inscription faite sur le téléphone). */
export interface InscriptionData {
  evenementId: number | null
  evenementLocalId?: string | null
  membreId: number
  nom: string
}

export type TypePaiement = "STATUTAIRE" | "EVENEMENTIELLE"

export interface PaiementData {
  type: TypePaiement
  membreId: number
  membreNom: string
  montant: number
  /** STATUTAIRE : mois payé (0 = janvier) et son exercice. */
  mois: number | null
  annee: number | null
  /** EVENEMENTIELLE : événement déjà connu du serveur… */
  evenementId: number | null
  /** …ou créé hors ligne et pas encore envoyé (identifiant local). */
  evenementLocalId?: string | null
  /** "AAAA-MM-JJ" : jour où le membre a payé. */
  datePaiement: string | null
  mode: string | null
  libelle: string
  /** Numéro de reçu attribué par le serveur (null tant que le paiement n'est pas envoyé). */
  recu: string | null
  auteur: string
  /** Date de saisie (ISO). */
  saisiLe: string
  /**
   * Annulé sur le serveur : gardé sur le téléphone (il ne compte nulle part) car le serveur refuse
   * de supprimer un événement auquel un paiement, même annulé, est rattaché.
   */
  annule?: boolean
}

export type StatutDepense = "EN_ATTENTE" | "VALIDEE" | "REJETEE"

export interface DepenseData {
  evenementId: number | null
  evenementLocalId?: string | null
  libelle: string
  montant: number
  categorie: string
  beneficiaire?: string
  mode?: string
  statut: StatutDepense
  date: string
  /** Auteur (identifiant utilisateur) : l'API refuse qu'on valide sa propre dépense. */
  saisiParId?: number | null
}

export type ChantData = Omit<Chant, "id" | "localId" | "syncStatus">

export interface StatutaireData {
  mensualite: number
  exercices: { annee: number; cartes: { membreId: number; nom: string; payes: boolean[] }[] }[]
}

export interface HistoriqueRolesData {
  entrees: RoleHistoryEntry[]
}

export interface PresenceMembreData {
  nom: string
  /** "AAAA-MM-JJ", informatif seulement (pas de filtre). */
  joinedAt: string
}

export interface LigneSeance {
  membreId: number
  nom: string
  statut: api.StatutPresence
  motif: string | null
}

export interface SeanceData {
  type: api.TypeSeance
  /** "AAAA-MM-JJ" (heure locale). */
  date: string
  /** Répétitions et cultes (« Répétition générale », « Culte de 7 h ») ; null sinon. */
  titre: string | null
  /**
   * Cultes seulement : numéro dans la journée (1 à 5) ; null sinon. Absent des enregistrements
   * antérieurs aux cultes : toujours lire avec `numeroSeance`.
   */
  numero?: number | null
  evenementId: number | null
  evenementLocalId?: string | null
  /** Titre de l'événement, pour l'affichage hors ligne. */
  evenementTitre?: string | null
  /** Toute la feuille : chaque choriste appelé, absents compris. */
  presences: LigneSeance[]
  auteur?: string | null
  /** Affichage seulement (heure du téléphone pour une saisie locale) ; ne sert jamais de version. */
  majLe?: string
  /** `majLe` du serveur de la version d'où part cette saisie (null : aucune séance serveur vue). Envoyé comme `base`. */
  serveurMajLe?: string | null
}

/* ------------------------------------ Conversions ------------------------------------ */

const toEvenementData = (e: Evenement): EvenementData => ({
  titre: e.titre,
  type: e.type,
  date: e.date,
  budgetPrevisionnel: e.budgetPrevisionnel,
  cotisationMontant: e.cotisationMontant,
  inscriptionsOuvertes: e.inscriptionsOuvertes ?? false,
  aFeuillePresence: e.aFeuillePresence ?? false,
})

const toPaiementData = (p: api.ApiPaiement): PaiementData => ({
  type: p.type,
  membreId: p.membre.id,
  membreNom: p.membre.nom,
  montant: p.montant,
  mois: p.mois,
  annee: p.annee,
  evenementId: p.evenementId,
  evenementLocalId: null,
  datePaiement: p.datePaiement,
  mode: p.mode,
  libelle: p.libelle,
  recu: p.recu,
  auteur: p.auteur,
  saisiLe: p.date,
  annule: p.annulation != null,
})

const toDepenseData = (d: api.ApiDepense): DepenseData => ({
  evenementId: d.evenementId,
  evenementLocalId: null,
  libelle: d.libelle,
  montant: d.montant,
  categorie: d.categorie,
  statut: d.statut,
  date: d.date,
  saisiParId: d.saisiPar?.id ?? null,
})

const toChantData = (c: api.ApiChant): ChantData => ({
  titre: c.titre,
  compositeur: c.compositeur,
  categorie: c.categorie,
  tonalite: c.tonalite,
  paroles: c.paroles,
  // Métadonnées seulement : le fichier se télécharge à la demande (lib/fichiersChant.ts).
  document: c.document ?? null,
  audio: c.audio ?? null,
})

/** Numéro d'une séance : celui du culte, null pour les autres types (et les anciens enregistrements). */
export const numeroSeance = (data: Pick<SeanceData, "type" | "numero">): number | null =>
  data.type === "CULTE" ? (data.numero ?? null) : null

const toSeanceData = (s: api.Seance): SeanceData => ({
  type: s.type,
  date: s.date,
  titre: s.titre,
  numero: s.type === "CULTE" ? (s.numero ?? null) : null,
  evenementId: s.evenement?.id ?? null,
  evenementLocalId: null,
  evenementTitre: s.evenement?.titre ?? null,
  presences: s.presences ?? [],
  auteur: s.auteur,
  majLe: s.majLe,
  serveurMajLe: s.majLe,
})

/** Feuille renvoyée après un enregistrement : seules les lignes enregistrées en font partie. */
const feuilleToSeanceData = (f: api.FeuillePresence): SeanceData => ({
  type: f.type,
  date: f.seance?.date ?? f.date,
  titre: f.seance?.titre ?? null,
  numero: f.type === "CULTE" ? (f.seance?.numero ?? null) : null,
  evenementId: f.evenement?.id ?? null,
  evenementLocalId: null,
  evenementTitre: f.evenement?.titre ?? null,
  presences: f.lignes
    .filter((l) => l.enregistre)
    .map(({ membreId, nom, statut, motif }) => ({ membreId, nom, statut, motif })),
  auteur: f.seance?.auteur ?? null,
  majLe: f.seance?.majLe,
  serveurMajLe: f.seance?.majLe ?? null,
})

/** Corps envoyé à PUT /espace/presences/feuille (hors type et événement). Intitulé : répétition et culte ; numéro : culte. */
const aEnvoyer = (data: SeanceData): api.FeuilleAEnvoyer => ({
  date: data.date,
  titre: data.type === "EVENEMENT" ? null : data.titre,
  numero: numeroSeance(data),
  presences: data.presences.map(({ membreId, statut, motif }) => ({ membreId, statut, motif: statut === "EXCUSE" ? motif : null })),
  base: data.serveurMajLe ?? null,
})

const record = <T,>(serverId: number | string, data: T): RemoteRecord<T> => ({ serverId, data })

/* ------------------------------------ Entités ------------------------------------ */

export const parametresRepository = defineOfflineEntity<api.Parametres>("parametres", {
  label: "Paramètres de la chorale",
  order: 0,
  pull: async () => [record(SINGLETON, await api.fetchParametres())],
})

export const historiqueRolesRepository = defineOfflineEntity<HistoriqueRolesData>("historiqueRoles", {
  label: "Historique des rôles",
  order: 1,
  pull: async () => [record(SINGLETON, { entrees: await api.fetchRoleHistory() })],
})

/** Membres actifs (rôles financiers ; 403 ignoré pour les autres). */
export const membreRepository = defineOfflineEntity<MembreData>("membres", {
  label: "Choristes",
  order: 2,
  pull: async () => (await api.fetchMembres()).map((m) => record(m.id, { nom: m.nom })),
})

/** Comptes & rôles (admin, bureau, secrétaire). Lecture hors ligne ; la gestion reste en ligne. */
export const compteRepository = defineOfflineEntity<api.Compte>("comptes", {
  label: "Comptes",
  order: 3,
  pull: async () => (await api.fetchComptes()).map((c) => record(c.id, c)),
})

export const evenementRepository = defineOfflineEntity<EvenementData>("evenements", {
  label: "Événements",
  order: 4,
  pull: async () => (await api.fetchEvenements()).map((e) => record(e.id, toEvenementData(e))),
  create: async (data) => {
    const e = api.toEvenement(
      await api.creerEvenement({
        titre: data.titre,
        type: data.type,
        date: data.date,
        budgetPrevisionnel: data.budgetPrevisionnel,
        montantCotisation: data.cotisationMontant,
        inscriptionsOuvertes: data.inscriptionsOuvertes ?? false,
      })
    )
    return record(e.id, toEvenementData(e))
  },
  update: async (serverId, data) => {
    const e = api.toEvenement(
      await api.modifierEvenement(Number(serverId), {
        titre: data.titre,
        type: data.type,
        date: data.date || null,
        budgetPrevisionnel: data.budgetPrevisionnel,
        montantCotisation: data.cotisationMontant,
        inscriptionsOuvertes: data.inscriptionsOuvertes ?? false,
      })
    )
    return record(e.id, toEvenementData(e))
  },
  remove: (serverId) => api.supprimerEvenement(Number(serverId)),
})

/**
 * Identifiant serveur de l'événement lié à un paiement ou une dépense. Événement créé hors ligne
 * et pas encore envoyé : l'opération attend (DependencyPendingError).
 */
function evenementServeur(data: { evenementId: number | null; evenementLocalId?: string | null }): number | null {
  if (data.evenementId != null) return data.evenementId
  if (!data.evenementLocalId) return null
  const ev = evenementRepository.getByLocalId(data.evenementLocalId)
  if (!ev) throw erreurDefinitive("L'événement lié a été supprimé")
  if (ev.serverId) return Number(ev.serverId)
  if (ev.syncStatus === "failed") throw erreurDefinitive("L'événement lié n'a pas pu être envoyé")
  throw new DependencyPendingError("En attente de l'envoi de l'événement")
}

/**
 * Inscriptions aux événements. S'inscrire ou se désinscrire marche hors ligne ; une inscription
 * à un événement créé hors ligne attend l'envoi de l'événement.
 * Identifiant serveur : « événement:membre » (la désinscription vise l'événement).
 */
export const inscriptionRepository = defineOfflineEntity<InscriptionData>("inscriptions", {
  label: "Inscriptions aux événements",
  order: 5,
  pull: async () =>
    (await api.fetchInscriptions()).map((i) =>
      record(`${i.evenementId}:${i.membreId}`, { evenementId: i.evenementId, evenementLocalId: null, membreId: i.membreId, nom: i.nom })
    ),
  create: async (data) => {
    const evenementId = evenementServeur(data)
    if (evenementId == null) throw erreurDefinitive("Événement introuvable pour cette inscription")
    await api.inscrireEvenement(evenementId)
    return record(`${evenementId}:${data.membreId}`, { ...data, evenementId, evenementLocalId: null })
  },
  remove: async (serverId) => {
    await api.desinscrireEvenement(Number(serverId.split(":")[0]))
  },
})

/** Paiements (cotisations statutaires et événementielles). Création et annulation hors ligne. */
export const paiementRepository = defineOfflineEntity<PaiementData>("paiements", {
  label: "Cotisations et reçus",
  order: 5,
  // Les paiements annulés sont gardés (marqués `annule`) : ils ne comptent nulle part, mais
  // empêchent la suppression de leur événement, comme sur le serveur.
  pull: async () => (await api.fetchPaiements()).map((p) => record(p.id, toPaiementData(p))),
  create: async (data) => {
    const details = { datePaiement: data.datePaiement ?? "", mode: data.mode ?? "" }
    const p =
      data.type === "STATUTAIRE"
        ? await api.payerStatutaire(data.membreId, data.mois ?? 0, data.annee ?? new Date().getFullYear(), data.montant, details)
        : await api.payerEvenement(data.membreId, evenementServeur(data) ?? 0, data.montant, details)
    return record(p.id, toPaiementData(p))
  },
  // Annulation : le motif est joint à la suppression (paiementRepository.remove(localId, { motif })).
  remove: async (serverId, payload) => {
    const motif = (payload as { motif?: string } | null)?.motif?.trim() || "Annulé depuis l'application mobile"
    await api.annulerPaiement(Number(serverId), motif)
  },
})

/** Cartes de cotisation calculées par le serveur ; complétées sur le téléphone par les paiements locaux. */
export const statutaireRepository = defineOfflineEntity<StatutaireData>("statutaire", {
  label: "Cartes de cotisation",
  order: 6,
  pull: async () => [record(SINGLETON, await api.fetchStatutaire())],
})

/** Dépenses des événements (bureau, trésorerie). Ajout hors ligne ; validation une fois envoyée. */
export const depenseRepository = defineOfflineEntity<DepenseData>("depenses", {
  label: "Dépenses",
  order: 7,
  pull: async () => (await api.fetchDepenses()).map((d) => record(d.id, toDepenseData(d))),
  create: async (data) => {
    const d = await api.creerDepense({
      evenementId: evenementServeur(data) ?? 0,
      libelle: data.libelle,
      montant: data.montant,
      categorie: data.categorie,
      beneficiaire: data.beneficiaire ?? "",
      mode: data.mode ?? "",
      date: data.date,
    })
    return record(d.id, toDepenseData(d))
  },
  // Seule modification possible : la validation (refusée par l'API pour sa propre dépense).
  update: async (serverId, data) => {
    if (data.statut !== "VALIDEE") return
    const d = await api.validerDepense(Number(serverId))
    return record(d.id, toDepenseData(d))
  },
})

export const chantRepository = defineOfflineEntity<ChantData>("chants", {
  label: "Répertoire",
  order: 8,
  pull: async () => (await api.fetchChants()).map((c) => record(c.id, toChantData(c))),
  create: async (data) => {
    const c = await api.creerChant({
      titre: data.titre,
      compositeur: data.compositeur,
      categorie: data.categorie,
      tonalite: data.tonalite,
      paroles: data.paroles,
    })
    return record(c.id, toChantData(c))
  },
  remove: (serverId) => api.supprimerChant(Number(serverId)),
})

/** Choristes à appeler (rôles « présences » ; 403 ignoré pour les autres). */
export const presenceMembreRepository = defineOfflineEntity<PresenceMembreData>("presenceMembres", {
  label: "Choristes à appeler",
  order: 9,
  pull: async () => (await api.fetchPresenceMembres()).map((m) => record(m.id, { nom: m.nom, joinedAt: m.joinedAt })),
})

/**
 * Feuilles de présence (12 derniers mois). Faire l'appel marche hors ligne ; une feuille d'un
 * événement créé hors ligne attend l'envoi de l'événement. Chaque envoi transmet toute la feuille.
 */
export const seanceRepository = defineOfflineEntity<SeanceData>("seances", {
  label: "Présences",
  order: 10,
  pull: async () =>
    (await api.fetchSeances(addDaysISO(todayLocalISO(), -365))).map((s) => ({
      serverId: s.id,
      data: toSeanceData(s),
      updatedAt: s.majLe,
    })),
  create: async (data) => {
    const evenementId = data.type === "EVENEMENT" ? evenementServeur(data) : null
    if (data.type === "EVENEMENT" && evenementId == null) throw erreurDefinitive("Événement introuvable pour cette feuille de présence")
    verifierNumero(data)
    // Feuille de même clé supprimée sur ce téléphone, suppression pas encore acceptée : partir avant
    // ferait fusionner l'appel dans l'ancienne feuille, que le DELETE (réessayé) effacerait ensuite.
    if (suppressionEnAttente(data, evenementId)) {
      throw new DependencyPendingError("En attente de l'envoi de la suppression de l'ancienne feuille")
    }
    return envoyerFeuille(data, evenementId, null)
  },
  // Par la clé naturelle, pas par l'id : une feuille supprimée sur le web entre-temps est recréée
  // (au lieu d'un 404 définitif qui perdrait l'appel). Si l'id serveur change, applyUpdateResult ne
  // met pas server_id à jour, mais le prochain téléchargement complet (fullReplace) répare.
  update: async (serverId, data) => {
    const evenementId = data.type === "EVENEMENT" ? (data.evenementId ?? evenementServeur(data)) : null
    if (data.type === "EVENEMENT" && evenementId == null) throw erreurDefinitive("Événement introuvable pour cette feuille de présence")
    verifierNumero(data)
    return envoyerFeuille(data, evenementId, serverId)
  },
  remove: async (serverId) => {
    await api.supprimerSeance(Number(serverId))
    versionsEcrites.delete(serverId)
    feuilleEvenementSupprimee(serverId)
  },
})

/* ------------------------------------ Présences : envois ------------------------------------ */

/**
 * Dernière version serveur (`majLe`) de chaque séance écrite par ce téléphone (identifiant serveur →
 * majLe). Un second enregistrement fait pendant l'envoi du premier est mis en file avec le `base` de
 * départ, et le résultat de l'envoi ne remplace pas les données tant qu'une autre opération attend :
 * sans cette mémoire, le serveur fusionnerait et annulerait un décochage. Retenue seulement quand le
 * serveur a gardé l'envoi tel quel : après une fusion (cochages d'un autre appareil, jamais vus ici),
 * l'envoi suivant doit fusionner lui aussi.
 */
const versionsEcrites = new Map<string, string>()

/** Le plus récent de deux `majLe` ISO (null : aucun). */
function plusRecent(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null
  if (!b) return a
  return Date.parse(b) > Date.parse(a) ? b : a
}

/** Envoie toute la feuille (création comme modification) ; `base` = version serveur la plus récente connue. */
async function envoyerFeuille(data: SeanceData, evenementId: number | null, serverId: string | null): Promise<RemoteRecord<SeanceData>> {
  const corps = aEnvoyer(data)
  const base = plusRecent(corps.base, serverId ? versionsEcrites.get(serverId) : null)
  const f = await api.enregistrerFeuille({ type: data.type, evenementId, ...corps, base })
  const seance = f.seance!
  const enregistrees = new Map(f.lignes.filter((l) => l.enregistre).map((l) => [l.membreId, l]))
  const telQuel = corps.presences.every((p) => {
    const l = enregistrees.get(p.membreId)
    return !!l && l.statut === p.statut && (l.motif ?? null) === (p.motif ?? null)
  })
  if (telQuel) versionsEcrites.set(String(seance.id), seance.majLe)
  else versionsEcrites.delete(String(seance.id))
  return { serverId: seance.id, data: feuilleToSeanceData(f), updatedAt: seance.majLe }
}

/** Culte sans numéro valide : l'API répondrait 400, inutile de réessayer. */
function verifierNumero(data: SeanceData) {
  if (data.type !== "CULTE") return
  const numero = numeroSeance(data)
  if (numero == null || !Number.isInteger(numero) || numero < 1 || numero > api.NUMERO_CULTE_MAX) {
    throw erreurDefinitive("Numéro de culte invalide pour cette feuille de présence")
  }
}

/**
 * Une feuille de même clé (répétition : jour ; culte : jour et numéro ; événement) est supprimée sur
 * le téléphone et sa suppression n'est pas encore acceptée.
 */
function suppressionEnAttente(data: SeanceData, evenementId: number | null): boolean {
  const { type, date } = data
  return seanceRepository.getDeleted().some((s) => {
    if (s.syncStatus === "synced" || s.data.type !== type) return false
    if (type === "REPETITION") return s.data.date === date
    if (type === "CULTE") return s.data.date === date && numeroSeance(s.data) === numeroSeance(data)
    if (evenementId == null) return false
    if (s.data.evenementId === evenementId) return true
    const ev = s.data.evenementLocalId ? evenementRepository.getByLocalId(s.data.evenementLocalId) : null
    return ev?.serverId === String(evenementId)
  })
}

/**
 * Feuille d'un événement supprimée par le serveur : l'événement n'a plus de feuille. `aFeuillePresence`
 * (téléchargé avec les événements) est corrigé tout de suite, sinon la suppression de l'événement
 * resterait refusée sur le téléphone jusqu'au prochain téléchargement des événements. Écrit comme une
 * donnée serveur (aucune opération en file) ; ignoré si l'événement a une modification locale en attente.
 */
function feuilleEvenementSupprimee(serverId: string) {
  try {
    const seance = seanceRepository.getDeleted().find((s) => s.serverId === serverId && s.data.type === "EVENEMENT")
    if (!seance) return
    // Événement créé hors ligne : la feuille peut n'avoir encore que son identifiant local.
    const ev =
      seance.data.evenementId != null
        ? evenementRepository.getByServerId(seance.data.evenementId)
        : seance.data.evenementLocalId
          ? evenementRepository.getByLocalId(seance.data.evenementLocalId)
          : null
    if (!ev?.serverId || !ev.data.aFeuillePresence) return
    evenementRepository.syncFromServer([{ serverId: ev.serverId, data: { ...ev.data, aFeuillePresence: false } }])
  } catch (e) {
    // La suppression est faite sur le serveur : un échec ici ne doit pas la faire renvoyer.
    console.warn("[seances] indicateur de feuille de l'événement non mis à jour", e)
  }
}

/** Assiduité du membre connecté (tous les membres). */
export const mesPresencesRepository = defineOfflineEntity<api.MesPresences>("mesPresences", {
  label: "Mon assiduité",
  order: 11,
  pull: async () => [record(SINGLETON, await api.fetchMesPresences())],
})

/** Enregistrement unique d'une entité singleton (null avant le premier téléchargement). */
export function singleton<T extends object>(repository: { getByServerId: (id: string) => { data: T } | null }): T | null {
  return repository.getByServerId(SINGLETON)?.data ?? null
}
