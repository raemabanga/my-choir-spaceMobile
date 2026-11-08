// Déclarations des entités disponibles hors ligne (voir lib/offline/README.md).
//
// Importé par app/_layout.tsx AVANT le démarrage du syncManager. Chaque entité est téléchargée à
// la synchronisation initiale ; ses opérations en attente sont envoyées au retour du réseau.
//
// Les écrans ne lisent jamais l'API : AppContext lit ces repositories (SQLite) et y écrit.

import * as api from "../api"
import type { Chant, Evenement, RoleHistoryEntry } from "../../types"
import type { RemoteRecord } from "./offline-repository"
import { defineOfflineEntity, DependencyPendingError } from "./registry"

/**
 * Version des entités déclarées. À augmenter quand on en ajoute ou qu'on change leur forme :
 * les téléphones déjà synchronisés refont alors la synchronisation initiale.
 */
export const OFFLINE_DATA_VERSION = "4"

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

/* ------------------------------------ Conversions ------------------------------------ */

const toEvenementData = (e: Evenement): EvenementData => ({
  titre: e.titre,
  type: e.type,
  date: e.date,
  budgetPrevisionnel: e.budgetPrevisionnel,
  cotisationMontant: e.cotisationMontant,
  inscriptionsOuvertes: e.inscriptionsOuvertes ?? false,
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

/** Enregistrement unique d'une entité singleton (null avant le premier téléchargement). */
export function singleton<T extends object>(repository: { getByServerId: (id: string) => { data: T } | null }): T | null {
  return repository.getByServerId(SINGLETON)?.data ?? null
}
