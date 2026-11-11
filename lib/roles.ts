// Rôles et droits : mêmes règles que le portail web (my-choir-space-FrontOffice,
// components/portail/portail-chorale.tsx) et que l'API (back-end_chorale, /espace/comptes).
import type { Permission, Role } from "../types"

/** Tous les rôles, dans l'ordre d'affichage. */
export const ROLES: Role[] = ["admin_chorale", "bureau", "secretaire", "tresorier", "commission_recette", "commission_musicale", "commission_presence", "choriste"]

/** Libellés identiques au web (data/portail-mock.ts → ROLE_LABEL). */
export const ROLE_LABEL: Record<Role, string> = {
  admin_chorale: "Admin de chorale",
  bureau: "Bureau exécutif",
  secretaire: "Secrétaire général",
  tresorier: "Trésorier(ère)",
  choriste: "Choriste",
  commission_recette: "Commission recette",
  commission_musicale: "Commission musicale",
  commission_presence: "Commission présence",
}

/** Droits d'un membre, calculés à partir de ses rôles (cumulables). */
export type Perms = Record<Permission, boolean>

export function computePerms(roles: Role[]): Perms {
  const has = (r: Role) => roles.includes(r)
  return {
    comptes: has("admin_chorale") || has("bureau") || has("secretaire"),
    // Admin, bureau et secrétariat : tous les droits sur les comptes (rôles, mot de passe, statut).
    comptesFull: has("admin_chorale") || has("bureau") || has("secretaire"),
    evenements: has("bureau") || has("tresorier") || has("secretaire"),
    cotisations: has("bureau") || has("tresorier") || has("commission_recette"),
    paiements: has("tresorier") || has("commission_recette"),
    // Annuler un paiement saisi par erreur (règle de l'API).
    paiementsAnnuler: has("bureau") || has("tresorier") || has("commission_recette"),
    budget: has("bureau") || has("tresorier"),
    depensesValider: has("bureau") || has("tresorier"),
    chantsGerer: has("bureau") || has("commission_musicale"),
    chantsCreer: has("bureau") || has("commission_musicale"),
    // Tout choriste consulte le répertoire ; le bureau et la commission musicale ajoutent des chants,
    // les modifient et les suppriment.
    chantsVoir: true,
    rapports: has("admin_chorale") || has("bureau") || has("tresorier") || has("secretaire"),
    // Faire l'appel (répétitions et événements) : même règle que l'API (PRESENCE_ROLES.saisie).
    presences: has("bureau") || has("secretaire") || has("commission_recette") || has("commission_presence"),
  }
}

/** Rôles qu'un secrétaire peut gérer : comptes ne portant que ces rôles (règle de l'API). */
export const BASIC_ROLES: Role[] = ["choriste", "commission_recette", "commission_musicale", "commission_presence"]

/** Rôles attribuables ou révocables par l'admin, le bureau et le secrétariat (ni Choriste, ni Admin). */
export const MANDATE_ROLES: Role[] = ["commission_recette", "commission_musicale", "commission_presence", "bureau", "tresorier", "secretaire"]

/** Rôle initial d'un nouveau compte (Choriste est toujours donné en plus). */
export const INITIAL_ROLES: Role[] = ["choriste", "commission_recette", "commission_musicale", "commission_presence", "bureau", "tresorier", "secretaire"]

/* --------------------------------- Codes de l'API (MCD) ↔ app --------------------------------- */

export const TO_API_ROLE: Record<Role, string> = {
  admin_chorale: "ADMINISTRATEUR",
  bureau: "BUREAU_EXECUTIF",
  secretaire: "SECRETAIRE",
  tresorier: "TRESORIERE",
  choriste: "CHORISTE",
  commission_recette: "COMMISSION_RECETTE",
  commission_musicale: "COMMISSION_MUSICALE",
  commission_presence: "COMMISSION_PRESENCE",
}

const FROM_API_ROLE = Object.fromEntries(Object.entries(TO_API_ROLE).map(([role, code]) => [code, role])) as Record<string, Role>

/** Codes de l'API → rôles de l'app (codes inconnus ignorés, ex. rôle personnalisé du back-office). */
export function fromApiRoles(codes: string[]): Role[] {
  return codes.map((code) => FROM_API_ROLE[code]).filter((r): r is Role => Boolean(r))
}

export const fromApiRole = (code: string): Role | undefined => FROM_API_ROLE[code]
