// Client de l'API de l'espace chorale (back-end_chorale, routes /espace/... et /auth/...).
// Même contrat que le portail web (my-choir-space-FrontOffice/src/lib/api.ts), adapté au mobile :
// jeton dans le stockage sécurisé du téléphone, adresse du serveur configurable.

import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"
import { fromApiRole, fromApiRoles, ROLE_LABEL, TO_API_ROLE } from "./roles"
import type { Role } from "../types"

/**
 * Adresse du backend. Sur un téléphone, `localhost` désigne le téléphone lui-même :
 * renseignez l'adresse IP du PC dans `.env.local` (ex. EXPO_PUBLIC_API_URL=http://192.168.1.20:3000).
 * Émulateur Android : http://10.0.2.2:3000.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"

/* --------------------------------- Jeton de connexion --------------------------------- */

const TOKEN_KEY = "espace-chorale-token"

// SecureStore n'existe pas sur le web : repli sur localStorage (tests navigateur uniquement).
const tokenStore = {
  async get() {
    try {
      return Platform.OS === "web" ? (globalThis.localStorage?.getItem(TOKEN_KEY) ?? null) : await SecureStore.getItemAsync(TOKEN_KEY)
    } catch {
      return null
    }
  },
  async set(token: string) {
    try {
      if (Platform.OS === "web") globalThis.localStorage?.setItem(TOKEN_KEY, token)
      else await SecureStore.setItemAsync(TOKEN_KEY, token)
    } catch {
      // La session ne survivra simplement pas au redémarrage de l'app.
    }
  },
  async clear() {
    try {
      if (Platform.OS === "web") globalThis.localStorage?.removeItem(TOKEN_KEY)
      else await SecureStore.deleteItemAsync(TOKEN_KEY)
    } catch {
      // Rien à effacer.
    }
  },
}

export const hasStoredToken = async () => (await tokenStore.get()) !== null
export const clearToken = () => tokenStore.clear()

let onUnauthorized: (() => void) | null = null

/** Appelé quand l'API refuse le jeton (expiré, compte ou chorale désactivé). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

/** Erreur d'API avec un message prêt à afficher. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const PUBLIC_PATHS = ["/espace/auth/login", "/auth/forgot-password", "/auth/reset-password"]

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await tokenStore.get()
  let response: Response
  try {
    response = await fetch(API_URL + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez votre connexion internet et réessayez.", 0)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message
    if (response.status === 401 && !PUBLIC_PATHS.includes(path)) {
      await tokenStore.clear()
      onUnauthorized?.()
    }
    throw new ApiError(message ?? "Erreur " + response.status, response.status)
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

/* ------------------------------------- Rôles ------------------------------------- */

/** Rôles de l'app (mêmes que le web), sans doublon ; « choriste » toujours présent. */
export function toRoles(codes: string[]): Role[] {
  return [...new Set<Role>(["choriste", ...fromApiRoles(codes)])]
}

/* --------------------------------- Formes renvoyées par l'API --------------------------------- */

interface ApiPerson {
  id: number
  firstName: string
  lastName: string
}

export interface ApiSession {
  user: ApiPerson & { email: string | null; phone: string | null; mustChangePassword: boolean }
  chorale: { id: number; name: string; primaryColor: string; secondaryColor: string }
  membership: { id: number; status: string; joinedAt: string }
  roles: string[]
}

interface ApiCompte {
  id: number
  status: "ACTIVE" | "SUSPENDED" | "LEFT"
  user: ApiPerson & { email: string | null; phone: string | null }
  roles: string[]
  history: { roleCode: string; assignedAt: string; revokedAt: string | null; assignedBy: ApiPerson | null }[]
}

/** Compte d'un membre (écran « Comptes & Rôles »), comme sur le web. */
export interface Compte {
  id: number
  /** Même valeur que Session.membershipId pour le membre connecté. */
  membershipId: number
  nom: string
  prenom: string
  nomDeFamille: string
  telephone: string
  email: string
  roles: Role[]
  statut: "actif" | "désactivé"
  historique: { role: Role; debut: string; fin: string | null; auteur: string }[]
}

/** Session telle qu'utilisée par l'app. */
export interface Session {
  userId: number
  membershipId: number
  nom: string
  email: string | null
  telephone: string | null
  roles: Role[]
  chorale: { id: number; nom: string }
  /** Mot de passe temporaire : le membre doit en choisir un avant de continuer. */
  doitChangerMotDePasse: boolean
}

const fullName = (p: ApiPerson) => `${p.firstName} ${p.lastName}`.trim()

function toCompte(c: ApiCompte): Compte {
  return {
    id: c.id,
    membershipId: c.id,
    nom: fullName(c.user),
    prenom: c.user.firstName,
    nomDeFamille: c.user.lastName,
    telephone: c.user.phone ?? "",
    email: c.user.email ?? "",
    roles: toRoles(c.roles),
    statut: c.status === "ACTIVE" ? "actif" : "désactivé",
    historique: c.history
      .filter((h) => fromApiRole(h.roleCode))
      .map((h) => ({
        role: fromApiRole(h.roleCode)!,
        debut: h.assignedAt.slice(0, 10),
        fin: h.revokedAt?.slice(0, 10) ?? null,
        auteur: h.assignedBy ? fullName(h.assignedBy) : "—",
      })),
  }
}

function toSession(s: ApiSession): Session {
  return {
    userId: s.user.id,
    membershipId: s.membership.id,
    nom: fullName(s.user),
    email: s.user.email,
    telephone: s.user.phone,
    roles: toRoles(s.roles),
    chorale: { id: s.chorale.id, nom: s.chorale.name },
    doitChangerMotDePasse: s.user.mustChangePassword,
  }
}

const frDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR")

/* ---------------------------------------- Appels ---------------------------------------- */

/** Connexion avec un email ou un numéro de téléphone. */
export async function login(identifier: string, password: string) {
  const { accessToken, ...session } = await request<ApiSession & { accessToken: string }>("/espace/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  })
  await tokenStore.set(accessToken)
  return toSession(session)
}

/** Relit la session à partir du jeton enregistré. */
export async function fetchSession() {
  return toSession(await request<ApiSession>("/espace/me"))
}

/** Historique des rôles du membre connecté (« Mon espace »). */
export async function fetchRoleHistory() {
  const compte = await request<ApiCompte>("/espace/me/compte")
  return compte.history.map((h) => ({
    role: (fromApiRole(h.roleCode) && ROLE_LABEL[fromApiRole(h.roleCode)!]) || h.roleCode,
    debut: frDate(h.assignedAt),
    fin: h.revokedAt ? frDate(h.revokedAt) : null,
  }))
}

/** Première connexion : remplace le mot de passe temporaire. */
export async function changerMotDePasse(motDePasseActuel: string, nouveauMotDePasse: string) {
  return toSession(
    await request<ApiSession>("/espace/me/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: motDePasseActuel, newPassword: nouveauMotDePasse }),
    })
  )
}

/** Envoie un code à 6 chiffres sur l'email du compte (même réponse que le compte existe ou non). */
export function requestPasswordReset(identifier: string) {
  return request<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ identifier }) })
}

export function resetPassword(identifier: string, code: string, newPassword: string) {
  return request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ identifier, code, newPassword }),
  })
}

/* ------------------------------------ Comptes & Rôles ------------------------------------ */
// Droits vérifiés par l'API : admin, bureau et secrétaire ; le secrétaire ne gère que les comptes
// Choriste / Commissions ; rôles, réinitialisation du mot de passe : admin et bureau uniquement.

export async function fetchComptes() {
  return (await request<ApiCompte[]>("/espace/comptes")).map(toCompte)
}

export interface NouveauCompte {
  prenom: string
  nom: string
  telephone: string
  email: string
  /** Mot de passe temporaire, à transmettre au membre (il devra le changer). */
  motDePasse: string
  role: Role
}

export async function createCompte(form: NouveauCompte) {
  return toCompte(
    await request<ApiCompte>("/espace/comptes", {
      method: "POST",
      body: JSON.stringify({
        firstName: form.prenom,
        lastName: form.nom,
        phone: form.telephone,
        email: form.email || undefined,
        password: form.motDePasse,
        roleCode: TO_API_ROLE[form.role],
      }),
    })
  )
}

/** Un email vide le supprime : le membre se connecte alors avec son téléphone. */
export async function modifierCompte(compteId: number, form: Pick<NouveauCompte, "prenom" | "nom" | "telephone" | "email">) {
  return toCompte(
    await request<ApiCompte>(`/espace/comptes/${compteId}`, {
      method: "PATCH",
      body: JSON.stringify({ firstName: form.prenom, lastName: form.nom, phone: form.telephone, email: form.email || null }),
    })
  )
}

export async function setCompteActif(compteId: number, actif: boolean) {
  return toCompte(
    await request<ApiCompte>(`/espace/comptes/${compteId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: actif ? "ACTIVE" : "SUSPENDED" }),
    })
  )
}

export async function attribuerRole(compteId: number, role: Role) {
  return toCompte(
    await request<ApiCompte>(`/espace/comptes/${compteId}/roles`, { method: "POST", body: JSON.stringify({ roleCode: TO_API_ROLE[role] }) })
  )
}

export async function revoquerRole(compteId: number, role: Role) {
  return toCompte(await request<ApiCompte>(`/espace/comptes/${compteId}/roles/${TO_API_ROLE[role]}/revoke`, { method: "POST" }))
}

/** Nouveau mot de passe temporaire, renvoyé une seule fois (à transmettre au membre). */
export async function reinitialiserMotDePasse(compteId: number) {
  const { compte, temporaryPassword } = await request<{ compte: ApiCompte; temporaryPassword: string }>(
    `/espace/comptes/${compteId}/reset-password`,
    { method: "POST" }
  )
  return { compte: toCompte(compte), motDePasse: temporaryPassword }
}
