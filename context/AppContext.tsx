// État global de l'app : session, droits, et données de la chorale.
//
// Mode hors ligne : les données ne viennent jamais directement de l'API. Elles sont lues dans
// SQLite (context/choraleData.ts) et chaque action écrit d'abord sur le téléphone (repositories
// de lib/offline/entities.ts) ; le syncManager envoie au serveur dès que le réseau le permet.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { AppState } from "react-native"
import * as api from "../lib/api"
import { currentYear, MONTHS } from "../lib/format"
import { cacheSession, clearCachedSession, dataChanged, readCachedSession, syncManager, useSyncStatusStore } from "../lib/offline"
import {
  chantRepository,
  depenseRepository,
  evenementRepository,
  inscriptionRepository,
  paiementRepository,
  type EvenementData,
} from "../lib/offline/entities"
import { desinscrirePush, inscrirePush } from "../lib/push"
import { computePerms, ROLE_LABEL, type Perms } from "../lib/roles"
import { Chant, Chorist, Evenement, Permission, Recu, RoleHistoryEntry } from "../types"
import { EMPTY_DATA, evenementARattachements, lireDonneesChorale, parId } from "./choraleData"

/** "AAAA-MM-JJ" du jour en heure locale (toISOString donnerait la veille entre minuit et 1 h en UTC+1). */
function aujourdhuiLocal() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Listes proposées avant le chargement des Paramètres de la chorale (mêmes défauts que le backend). */
const PARAMETRES_PAR_DEFAUT: Omit<api.Parametres, "mensualite"> = {
  logoVersion: null,
  typesEvenement: ["concert", "sortie", "veillée", "mariage", "décès", "maladie"],
  categoriesDepense: ["Location", "Transport", "Sonorisation", "Restauration", "Partitions", "Tenues", "Instruments", "Communication", "Divers"],
  categoriesChant: ["Louange", "Adoration", "Fête", "Deuil"],
  tonalitesChant: [
    "Do majeur", "Do mineur", "Ré majeur", "Ré mineur", "Mi♭ majeur", "Mi majeur", "Mi mineur", "Fa majeur",
    "Fa mineur", "Sol majeur", "Sol mineur", "La majeur", "La mineur", "Si♭ majeur", "Si majeur", "Si mineur",
  ],
  modesReglement: [
    { code: "ESPECES", label: "Espèces" },
    { code: "MOBILE_MONEY", label: "Mobile Money" },
    { code: "VIREMENT", label: "Virement" },
    { code: "CHEQUE", label: "Chèque" },
  ],
}

/** Champs d'un événement saisis dans le formulaire (création et modification). */
export interface EventInput {
  titre: string
  type: string
  /** "AAAA-MM-JJ", ou "" si la date n'est pas fixée. */
  date: string
  budgetPrevisionnel: number
  cotisationMontant: number
  /** Les choristes peuvent s'inscrire. */
  inscriptionsOuvertes: boolean
}

interface ChantInput {
  titre: string
  compositeur: string
  categorie: string
  tonalite: string
  paroles: string
}

/** Champs d'une dépense exigés par l'API. */
export interface DepenseDetails {
  categorie: string
  beneficiaire: string
  mode: api.ModeReglement
}

interface AppContextValue {
  userId: number | null
  currentUser: Chorist | null
  chorists: Chorist[]
  roleLabels: Record<string, string>
  roleHistory: Record<number, RoleHistoryEntry[]>
  /** Session de l'API (null : non connecté). */
  session: api.Session | null
  /** Faux tant que la session enregistrée n'a pas été relue au démarrage. */
  authReady: boolean
  choraleNom: string
  /** Année en cours (exercice des cotisations statutaires) ; change d'elle-même au 1er janvier. */
  annee: number
  /** Montant mensuel de la cotisation statutaire (fixé par la chorale). */
  mensualite: number
  /**
   * Listes de la chorale (Paramètres du portail web) : types d'événement (en minuscules),
   * catégories de dépense et de chant, modes de règlement.
   */
  parametres: Omit<api.Parametres, "mensualite">
  /** Vrai pendant une synchronisation avec le serveur. */
  syncing: boolean
  /** Dernière erreur de synchronisation (null si tout va bien ou hors ligne). */
  syncError: string | null
  /** Envoie les modifications en attente et retélécharge les données (sans effet hors ligne). */
  refresh: () => Promise<void>
  /** Connexion (email ou téléphone + mot de passe). Lève une ApiError en cas de refus. */
  signIn: (identifier: string, password: string) => Promise<api.Session>
  /** Première connexion : remplace le mot de passe temporaire. */
  changePassword: (current: string, next: string) => Promise<void>
  events: Evenement[]
  chants: Chant[]
  recus: Recu[]
  /** Cartes de cotisation de l'année en cours, par membre (12 mois : payé ou non). */
  statutaire: Record<number, boolean[]>
  /** Cartes de chaque exercice : année → membre → 12 mois. */
  statutaireParAnnee: Record<number, Record<number, boolean[]>>
  /** Exercices consultables, du plus ancien au plus récent (toujours l'année en cours). */
  anneesStatutaire: number[]
  /** Droits du membre courant (mêmes règles que le web). */
  perms: Perms
  can: (perm: Permission) => boolean
  logout: () => void
  // Actions : enregistrées sur le téléphone tout de suite (réseau ou pas), envoyées ensuite.
  // Elles lèvent une Error avec un message prêt à afficher quand la saisie est refusée.
  /**
   * `year` : exercice du mois réglé (année en cours, ou une année passée pour un arriéré).
   * `details` : jour où le membre a payé et mode de règlement (enregistrés et imprimés sur le reçu).
   */
  confirmPaymentStatutaire: (chorishId: number, monthIndex: number, amount: number, year: number, details: api.DetailsPaiement) => Promise<void>
  confirmEventPayment: (eventId: number, chorishId: number, amount: number, details: api.DetailsPaiement) => Promise<void>
  /** Annule un paiement (motif obligatoire) : son mois ou sa contribution ne compte plus. */
  cancelPayment: (receiptLocalId: string, motif: string) => Promise<void>
  createEvent: (input: EventInput) => Promise<void>
  updateEvent: (eventId: number, input: EventInput) => Promise<void>
  /** Refusé si des paiements ou des dépenses sont rattachés à l'événement (règle du serveur). */
  deleteEvent: (eventId: number) => Promise<void>
  /**
   * Inscrit (`inscrire` vrai) ou désinscrit le membre connecté. L'intention vient de l'écran :
   * un double appui ne défait pas l'action.
   */
  toggleInscription: (eventId: number, inscrire: boolean) => Promise<void>
  addDepense: (eventId: number, label: string, montant: number, details: DepenseDetails) => Promise<void>
  validateDepense: (eventId: number, idx: number) => Promise<void>
  /** Ajoute un chant au répertoire (l'API ne permet pas encore d'en modifier un). */
  createChant: (data: ChantInput) => Promise<void>
  /** Supprime le chant du répertoire. */
  deleteSong: (id: number) => Promise<void>
  receiptsFor: (chorishId: number) => Recu[]
}

const AppContext = createContext<AppContextValue | null>(null)

/** Libellés des rôles : mêmes que le web. */
const roleLabels: Record<string, string> = ROLE_LABEL

/** Erreur de saisie : message affiché tel quel. */
const refus = (message: string) => new Error(message)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null)
  const [annee, setAnnee] = useState(currentYear)
  const [session, setSession] = useState<api.Session | null>(null)
  const [authReady, setAuthReady] = useState(false)

  // Session courante et « génération » : une réponse arrivée après une déconnexion
  // (ou un changement de compte) est ignorée.
  const sessionRef = useRef<api.Session | null>(null)
  const generation = useRef(0)
  /** Fin du changement de propriétaire des données hors ligne (effacement éventuel du précédent). */
  const ownerReady = useRef<Promise<void>>(Promise.resolve())

  /* ------------------------------ Données (SQLite) ------------------------------ */

  const offlineReady = useSyncStatusStore((s) => s.ready)
  const syncState = useSyncStatusStore((s) => s.syncState)
  const lastError = useSyncStatusStore((s) => s.lastError)
  const isOnline = useSyncStatusStore((s) => s.isOnline)

  // Chaque écriture locale ou téléchargement relit les données (regroupé : une relecture par instant).
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = dataChanged.subscribe(() => {
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        setVersion((v) => v + 1)
      }, 16)
    })
    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [])

  const membershipId = session?.membershipId ?? null
  const data = useMemo(() => {
    if (!offlineReady || membershipId === null) return EMPTY_DATA
    try {
      return lireDonneesChorale(membershipId, annee)
    } catch (e) {
      console.warn("[offline] lecture des données", e)
      return EMPTY_DATA
    }
    // `version` : relecture après chaque changement des données locales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineReady, membershipId, annee, version])

  const statutaireParAnnee = data.statutaireParAnnee
  const statutaire = useMemo(() => statutaireParAnnee[annee] ?? {}, [statutaireParAnnee, annee])
  const anneesStatutaire = useMemo(
    () => [...new Set([...Object.keys(statutaireParAnnee).map(Number), annee])].sort((a, b) => a - b),
    [statutaireParAnnee, annee]
  )

  /* ------------------------------ Membres ------------------------------ */

  const sessionChorist = useMemo<Chorist | null>(
    () => (session ? { id: session.membershipId, name: session.nom, roles: session.roles, numero: String(session.membershipId) } : null),
    [session]
  )
  const chorists = useMemo(() => (sessionChorist ? [sessionChorist, ...data.membres] : []), [sessionChorist, data.membres])
  const roleHistory = useMemo(
    () => (sessionChorist ? { [sessionChorist.id]: data.historiqueRoles } : {}),
    [sessionChorist, data.historiqueRoles]
  )

  const currentUser = useMemo(() => chorists.find((c) => c.id === userId) ?? null, [chorists, userId])

  /* ------------------------------ Synchronisation ------------------------------ */

  /** Envoie les modifications en attente et retélécharge tout (hors ligne : rien, sans erreur). */
  const refresh = useCallback(async () => {
    const current = sessionRef.current
    if (!current || current.doitChangerMotDePasse) return
    // Année relue à chaque synchronisation : au 1er janvier, la carte de la nouvelle année (vierge) s'affiche.
    setAnnee(currentYear())
    await syncManager.forceSync()
  }, [])

  /** Ouvre la session : identifiant = adhésion (comme le web), puis synchronisation en arrière-plan. */
  const openSession = useCallback(
    (next: api.Session) => {
      generation.current++
      sessionRef.current = next
      setSession(next)
      setUserId(next.membershipId)
      // Mode hors ligne : un autre membre sur ce téléphone efface les données locales du précédent,
      // puis la session est gardée pour rouvrir l'app sans réseau.
      const gen = generation.current
      ownerReady.current = syncManager
        .setOwner(String(next.membershipId))
        .then(() => {
          cacheSession(next)
          // Données déjà sur le téléphone : on les met à jour (la première fois, c'est l'écran initial-sync).
          if (gen === generation.current && !next.doitChangerMotDePasse && syncManager.isInitialSyncDone()) void refresh()
          // Notifications push sur ce téléphone (sans effet si indisponibles ou refusées).
          if (gen === generation.current && !next.doitChangerMotDePasse) void inscrirePush()
        })
        .catch((e) => console.warn("[offline] changement d'utilisateur", e))
    },
    [refresh]
  )

  const closeSession = useCallback(() => {
    // Plus de session : rien ne doit partir vers le serveur (les opérations restent en file).
    syncManager.suspend()
    generation.current++
    sessionRef.current = null
    clearCachedSession()
    setSession(null)
    setUserId(null)
  }, [])

  // Au démarrage : relit la session à partir du jeton enregistré.
  // Jeton refusé (expiré, compte désactivé) : retour à l'écran de connexion.
  useEffect(() => {
    api.setUnauthorizedHandler(closeSession)
    let cancelled = false
    ;(async () => {
      try {
        if (await api.hasStoredToken()) {
          const restored = await api.fetchSession()
          if (!cancelled) openSession(restored)
        }
      } catch (e) {
        // Serveur injoignable (pas de réseau, serveur arrêté) : on rouvre la dernière session connue
        // pour travailler hors ligne. Jeton refusé (401) : déjà effacé par l'API, retour à la connexion.
        const unreachable = e instanceof api.ApiError && (e.status === 0 || e.status >= 500)
        const cached = unreachable ? readCachedSession<api.Session>() : null
        if (cached) {
          if (!cancelled) openSession(cached)
        } else {
          await api.clearToken()
        }
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    })()
    return () => {
      cancelled = true
      api.setUnauthorizedHandler(null)
    }
  }, [openSession, closeSession])

  // Retour au premier plan : synchronisation, pour voir les changements faits depuis le web.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setAnnee(currentYear())
        if (syncManager.isInitialSyncDone()) void refresh()
      }
    })
    return () => sub.remove()
  }, [refresh])

  // App restée ouverte au passage du Nouvel An : vérification toutes les heures.
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentYear() !== annee) {
        setAnnee(currentYear())
        void refresh()
      }
    }, 60 * 60 * 1000)
    return () => clearInterval(timer)
  }, [annee, refresh])

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      // Avant que le nouveau jeton soit enregistré : la file d'un éventuel utilisateur précédent
      // ne doit jamais partir avec lui. setOwner (dans openSession) relance l'envoi.
      syncManager.suspend()
      let next: api.Session
      try {
        next = await api.login(identifier, password)
      } catch (e) {
        // Connexion refusée : l'utilisateur en place (s'il y en a un) reprend la synchronisation.
        if (sessionRef.current) void syncManager.setOwner(String(sessionRef.current.membershipId))
        throw e
      }
      openSession(next)
      // L'écran de connexion choisit ensuite entre l'accueil et la synchronisation initiale :
      // les données d'un éventuel utilisateur précédent doivent déjà être effacées.
      await ownerReady.current
      return next
    },
    [openSession]
  )

  const changePassword = useCallback(
    async (current: string, next: string) => {
      openSession(await api.changerMotDePasse(current, next))
      await ownerReady.current
    },
    [openSession]
  )

  const perms = useMemo(() => computePerms(currentUser?.roles ?? []), [currentUser])
  const can = useCallback((perm: Permission) => currentUser !== null && perms[perm], [currentUser, perms])

  const logout = useCallback(() => {
    syncManager.suspend()
    closeSession()
    void (async () => {
      // Jeton lu puis effacé tout de suite ; la désinscription du push utilise cet ancien jeton
      // (une reconnexion pendant ce temps garde son propre jeton intact).
      const jeton = await api.jetonEnregistre()
      await api.clearToken()
      await desinscrirePush(jeton)
    })()
  }, [closeSession])

  /* ------------------------------ Actions (écriture locale) ------------------------------ */

  const events = data.events

  /** Événement affiché → enregistrement local (identifiant serveur ou provisoire). */
  const evenementLocal = useCallback(
    (eventId: number) => {
      // parId : un identifiant provisoire reste valable après l'envoi de l'événement.
      const ev = parId(events, eventId)
      const record = ev?.localId ? evenementRepository.getByLocalId(ev.localId) : null
      if (!ev || !record) throw refus("Cet événement n'existe plus.")
      return { ev, record }
    },
    [events]
  )

  /** Lien vers l'événement d'un paiement ou d'une dépense : identifiant serveur, sinon identifiant local. */
  const lienEvenement = useCallback(
    (eventId: number) => {
      const { record } = evenementLocal(eventId)
      return record.serverId != null ? { evenementId: Number(record.serverId), evenementLocalId: null } : { evenementId: null, evenementLocalId: record.localId }
    },
    [evenementLocal]
  )

  const auteur = currentUser?.name ?? session?.nom ?? ""

  const confirmPaymentStatutaire = useCallback(
    async (chorishId: number, monthIndex: number, amount: number, year: number, details: api.DetailsPaiement) => {
      // Même règle que le serveur : un mois ne se paie qu'une fois.
      if (statutaireParAnnee[year]?.[chorishId]?.[monthIndex]) throw refus(`Le mois de ${MONTHS[monthIndex]} ${year} est déjà réglé.`)
      const membre = chorists.find((c) => c.id === chorishId)
      paiementRepository.create({
        type: "STATUTAIRE",
        membreId: chorishId,
        membreNom: membre?.name ?? "",
        montant: amount,
        mois: monthIndex,
        annee: year,
        evenementId: null,
        evenementLocalId: null,
        datePaiement: details.datePaiement,
        mode: details.mode,
        libelle: `Cotisation — ${MONTHS[monthIndex]} ${year}`,
        recu: null,
        auteur,
        saisiLe: new Date().toISOString(),
      })
    },
    [statutaireParAnnee, chorists, auteur]
  )

  const confirmEventPayment = useCallback(
    async (eventId: number, chorishId: number, amount: number, details: api.DetailsPaiement) => {
      const { ev } = evenementLocal(eventId)
      const membre = chorists.find((c) => c.id === chorishId)
      paiementRepository.create({
        type: "EVENEMENTIELLE",
        membreId: chorishId,
        membreNom: membre?.name ?? "",
        montant: amount,
        mois: null,
        annee: null,
        ...lienEvenement(eventId),
        datePaiement: details.datePaiement,
        mode: details.mode,
        libelle: ev.titre,
        recu: null,
        auteur,
        saisiLe: new Date().toISOString(),
      })
    },
    [evenementLocal, lienEvenement, chorists, auteur]
  )

  const cancelPayment = useCallback(async (receiptLocalId: string, motif: string) => {
    if (!motif.trim()) throw refus("Indiquez le motif de l'annulation.")
    if (!paiementRepository.getByLocalId(receiptLocalId)) throw refus("Ce paiement n'existe plus.")
    // Jamais envoyé : il disparaît simplement. Déjà sur le serveur : annulation envoyée avec son motif.
    paiementRepository.remove(receiptLocalId, { motif: motif.trim() })
  }, [])

  const toEvenementData = (input: EventInput): EvenementData => ({
    titre: input.titre.trim(),
    type: input.type,
    date: input.date,
    budgetPrevisionnel: input.budgetPrevisionnel,
    cotisationMontant: input.cotisationMontant,
    inscriptionsOuvertes: input.inscriptionsOuvertes,
  })

  const createEvent = useCallback(async (input: EventInput) => {
    evenementRepository.create(toEvenementData(input))
  }, [])

  const updateEvent = useCallback(
    async (eventId: number, input: EventInput) => {
      const { record } = evenementLocal(eventId)
      evenementRepository.update(record.localId, toEvenementData(input))
    },
    [evenementLocal]
  )

  const deleteEvent = useCallback(
    async (eventId: number) => {
      const { record } = evenementLocal(eventId)
      // Même règle que le serveur (409) : paiements (même annulés) ou dépenses (même rejetées) rattachés.
      if (evenementARattachements(record))
        throw refus("Des paiements ou des dépenses sont rattachés à cet événement : il ne peut pas être supprimé.")
      evenementRepository.remove(record.localId)
    },
    [evenementLocal]
  )

  const toggleInscription = useCallback(
    async (eventId: number, inscrire: boolean) => {
      const { ev, record } = evenementLocal(eventId)
      if (!session) throw refus("Connectez-vous pour vous inscrire.")
      // Mes inscriptions à cet événement (serveur ou faites sur le téléphone).
      const vise = (d: { evenementId: number | null; evenementLocalId?: string | null }) =>
        (record.serverId != null && d.evenementId === Number(record.serverId)) || d.evenementLocalId === record.localId
      const miennes = inscriptionRepository.getAll().filter((i) => i.data.membreId === session.membershipId && vise(i.data))
      // Inscription refusée avant d'atteindre le serveur : elle ne compte pas (l'écran ne l'affiche pas).
      const refusees = miennes.filter((i) => i.syncStatus === "failed" && i.serverId == null)
      refusees.forEach((i) => inscriptionRepository.remove(i.localId))
      const mienne = miennes.find((i) => !refusees.includes(i))
      if (!inscrire) {
        // Jamais envoyée : elle disparaît ; sinon la désinscription part au retour du réseau.
        if (mienne) inscriptionRepository.remove(mienne.localId)
        return
      }
      if (mienne) return // Déjà inscrit (double appui).
      if (!ev.inscriptionsOuvertes) throw refus("Les inscriptions ne sont pas ouvertes pour cet événement.")
      inscriptionRepository.create({ ...lienEvenement(eventId), membreId: session.membershipId, nom: session.nom })
    },
    [evenementLocal, lienEvenement, session]
  )

  const addDepense = useCallback(
    async (eventId: number, label: string, montant: number, details: DepenseDetails) => {
      depenseRepository.create({
        ...lienEvenement(eventId),
        libelle: label,
        montant,
        categorie: details.categorie,
        beneficiaire: details.beneficiaire,
        mode: details.mode,
        statut: "EN_ATTENTE",
        // Jour de la saisie (envoyé tel quel, même si la synchronisation a lieu plus tard).
        date: aujourdhuiLocal(),
        saisiParId: session?.userId ?? null,
      })
    },
    [lienEvenement, session]
  )

  const validateDepense = useCallback(
    async (eventId: number, idx: number) => {
      const depense = parId(events, eventId)?.depenses[idx]
      const record = depense?.localId ? depenseRepository.getByLocalId(depense.localId) : null
      if (!record) throw refus("Cette dépense n'existe plus.")
      // Le serveur valide une dépense qu'il connaît : il faut d'abord qu'elle soit envoyée.
      if (record.serverId == null) throw refus("Cette dépense n'est pas encore envoyée au serveur : elle pourra être validée ensuite.")
      // Règles du serveur : une dépense se traite une fois, et jamais par celui qui l'a saisie.
      if (record.data.statut !== "EN_ATTENTE") throw refus("Cette dépense a déjà été traitée.")
      if (record.data.saisiParId != null && record.data.saisiParId === session?.userId)
        throw refus("Vous ne pouvez pas valider une dépense que vous avez saisie.")
      depenseRepository.update(record.localId, { statut: "VALIDEE" })
    },
    [events, session]
  )

  const createChant = useCallback(async (input: ChantInput) => {
    chantRepository.create(input)
  }, [])

  const chants = data.chants
  const deleteSong = useCallback(
    async (id: number) => {
      const chant = parId(chants, id)
      if (!chant?.localId) throw refus("Ce chant n'existe plus.")
      chantRepository.remove(chant.localId)
    },
    [chants]
  )

  const recus = data.recus
  const receiptsFor = useCallback((chorishId: number) => recus.filter((r) => r.chorishId === chorishId), [recus])

  const value: AppContextValue = {
    userId,
    currentUser,
    chorists,
    roleLabels,
    roleHistory,
    session,
    authReady,
    choraleNom: session?.chorale.nom ?? "",
    annee,
    mensualite: data.mensualite,
    parametres: data.parametres ?? PARAMETRES_PAR_DEFAUT,
    syncing: syncState === "syncing",
    // Hors ligne, la bannière « Mode hors ligne » suffit : pas d'erreur de chargement affichée.
    syncError: isOnline ? lastError : null,
    refresh,
    signIn,
    changePassword,
    events,
    chants,
    recus,
    statutaire,
    statutaireParAnnee,
    anneesStatutaire,
    perms,
    can,
    logout,
    confirmPaymentStatutaire,
    confirmEventPayment,
    cancelPayment,
    createEvent,
    updateEvent,
    deleteEvent,
    toggleInscription,
    addDepense,
    validateDepense,
    createChant,
    deleteSong,
    receiptsFor,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}

/** Message d'erreur prêt à afficher dans un toast. */
export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Une erreur est survenue. Réessayez."
}
