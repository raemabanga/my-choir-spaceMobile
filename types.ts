/** Mêmes rôles que le portail web (types/portail.ts). Cumulables ; « choriste » toujours présent. */
export type Role =
  | "admin_chorale"
  | "bureau"
  | "secretaire"
  | "tresorier"
  | "choriste"
  | "commission_recette"
  | "commission_musicale"

/** Mêmes droits que le portail web (Perms), calculés dans lib/roles.ts. */
export type Permission =
  | "comptes"
  | "comptesFull"
  | "evenements"
  | "cotisations"
  | "paiements"
  | "paiementsAnnuler"
  | "budget"
  | "depensesValider"
  | "chantsGerer"
  | "chantsCreer"
  | "chantsVoir"
  | "rapports"

export interface Mandat {
  debut: string
  fin: string
}

export interface Chorist {
  id: number
  name: string
  roles: Role[]
  numero: string
  fonction?: string
  mandat?: Mandat
}

export interface RoleHistoryEntry {
  role: string
  debut: string
  fin: string | null
}

/** État d'un élément enregistré sur le téléphone (mode hors ligne). */
export type SyncStatus = "synced" | "pending" | "failed"

/** Champs ajoutés par le mode hors ligne aux éléments modifiables sur le téléphone. */
export interface OfflineFields {
  /** Identifiant local (stable, même avant l'envoi au serveur). */
  localId?: string
  /** pending : modification pas encore envoyée · failed : envoi refusé. */
  syncStatus?: SyncStatus
}

/** Nom, type et taille d'un fichier joint à un chant (le contenu se télécharge à part). */
export interface FichierMeta {
  nom: string
  type: string
  taille: number
}

export interface Chant extends OfflineFields {
  /** Identifiant serveur ; négatif (provisoire) pour un chant pas encore envoyé. */
  id: number
  titre: string
  compositeur: string
  categorie: string
  tonalite: string
  paroles: string
  /** Partition ou document (PDF, image, Word), ajouté depuis le portail web. */
  document?: FichierMeta | null
  /** Enregistrement du chant, ajouté depuis le portail web. */
  audio?: FichierMeta | null
}

export interface Depense extends OfflineFields {
  /** Identifiant serveur ; négatif (provisoire) pour une dépense pas encore envoyée. */
  id: number
  label: string
  montant: number
  valide: boolean
  /** Auteur (identifiant utilisateur) : on ne valide pas sa propre dépense (règle de l'API). */
  saisiParId?: number | null
}

export interface Evenement extends OfflineFields {
  /** Identifiant serveur ; négatif (provisoire) pour un événement pas encore envoyé. */
  id: number
  titre: string
  type: string
  /** "AAAA-MM-JJ", ou "" si la date n'est pas encore fixée. */
  date: string
  description: string
  budgetPrevisionnel: number
  cotisationMontant: number
  depenses: Depense[]
  contributions: Record<number, number>
  /** Les choristes peuvent s'inscrire à l'événement. */
  inscriptionsOuvertes?: boolean
  /** Membres inscrits (identifiant d'adhésion et nom), dans l'ordre d'inscription. */
  inscrits?: { id: number; nom: string }[]
  /** Le membre connecté est inscrit. */
  inscrit?: boolean
}

export type RecuType = "Statutaire" | "Événementielle"

export interface Recu extends OfflineFields {
  /** Numéro de reçu (« En attente » tant que le paiement n'est pas envoyé). */
  id: string
  chorishId: number
  type: RecuType
  label: string
  montant: number
  date: string
  enregistrePar: string
  /** Événement concerné (cotisation événementielle). */
  eventId?: number
  /** Code du mode de règlement (absent pour les paiements anciens). */
  mode?: string
}
