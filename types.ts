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

export type ChantStatut = "actif" | "a_valider"

export interface Chant {
  id: number
  titre: string
  compositeur: string
  categorie: string
  tonalite: string
  paroles: string
  statut: ChantStatut
}

export interface Depense {
  label: string
  montant: number
  valide: boolean
}

export interface Evenement {
  id: number
  titre: string
  type: string
  date: string
  description: string
  budgetPrevisionnel: number
  cotisationMontant: number
  inscrits: number[]
  depenses: Depense[]
  contributions: Record<number, number>
}

export type RecuType = "Statutaire" | "Événementielle"

export interface Recu {
  id: string
  chorishId: number
  type: RecuType
  label: string
  montant: number
  date: string
  enregistrePar: string
}
