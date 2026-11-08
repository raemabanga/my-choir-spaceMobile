// Client de l'API de l'espace chorale (back-end_chorale, routes /espace/... et /auth/...).
// Même contrat que le portail web (my-choir-space-FrontOffice/src/lib/api.ts), adapté au mobile :
// jeton dans le stockage sécurisé du téléphone, adresse du serveur configurable.

import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"
import { fromApiRole, fromApiRoles, ROLE_LABEL, TO_API_ROLE } from "./roles"
import type { Chant, Evenement, Recu, Role } from "../types"

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

/* ------------------------------ Données de la chorale (mêmes routes que le web) ------------------------------ */
// Les identifiants de membres sont ceux des adhésions (Session.membershipId), comme sur le web.

type ApiStatutMois = "NON_DU" | "IMPAYE" | "PAYE" | "PAYE_EN_RETARD"

interface ApiStatutaire {
  mensualite: number
  montantAnnuel: number
  exercices: { annee: number; cartes: { membreId: number; nom: string; mois: ApiStatutMois[] }[] }[]
}

interface ApiEvenement {
  id: number
  titre: string
  date: string | null
  type: string
  budgetPrevisionnel: number
  montantCotisation: number
  collecte: number
  attendu: number
  versements: { membreId: number; nom: string; montant: number }[]
}

export interface ApiDepense {
  id: number
  date: string
  libelle: string
  categorie: string
  montant: number
  evenementId: number | null
  statut: "EN_ATTENTE" | "VALIDEE" | "REJETEE"
}

interface ApiPaiement {
  id: number
  /** Date de saisie. */
  date: string
  /** "AAAA-MM-JJ" : jour où le membre a payé (null pour les paiements plus anciens). */
  datePaiement: string | null
  /** Code du mode de règlement (null pour les paiements plus anciens). */
  mode: string | null
  membre: { id: number; nom: string }
  libelle: string
  montant: number
  evenementId: number | null
  recu: string
  auteur: string
  annulation: { date: string; par: string; motif: string } | null
}

interface ApiChant {
  id: number
  titre: string
  compositeur: string
  tonalite: string
  categorie: string
  paroles: string
}

export interface Membre {
  id: number
  nom: string
}

/** Le backend enregistre les types en minuscules ("concert") : majuscule initiale pour l'affichage. */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const todayISO = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Membres actifs de la chorale (rôles financiers uniquement : 403 pour les autres). */
export function fetchMembres() {
  return request<Membre[]>("/espace/membres")
}

/**
 * Cartes de cotisation de chaque exercice (années ayant des paiements, et toujours l'année en cours) :
 * toutes pour les rôles financiers, la sienne sinon.
 */
export async function fetchStatutaire() {
  const s = await request<ApiStatutaire>("/espace/cotisations/statutaire")
  return {
    mensualite: s.mensualite,
    exercices: s.exercices.map((e) => ({
      annee: e.annee,
      cartes: e.cartes.map((c) => ({
        membreId: c.membreId,
        nom: c.nom,
        payes: c.mois.map((m) => m === "PAYE" || m === "PAYE_EN_RETARD"),
      })),
    })),
  }
}

/** Événements de la chorale ; les dépenses sont rattachées ensuite (fetchDepenses). */
export async function fetchEvenements(): Promise<Evenement[]> {
  return (await request<ApiEvenement[]>("/espace/evenements")).map((e) => ({
    id: e.id,
    titre: e.titre,
    type: capitalize(e.type),
    date: e.date ?? "",
    description: "",
    budgetPrevisionnel: e.budgetPrevisionnel,
    cotisationMontant: e.montantCotisation,
    inscrits: [],
    depenses: [],
    contributions: Object.fromEntries(e.versements.map((v) => [v.membreId, v.montant])),
  }))
}

/** Dépenses (bureau, trésorerie, secrétariat, admin). */
export function fetchDepenses() {
  return request<ApiDepense[]>("/espace/depenses")
}

/** Paiements non annulés, sous forme de reçus : tous pour les rôles financiers, les siens sinon. */
export async function fetchRecus(): Promise<Recu[]> {
  return (await request<ApiPaiement[]>("/espace/paiements"))
    .filter((p) => !p.annulation)
    .map((p) => ({
      id: p.recu,
      chorishId: p.membre.id,
      type: p.evenementId == null ? "Statutaire" : "Événementielle",
      label: p.libelle,
      montant: p.montant,
      // Jour du paiement ("AAAA-MM-JJ" → "JJ/MM/AAAA", sans décalage de fuseau), sinon jour de saisie.
      date: p.datePaiement ? p.datePaiement.split("-").reverse().join("/") : frDate(p.date),
      enregistrePar: p.auteur,
      eventId: p.evenementId ?? undefined,
      mode: p.mode ?? undefined,
    }))
}

/** Jour et mode du paiement, envoyés avec chaque encaissement. */
export interface DetailsPaiement {
  /** "AAAA-MM-JJ", jamais dans le futur. */
  datePaiement: string
  /** Code d'un mode de règlement de la chorale. */
  mode: ModeReglement
}

export async function fetchChants(): Promise<Chant[]> {
  return (await request<ApiChant[]>("/espace/chants")).map((c) => ({ ...c, statut: "actif" }))
}

/** Cotisation statutaire d'un mois (0 = janvier). Refusée si le mois est déjà payé. */
export function payerStatutaire(membreId: number, mois: number, annee: number, montant: number, details: DetailsPaiement) {
  return request<ApiPaiement>("/espace/paiements", {
    method: "POST",
    body: JSON.stringify({ membreId, montant, type: "STATUTAIRE", mois, annee, ...details }),
  })
}

export function payerEvenement(membreId: number, evenementId: number, montant: number, details: DetailsPaiement) {
  return request<ApiPaiement>("/espace/paiements", {
    method: "POST",
    body: JSON.stringify({ membreId, montant, type: "EVENEMENTIELLE", evenementId, ...details }),
  })
}

export function creerEvenement(form: { titre: string; type: string; date: string; budgetPrevisionnel: number; montantCotisation: number }) {
  return request<ApiEvenement>("/espace/evenements", {
    method: "POST",
    body: JSON.stringify({ ...form, date: form.date || null }),
  })
}

/** Code d'un mode de règlement de la chorale ("ESPECES", "ORANGE_MONEY"…), voir fetchParametres. */
export type ModeReglement = string

export function creerDepense(form: {
  evenementId: number
  libelle: string
  montant: number
  categorie: string
  beneficiaire: string
  mode: ModeReglement
}) {
  return request<ApiDepense>("/espace/depenses", { method: "POST", body: JSON.stringify({ ...form, date: todayISO() }) })
}

/** Refusé par l'API pour une dépense que l'on a saisie soi-même. */
export function validerDepense(id: number) {
  return request<ApiDepense>(`/espace/depenses/${id}/valider`, { method: "POST" })
}

export function creerChant(form: Omit<ApiChant, "id">) {
  return request<ApiChant>("/espace/chants", { method: "POST", body: JSON.stringify(form) })
}

export function supprimerChant(id: number) {
  return request<void>(`/espace/chants/${id}`, { method: "DELETE" })
}

/* ------------------------------ Paramètres de la chorale ------------------------------ */
// Gérés dans les Paramètres du portail web (bureau, secrétaire ; commission musicale pour les
// catégories de chant). Le mobile les lit pour proposer les mêmes listes que le web.

export interface Parametres {
  /** Cotisation statutaire mensuelle (F CFA). */
  mensualite: number
  /** En minuscules ("concert") : afficher avec une majuscule initiale. */
  typesEvenement: string[]
  categoriesDepense: string[]
  categoriesChant: string[]
  /** Tonalités proposées à l'ajout d'un chant (« Sol majeur »…). */
  tonalitesChant: string[]
  modesReglement: { code: ModeReglement; label: string }[]
}

export function fetchParametres() {
  return request<Parametres>("/espace/parametres")
}
