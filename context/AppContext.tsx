import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { AppState } from "react-native"
import {
  MENSUALITE,
  MONTHS,
  chorists as mockChorists,
  initialChants,
  initialEvents,
  initialRecus,
  initialStatutaire,
  roleHistory as mockRoleHistory,
  roleLabels,
} from "../data/mockData"
import * as api from "../lib/api"
import { currentYear } from "../lib/format"
import { computePerms, type Perms } from "../lib/roles"
import { Chant, Chorist, Evenement, Permission, Recu, RoleHistoryEntry } from "../types"

/** Nom de la chorale des comptes de démonstration (hors connexion). */
const DEMO_CHORALE_NOM = "Chorale Sainte-Cécile de Yaoundé"

/** Listes proposées en démonstration et avant le chargement (mêmes défauts que le backend). */
const PARAMETRES_PAR_DEFAUT: Omit<api.Parametres, "mensualite"> = {
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

/** Message affiché quand le chargement des données de la chorale échoue. */
const SYNC_ERROR = "Impossible de charger les données de la chorale. Tirez vers le bas pour réessayer."

/** "AAAA-MM-JJ" → "JJ/MM/AAAA" (sans passer par Date : pas de décalage de fuseau). */
const frDateISO = (iso: string) => iso.split("-").reverse().join("/")

function fabricateReceiptId() {
  return "REC-" + currentYear() + "-" + (1000 + Math.floor(Math.random() * 9000))
}

interface NewEventInput {
  titre: string
  type: string
  date: string
  description: string
  budgetPrevisionnel: number
  cotisationMontant: number
}

interface ChantInput {
  titre: string
  compositeur: string
  categorie: string
  tonalite: string
  paroles: string
}

/** Champs d'une dépense exigés par l'API (ignorés en démonstration). */
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
  /** Session de l'API (null : non connecté, ou compte de démonstration). */
  session: api.Session | null
  /** Faux tant que la session enregistrée n'a pas été relue au démarrage. */
  authReady: boolean
  /** Vrai pour un compte de démonstration (aucune donnée réelle). */
  isDemo: boolean
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
  /** Vrai pendant un rechargement des données depuis l'API. */
  syncing: boolean
  /** Dernière erreur de chargement des données (null si tout va bien). */
  syncError: string | null
  /** Recharge les données de la chorale depuis l'API (sans effet en démonstration). */
  refresh: () => Promise<void>
  /** Connexion réelle (email ou téléphone + mot de passe). Lève une ApiError en cas de refus. */
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
  loginAs: (id: number) => void
  logout: () => void
  // Actions : appellent l'API avec une vraie session (lèvent une ApiError en cas de refus),
  // modifient les données locales en démonstration.
  /**
   * `year` : exercice du mois réglé (année en cours, ou une année passée pour un arriéré).
   * `details` : jour où le membre a payé et mode de règlement (enregistrés et imprimés sur le reçu).
   */
  confirmPaymentStatutaire: (chorishId: number, monthIndex: number, amount: number, year: number, details: api.DetailsPaiement) => Promise<void>
  confirmEventPayment: (eventId: number, chorishId: number, amount: number, details: api.DetailsPaiement) => Promise<void>
  createEvent: (input: NewEventInput) => Promise<void>
  /** Démonstration uniquement : l'API ne gère pas encore les inscriptions. */
  toggleInscription: (eventId: number) => void
  addDepense: (eventId: number, label: string, montant: number, details: DepenseDetails) => Promise<void>
  validateDepense: (eventId: number, idx: number) => Promise<void>
  /** Avec l'API, seul l'ajout est possible (pas de modification d'un chant). */
  saveChant: (id: number | null, data: ChantInput) => Promise<void>
  /** Démonstration uniquement : avec l'API, le bureau supprime directement (deleteSong). */
  proposeDeleteSong: (id: number) => void
  /** Supprime le chant du répertoire. */
  deleteSong: (id: number) => Promise<void>
  receiptsFor: (chorishId: number) => Recu[]
}

const AppContext = createContext<AppContextValue | null>(null)

const emptyCard = () => Array<boolean>(12).fill(false)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null)
  const [events, setEvents] = useState<Evenement[]>(initialEvents)
  const [chants, setChants] = useState<Chant[]>(initialChants)
  const [recus, setRecus] = useState<Recu[]>(initialRecus)
  const [statutaireParAnnee, setStatutaireParAnnee] = useState<Record<number, Record<number, boolean[]>>>(() => ({
    [currentYear()]: initialStatutaire,
  }))
  const [apiMembres, setApiMembres] = useState<Chorist[]>([])
  const [mensualite, setMensualite] = useState(MENSUALITE)
  const [parametres, setParametres] = useState(PARAMETRES_PAR_DEFAUT)
  const [annee, setAnnee] = useState(currentYear)

  const statutaire = useMemo(() => statutaireParAnnee[annee] ?? {}, [statutaireParAnnee, annee])
  const anneesStatutaire = useMemo(
    () => [...new Set([...Object.keys(statutaireParAnnee).map(Number), annee])].sort((a, b) => a - b),
    [statutaireParAnnee, annee]
  )
  const [session, setSession] = useState<api.Session | null>(null)
  const [apiRoleHistory, setApiRoleHistory] = useState<RoleHistoryEntry[]>([])
  const [authReady, setAuthReady] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  // Session courante et « génération » : une réponse arrivée après une déconnexion
  // (ou un changement de compte) est ignorée.
  const sessionRef = useRef<api.Session | null>(null)
  const generation = useRef(0)

  /* ------------------------------ Membres ------------------------------ */

  const sessionChorist = useMemo<Chorist | null>(
    () => (session ? { id: session.membershipId, name: session.nom, roles: session.roles, numero: String(session.membershipId) } : null),
    [session]
  )
  const chorists = useMemo(
    () => (sessionChorist ? [sessionChorist, ...apiMembres.filter((m) => m.id !== sessionChorist.id)] : mockChorists),
    [sessionChorist, apiMembres]
  )
  const roleHistory = useMemo(
    () => (sessionChorist ? { [sessionChorist.id]: apiRoleHistory } : mockRoleHistory),
    [sessionChorist, apiRoleHistory]
  )

  const currentUser = useMemo(() => chorists.find((c) => c.id === userId) ?? null, [chorists, userId])

  /* ------------------------------ Chargement depuis l'API ------------------------------ */

  /** Données de démonstration (comptes fictifs, sans serveur). */
  const resetToDemo = useCallback(() => {
    setEvents(initialEvents)
    setChants(initialChants)
    setRecus(initialRecus)
    setStatutaireParAnnee({ [currentYear()]: initialStatutaire })
    setApiMembres([])
    setMensualite(MENSUALITE)
    setParametres(PARAMETRES_PAR_DEFAUT)
    setSyncError(null)
  }, [])

  /** Vide les données avant un chargement : jamais de données fictives avec une vraie session. */
  const clearData = useCallback(() => {
    setEvents([])
    setChants([])
    setRecus([])
    setStatutaireParAnnee({})
    setApiMembres([])
    setSyncError(null)
  }, [])

  const refresh = useCallback(async () => {
    const current = sessionRef.current
    if (!current || current.doitChangerMotDePasse) return
    const gen = generation.current
    // Année relue à chaque chargement : au 1er janvier, la carte de la nouvelle année (vierge) s'affiche.
    const year = currentYear()
    setAnnee(year)
    setSyncing(true)

    // Chaque appel est indépendant : un refus (403 pour un rôle sans accès) n'empêche pas les autres.
    const [membres, statut, recusApi, evenements, depenses, chantsApi, params] = await Promise.allSettled([
      api.fetchMembres(),
      api.fetchStatutaire(),
      api.fetchRecus(),
      api.fetchEvenements(),
      api.fetchDepenses(),
      api.fetchChants(),
      api.fetchParametres(),
    ])
    if (gen !== generation.current) return

    const value = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null)
    /** Erreur réseau ou serveur (un refus de droits 403 est normal selon le rôle). */
    const failed = (r: PromiseSettledResult<unknown>) =>
      r.status === "rejected" && !(r.reason instanceof api.ApiError && r.reason.status === 403)

    // Membres : liste complète pour les rôles financiers, sinon ceux des cartes visibles (soi-même).
    const cartes = value(statut)?.exercices.find((e) => e.annee === year)?.cartes ?? []
    const noms = new Map<number, string>()
    for (const m of value(membres) ?? []) noms.set(m.id, m.nom)
    for (const c of cartes) if (!noms.has(c.membreId)) noms.set(c.membreId, c.nom)
    setApiMembres([...noms].map(([id, nom]) => ({ id, name: nom, roles: ["choriste"], numero: String(id) })))

    if (statut.status === "fulfilled") {
      setMensualite(statut.value.mensualite)
      const parAnnee: Record<number, Record<number, boolean[]>> = {}
      for (const e of statut.value.exercices) {
        parAnnee[e.annee] = Object.fromEntries(e.cartes.map((c) => [c.membreId, c.payes]))
      }
      parAnnee[year] ??= {}
      parAnnee[year][current.membershipId] ??= emptyCard()
      setStatutaireParAnnee(parAnnee)
    }
    if (params.status === "fulfilled") {
      const { mensualite: montant, ...listes } = params.value
      setMensualite(montant)
      setParametres(listes)
    }
    if (recusApi.status === "fulfilled") setRecus(recusApi.value)
    if (chantsApi.status === "fulfilled") setChants(chantsApi.value)
    if (evenements.status === "fulfilled") {
      const parEvenement = new Map<number, Evenement["depenses"]>()
      for (const d of value(depenses) ?? []) {
        if (d.evenementId == null || d.statut === "REJETEE") continue
        const liste = parEvenement.get(d.evenementId) ?? []
        liste.push({ id: d.id, label: d.libelle, montant: d.montant, valide: d.statut === "VALIDEE" })
        parEvenement.set(d.evenementId, liste)
      }
      setEvents(evenements.value.map((ev) => ({ ...ev, depenses: parEvenement.get(ev.id) ?? [] })))
    }

    setSyncError([membres, statut, recusApi, evenements, depenses, chantsApi, params].some(failed) ? SYNC_ERROR : null)
    setSyncing(false)
  }, [])

  /** Ouvre la session : identifiant = adhésion (comme le web), puis chargement des données. */
  const openSession = useCallback(
    (next: api.Session) => {
      const changed = sessionRef.current?.membershipId !== next.membershipId
      generation.current++
      sessionRef.current = next
      if (changed) clearData()
      setSession(next)
      setUserId(next.membershipId)
      if (!next.doitChangerMotDePasse) {
        api
          .fetchRoleHistory()
          .then(setApiRoleHistory)
          .catch(() => setApiRoleHistory([]))
        void refresh()
      }
    },
    [clearData, refresh]
  )

  const closeSession = useCallback(() => {
    generation.current++
    sessionRef.current = null
    setSession(null)
    setApiRoleHistory([])
    setUserId(null)
    setSyncing(false)
    resetToDemo()
  }, [resetToDemo])

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
      } catch {
        await api.clearToken()
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    })()
    return () => {
      cancelled = true
      api.setUnauthorizedHandler(null)
    }
  }, [openSession, closeSession])

  // Retour au premier plan : rechargement, pour voir les changements faits depuis le web.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setAnnee(currentYear())
        void refresh()
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

  // Démonstration : nouvelle année → cartes vierges (12 nouveaux mois à régler) ; l'année
  // écoulée reste consultable avec le sélecteur d'exercice.
  const anneePrecedente = useRef(annee)
  useEffect(() => {
    if (anneePrecedente.current === annee) return
    anneePrecedente.current = annee
    if (!sessionRef.current) {
      setStatutaireParAnnee((prev) => ({
        ...prev,
        [annee]: prev[annee] ?? Object.fromEntries(mockChorists.map((c) => [c.id, emptyCard()])),
      }))
    }
  }, [annee])

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const next = await api.login(identifier, password)
      openSession(next)
      return next
    },
    [openSession]
  )

  const changePassword = useCallback(
    async (current: string, next: string) => {
      openSession(await api.changerMotDePasse(current, next))
    },
    [openSession]
  )

  const perms = useMemo(() => computePerms(currentUser?.roles ?? []), [currentUser])
  const can = useCallback((perm: Permission) => currentUser !== null && perms[perm], [currentUser, perms])

  /** Compte de démonstration : aucune session API. */
  const loginAs = useCallback(
    (id: number) => {
      void api.clearToken()
      generation.current++
      sessionRef.current = null
      setSession(null)
      setApiRoleHistory([])
      resetToDemo()
      setUserId(id)
    },
    [resetToDemo]
  )

  const logout = useCallback(() => {
    void api.clearToken()
    closeSession()
  }, [closeSession])

  /* ------------------------------ Actions ------------------------------ */

  const roleLabelFor = useCallback((user: Chorist) => {
    const role = user.roles.find((r) => r !== "choriste") ?? "choriste"
    return roleLabels[role]
  }, [])

  const confirmPaymentStatutaire = useCallback(
    async (chorishId: number, monthIndex: number, amount: number, year: number, details: api.DetailsPaiement) => {
      if (sessionRef.current) {
        await api.payerStatutaire(chorishId, monthIndex, year, amount, details)
        await refresh()
        return
      }
      setStatutaireParAnnee((prev) => {
        const cartes = prev[year] ?? {}
        const carte = [...(cartes[chorishId] ?? emptyCard())]
        carte[monthIndex] = true
        return { ...prev, [year]: { ...cartes, [chorishId]: carte } }
      })
      if (currentUser) {
        setRecus((prev) => [
          {
            id: fabricateReceiptId(),
            chorishId,
            type: "Statutaire",
            label: "Cotisation — " + MONTHS[monthIndex] + " " + year,
            montant: amount,
            date: frDateISO(details.datePaiement),
            enregistrePar: currentUser.name + " (" + roleLabelFor(currentUser) + ")",
            mode: details.mode,
          },
          ...prev,
        ])
      }
    },
    [currentUser, roleLabelFor, refresh]
  )

  const confirmEventPayment = useCallback(
    async (eventId: number, chorishId: number, amount: number, details: api.DetailsPaiement) => {
      if (sessionRef.current) {
        await api.payerEvenement(chorishId, eventId, amount, details)
        await refresh()
        return
      }
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? {
                ...ev,
                contributions: {
                  ...ev.contributions,
                  [chorishId]: (ev.contributions[chorishId] || 0) + amount,
                },
              }
            : ev
        )
      )
      const ev = events.find((e) => e.id === eventId)
      if (currentUser && ev) {
        setRecus((prev) => [
          {
            id: fabricateReceiptId(),
            chorishId,
            type: "Événementielle",
            label: ev.titre,
            montant: amount,
            date: frDateISO(details.datePaiement),
            enregistrePar: currentUser.name,
            eventId,
            mode: details.mode,
          },
          ...prev,
        ])
      }
    },
    [events, currentUser, refresh]
  )

  const createEvent = useCallback(
    async (input: NewEventInput) => {
      if (sessionRef.current) {
        await api.creerEvenement({
          titre: input.titre,
          type: input.type,
          date: input.date,
          budgetPrevisionnel: input.budgetPrevisionnel,
          montantCotisation: input.cotisationMontant,
        })
        await refresh()
        return
      }
      setEvents((prev) => {
        const contributions: Record<number, number> = {}
        chorists.forEach((c) => (contributions[c.id] = 0))
        const newEv: Evenement = {
          id: Math.max(...prev.map((e) => e.id)) + 1,
          titre: input.titre || "Nouvel événement",
          type: input.type,
          date: input.date || new Date().toISOString().slice(0, 10),
          description: input.description,
          budgetPrevisionnel: input.budgetPrevisionnel || 0,
          cotisationMontant: input.cotisationMontant || 1000,
          inscrits: [],
          depenses: [],
          contributions,
        }
        return [...prev, newEv]
      })
    },
    [chorists, refresh]
  )

  const toggleInscription = useCallback(
    (eventId: number) => {
      if (!currentUser) return
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id !== eventId) return ev
          const inscrit = ev.inscrits.includes(currentUser.id)
          return {
            ...ev,
            inscrits: inscrit
              ? ev.inscrits.filter((id) => id !== currentUser.id)
              : [...ev.inscrits, currentUser.id],
          }
        })
      )
    },
    [currentUser]
  )

  const addDepense = useCallback(
    async (eventId: number, label: string, montant: number, details: DepenseDetails) => {
      if (sessionRef.current) {
        await api.creerDepense({ evenementId: eventId, libelle: label, montant, ...details })
        await refresh()
        return
      }
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? { ...ev, depenses: [...ev.depenses, { label, montant, valide: false }] }
            : ev
        )
      )
    },
    [refresh]
  )

  const validateDepense = useCallback(
    async (eventId: number, idx: number) => {
      if (sessionRef.current) {
        const depense = events.find((e) => e.id === eventId)?.depenses[idx]
        if (depense?.id == null) return
        await api.validerDepense(depense.id)
        await refresh()
        return
      }
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? {
                ...ev,
                depenses: ev.depenses.map((d, i) => (i === idx ? { ...d, valide: true } : d)),
              }
            : ev
        )
      )
    },
    [events, refresh]
  )

  const saveChant = useCallback(
    async (id: number | null, data: ChantInput) => {
      if (sessionRef.current) {
        if (id) throw new api.ApiError("La modification d'un chant n'est pas encore disponible.", 0)
        await api.creerChant(data)
        await refresh()
        return
      }
      setChants((prev) => {
        if (id) {
          return prev.map((c) => (c.id === id ? { ...c, ...data } : c))
        }
        return [...prev, { id: Math.max(...prev.map((c) => c.id)) + 1, statut: "actif", ...data }]
      })
    },
    [refresh]
  )

  const proposeDeleteSong = useCallback((id: number) => {
    setChants((prev) => prev.map((c) => (c.id === id ? { ...c, statut: "a_valider" } : c)))
  }, [])

  const deleteSong = useCallback(
    async (id: number) => {
      if (sessionRef.current) {
        await api.supprimerChant(id)
        await refresh()
        return
      }
      setChants((prev) => prev.filter((c) => c.id !== id))
    },
    [refresh]
  )

  const receiptsFor = useCallback((chorishId: number) => recus.filter((r) => r.chorishId === chorishId), [recus])

  const value: AppContextValue = {
    userId,
    currentUser,
    chorists,
    roleLabels,
    roleHistory,
    session,
    authReady,
    isDemo: session === null && userId !== null,
    choraleNom: session?.chorale.nom ?? DEMO_CHORALE_NOM,
    annee,
    mensualite,
    parametres,
    syncing,
    syncError,
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
    loginAs,
    logout,
    confirmPaymentStatutaire,
    confirmEventPayment,
    createEvent,
    toggleInscription,
    addDepense,
    validateDepense,
    saveChant,
    proposeDeleteSong,
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
