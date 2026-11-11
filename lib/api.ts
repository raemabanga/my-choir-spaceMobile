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
  /** Mot de passe temporaire tant que le membre n'a pas choisi le sien (null sinon, ou sans droit sur ce compte). */
  temporaryPassword?: string | null
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
  /** Mot de passe temporaire, affiché tant que le membre n'a pas choisi le sien (null sinon). */
  motDePasseTemporaire: string | null
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
    motDePasseTemporaire: c.temporaryPassword ?? null,
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

/** Refusée (409) si le membre a des paiements ou a saisi des opérations : le désactiver à la place. */
export async function supprimerCompte(compteId: number) {
  await request<void>(`/espace/comptes/${compteId}`, { method: "DELETE" })
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

export interface ApiEvenement {
  id: number
  titre: string
  date: string | null
  type: string
  budgetPrevisionnel: number
  montantCotisation: number
  collecte: number
  attendu: number
  versements: { membreId: number; nom: string; montant: number }[]
  /** Les choristes peuvent s'inscrire (absent sur un serveur plus ancien). */
  inscriptionsOuvertes?: boolean
  inscrits?: { membreId: number; nom: string }[]
  inscrit?: boolean
  /** Appel fait pour cet événement (absent sur un serveur plus ancien). */
  presence?: PresenceEvenement | null
}

export interface ApiDepense {
  id: number
  date: string
  libelle: string
  categorie: string
  montant: number
  evenementId: number | null
  statut: "EN_ATTENTE" | "VALIDEE" | "REJETEE"
  /** Qui l'a saisie (identifiant utilisateur) : l'API refuse qu'on valide sa propre dépense. */
  saisiPar?: { id: number; nom: string }
}

export interface ApiPaiement {
  id: number
  /** Date de saisie. */
  date: string
  /** "AAAA-MM-JJ" : jour où le membre a payé (null pour les paiements plus anciens). */
  datePaiement: string | null
  /** Code du mode de règlement (null pour les paiements plus anciens). */
  mode: string | null
  membre: { id: number; nom: string }
  type: "STATUTAIRE" | "EVENEMENTIELLE"
  /** STATUTAIRE : mois payé (0 = janvier) et son exercice. */
  mois: number | null
  annee: number | null
  libelle: string
  montant: number
  evenementId: number | null
  recu: string
  auteur: string
  annulation: { date: string; par: string; motif: string } | null
}

export interface ApiChant {
  id: number
  titre: string
  compositeur: string
  tonalite: string
  categorie: string
  paroles: string
  /** Partition et audio (absents sur un serveur plus ancien). */
  document?: { nom: string; type: string; taille: number } | null
  audio?: { nom: string; type: string; taille: number } | null
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
        // Mois antérieurs à l'adhésion du membre : rien n'est dû (comme sur le web).
        nonDus: c.mois.map((m) => m === "NON_DU"),
      })),
    })),
  }
}

/** Événement de l'API dans la forme de l'app (les dépenses sont rattachées ensuite). */
export function toEvenement(e: ApiEvenement): Evenement {
  return {
    id: e.id,
    titre: e.titre,
    type: capitalize(e.type),
    date: e.date ?? "",
    description: "",
    budgetPrevisionnel: e.budgetPrevisionnel,
    cotisationMontant: e.montantCotisation,
    depenses: [],
    contributions: Object.fromEntries(e.versements.map((v) => [v.membreId, v.montant])),
    inscriptionsOuvertes: e.inscriptionsOuvertes ?? false,
    inscrits: (e.inscrits ?? []).map((i) => ({ id: i.membreId, nom: i.nom })),
    inscrit: e.inscrit ?? false,
    aFeuillePresence: e.presence != null,
  }
}

/** Événements de la chorale ; les dépenses sont rattachées ensuite (fetchDepenses). */
export async function fetchEvenements(): Promise<Evenement[]> {
  return (await request<ApiEvenement[]>("/espace/evenements")).map(toEvenement)
}

/** Champs modifiables d'un événement (tous facultatifs). `date: null` retire la date. */
export interface ModificationEvenement {
  titre?: string
  type?: string
  date?: string | null
  budgetPrevisionnel?: number
  montantCotisation?: number
  inscriptionsOuvertes?: boolean
}

export function modifierEvenement(id: number, form: ModificationEvenement) {
  return request<ApiEvenement>(`/espace/evenements/${id}`, { method: "PATCH", body: JSON.stringify(form) })
}

/** Inscription du membre connecté à un événement ouvert aux inscriptions. */
export function inscrireEvenement(id: number) {
  return request<ApiEvenement>(`/espace/evenements/${id}/inscription`, { method: "POST" })
}

/** Désinscription du membre connecté. */
export function desinscrireEvenement(id: number) {
  return request<ApiEvenement>(`/espace/evenements/${id}/inscription`, { method: "DELETE" })
}

/** Inscriptions de chaque événement (tirées de la liste des événements). */
export async function fetchInscriptions() {
  const evenements = await request<ApiEvenement[]>("/espace/evenements")
  return evenements.flatMap((e) => (e.inscrits ?? []).map((i) => ({ evenementId: e.id, membreId: i.membreId, nom: i.nom })))
}

/** Refusé (409) si des paiements, des dépenses, des recettes ou une feuille de présence sont rattachés à l'événement. */
export function supprimerEvenement(id: number) {
  return request<void>(`/espace/evenements/${id}`, { method: "DELETE" })
}

/** Dépenses (bureau, trésorerie, secrétariat, admin). */
export function fetchDepenses() {
  return request<ApiDepense[]>("/espace/depenses")
}

/** Paiements tels que renvoyés par l'API (annulés compris) : tous pour les rôles financiers, les siens sinon. */
export function fetchPaiements() {
  return request<ApiPaiement[]>("/espace/paiements")
}

/** Annule un paiement saisi par erreur : son mois redevient impayé. Motif obligatoire. */
export function annulerPaiement(id: number, motif: string) {
  return request<ApiPaiement>(`/espace/paiements/${id}/annuler`, { method: "POST", body: JSON.stringify({ motif }) })
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
  return request<ApiChant[]>("/espace/chants")
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

export function creerEvenement(form: {
  titre: string
  type: string
  date: string
  budgetPrevisionnel: number
  montantCotisation: number
  /** Les choristes peuvent s'inscrire. */
  inscriptionsOuvertes?: boolean
}) {
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
  /** "AAAA-MM-JJ" : jour de la dépense (aujourd'hui si absent). Saisie hors ligne : le jour de la saisie. */
  date?: string
}) {
  return request<ApiDepense>("/espace/depenses", { method: "POST", body: JSON.stringify({ ...form, date: form.date || todayISO() }) })
}

/** Refusé par l'API pour une dépense que l'on a saisie soi-même. */
export function validerDepense(id: number) {
  return request<ApiDepense>(`/espace/depenses/${id}/valider`, { method: "POST" })
}

export function creerChant(form: Omit<ApiChant, "id" | "document" | "audio">) {
  return request<ApiChant>("/espace/chants", { method: "POST", body: JSON.stringify(form) })
}

export function supprimerChant(id: number) {
  return request<void>(`/espace/chants/${id}`, { method: "DELETE" })
}

/* ------------------------------------ Présences ------------------------------------ */
// Faire l'appel : bureau, secrétariat, commission recette et commission présence (l'admin lit
// seulement, aucun écran mobile). « Mon assiduité » : tous les membres.

/** CULTE : plusieurs par jour, numérotés de 1 à NUMERO_CULTE_MAX (`numero`). */
export type TypeSeance = "REPETITION" | "EVENEMENT" | "CULTE"

/** Nombre maximal de cultes dans une journée (numéros 1 à 5, comme l'API). */
export const NUMERO_CULTE_MAX = 5

/** Libellé d'un type de séance (« Répétition », « Culte », « Événement »). */
export const LIBELLE_TYPE_SEANCE: Record<TypeSeance, string> = { REPETITION: "Répétition", CULTE: "Culte", EVENEMENT: "Événement" }

/** Nom d'un culte d'après son numéro, comme le `libelle` de l'API : 1 → « 1er culte », n → « ne culte ». */
export const nomCulte = (numero: number | null | undefined) => `${numero ?? 1}${(numero ?? 1) === 1 ? "er" : "e"} culte`
export type StatutPresence = "PRESENT" | "EXCUSE" | "ABSENT"
export type CategorieAssiduite = "ASSIDU" | "IRREGULIER" | "DECROCHEUR"

export interface PresenceMembre {
  id: number
  nom: string
  /** "AAAA-MM-JJ", informatif seulement. */
  joinedAt: string
}

export interface LignePresence {
  membreId: number
  nom: string
  statut: StatutPresence
  motif: string | null
}

/** Feuille de présence enregistrée (une répétition par jour, un culte par (jour, numéro), une feuille par événement). */
export interface Seance {
  id: number
  type: TypeSeance
  /** "AAAA-MM-JJ" */
  date: string
  /** Répétition et culte (« Culte de 7 h ») ; null pour un événement. */
  titre: string | null
  /** Numéro du culte dans la journée (1 à 5) ; null pour les autres types. */
  numero: number | null
  /** Culte : titre ?? « 1er culte », « 2e culte »… */
  libelle: string
  evenement: { id: number; titre: string } | null
  presents: number
  excuses: number
  absents: number
  effectif: number
  taux: number
  auteur: string | null
  /** Date-heure ISO du dernier enregistrement. */
  majLe: string
  presences?: LignePresence[]
}

export interface FeuillePresence {
  /** null : appel pas encore fait. */
  seance: Seance | null
  type: TypeSeance
  date: string
  evenement: { id: number; titre: string; date: string | null } | null
  lignes: (LignePresence & { actif: boolean; inscrit: boolean; enregistre: boolean })[]
}

export interface MesPresences {
  /** "AAAA-MM-JJ", début de la période (365 jours). */
  depuis: string
  attendues: number
  presents: number
  excuses: number
  absents: number
  taux: number | null
  categorie: CategorieAssiduite | null
  dernieres: { seanceId: number; date: string; type: TypeSeance; libelle: string; statut: StatutPresence; motif: string | null }[]
}

export interface FeuilleAEnvoyer {
  date: string
  /** Répétition et culte (ignoré par l'API pour un événement). */
  titre: string | null
  /** Culte seulement (1 à 5, obligatoire) ; null pour les autres types. */
  numero: number | null
  presences: { membreId: number; statut: StatutPresence; motif: string | null }[]
  /** `majLe` serveur de la version de départ (null : aucune séance vue). */
  base: string | null
}

/** Totaux de l'appel d'un événement (EvenementEntity.presence). */
export interface PresenceEvenement {
  seanceId: number
  presents: number
  excuses: number
  absents: number
  effectif: number
}

/** Choristes actifs à appeler (rôles « présences » ; 403 pour les autres). */
export function fetchPresenceMembres() {
  return request<PresenceMembre[]>("/espace/presences/membres")
}

/** Séances depuis `du` ("AAAA-MM-JJ"), avec toutes leurs lignes. */
export function fetchSeances(du: string) {
  return request<Seance[]>(`/espace/presences/seances?du=${du}&avecPresences=true`)
}

/** Crée, remplace ou fusionne la feuille (clé : répétition du jour, culte (jour, numéro), ou événement). Seule écriture : sert à la création et à la modification. */
export function enregistrerFeuille(body: FeuilleAEnvoyer & { type: TypeSeance; evenementId: number | null }) {
  return request<FeuillePresence>("/espace/presences/feuille", { method: "PUT", body: JSON.stringify(body) })
}

export function supprimerSeance(id: number) {
  return request<void>(`/espace/presences/seances/${id}`, { method: "DELETE" })
}

/** Assiduité du membre connecté sur les 365 derniers jours (tous les membres). */
export function fetchMesPresences() {
  return request<MesPresences>("/espace/presences/moi")
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
  /** Change à chaque nouveau logo (pour le recharger) ; null sans logo. */
  logoVersion: string | null
}

export function fetchParametres() {
  return request<Parametres>("/espace/parametres")
}

/**
 * Source <Image> du logo de la chorale. La route demande le jeton : il passe en en-tête
 * (pris en charge par <Image> sur iOS et Android). La version évite l'image en cache périmée.
 */
/** Le téléphone du membre connecté recevra les notifications push. */
export function enregistrerPushToken(token: string, plateforme: "ios" | "android") {
  return request<void>("/espace/notifications/push-tokens", { method: "POST", body: JSON.stringify({ token, plateforme }) })
}

/** Notification du membre (même liste que la cloche du portail web). */
export interface NotificationEspace {
  id: number
  type: string
  titre: string
  message: string
  /** Page du portail concernée ("/cotisations", "/chants/12"…), traduite en écran par ecranDeNotification. */
  lien: string | null
  lue: boolean
  createdAt: string
}

export interface NotificationsReponse {
  /** Toutes les non lues (pas seulement celles de la liste). */
  nonLues: number
  notifications: NotificationEspace[]
}

export function fetchNotifications() {
  return request<NotificationsReponse>("/espace/notifications")
}

export function marquerNotificationLue(id: number) {
  return request<NotificationsReponse>(`/espace/notifications/${id}/lue`, { method: "POST" })
}

export function toutMarquerNotificationsLues() {
  return request<NotificationsReponse>("/espace/notifications/lues", { method: "POST" })
}

/** Jeton de connexion enregistré (lu avant une déconnexion). */
export const jetonEnregistre = () => tokenStore.get()

/**
 * Déconnexion : ce téléphone ne reçoit plus les notifications du membre. Appel isolé avec le
 * jeton de la session fermée : un refus (jeton expiré) ne touche jamais la session suivante.
 */
export async function supprimerPushToken(token: string, jetonSession: string) {
  try {
    await fetch(API_URL + "/espace/notifications/push-tokens/supprimer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + jetonSession },
      body: JSON.stringify({ token }),
    })
  } catch {
    // Sans réseau : le jeton passera au prochain membre connecté sur ce téléphone.
  }
}

/** Adresse et en-tête d'authentification du document ou de l'audio d'un chant (téléchargement). */
export async function fichierChantSource(chantId: number, genre: "document" | "audio") {
  const token = await tokenStore.get()
  return {
    uri: `${API_URL}/espace/chants/${chantId}/fichiers/${genre}`,
    headers: token ? { Authorization: "Bearer " + token } : undefined,
  }
}

export async function logoSource(version: string) {
  const token = await tokenStore.get()
  return {
    uri: `${API_URL}/espace/parametres/logo?v=${encodeURIComponent(version)}`,
    headers: token ? { Authorization: "Bearer " + token } : undefined,
  }
}
