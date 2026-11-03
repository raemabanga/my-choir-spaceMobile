import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  ANNEE,
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
import { computePerms, type Perms } from "../lib/roles"
import { Chant, Chorist, Evenement, Permission, Recu, RoleHistoryEntry } from "../types"

/** Nom de la chorale des comptes de démonstration (hors connexion). */
const DEMO_CHORALE_NOM = "Chorale Sainte-Cécile de Yaoundé"

/**
 * Le membre connecté via l'API rejoint la liste des choristes des données de démonstration
 * (cotisations, événements, chants : pas encore servis par le backend). Son identifiant local
 * est décalé pour ne jamais entrer en collision avec ceux des comptes de démo.
 */
const API_ID_OFFSET = 10_000
const localIdOf = (session: api.Session) => API_ID_OFFSET + session.membershipId


function fabricateReceiptId() {
  return "REC-" + ANNEE + "-" + (1000 + Math.floor(Math.random() * 9000))
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
  /** Connexion réelle (email ou téléphone + mot de passe). Lève une ApiError en cas de refus. */
  signIn: (identifier: string, password: string) => Promise<api.Session>
  /** Première connexion : remplace le mot de passe temporaire. */
  changePassword: (current: string, next: string) => Promise<void>
  events: Evenement[]
  chants: Chant[]
  recus: Recu[]
  statutaire: Record<number, boolean[]>
  /** Droits du membre courant (mêmes règles que le web). */
  perms: Perms
  can: (perm: Permission) => boolean
  loginAs: (id: number) => void
  logout: () => void
  confirmPaymentStatutaire: (chorishId: number, monthIndex: number, amount?: number) => void
  confirmEventPayment: (eventId: number, chorishId: number, amount: number) => void
  createEvent: (input: NewEventInput) => void
  toggleInscription: (eventId: number) => void
  addDepense: (eventId: number, label: string, montant: number) => void
  validateDepense: (eventId: number, idx: number) => void
  saveChant: (id: number | null, data: ChantInput) => void
  proposeDeleteSong: (id: number) => void
  validateDeleteSong: (id: number) => void
  receiptsFor: (chorishId: number) => Recu[]
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null)
  const [events, setEvents] = useState<Evenement[]>(initialEvents)
  const [chants, setChants] = useState<Chant[]>(initialChants)
  const [recus, setRecus] = useState<Recu[]>(initialRecus)
  const [statutaire, setStatutaire] = useState<Record<number, boolean[]>>(initialStatutaire)
  const [session, setSession] = useState<api.Session | null>(null)
  const [apiRoleHistory, setApiRoleHistory] = useState<RoleHistoryEntry[]>([])
  const [authReady, setAuthReady] = useState(false)

  // Le membre connecté via l'API, ajouté aux choristes de démonstration.
  const sessionChorist = useMemo<Chorist | null>(
    () => (session ? { id: localIdOf(session), name: session.nom, roles: session.roles, numero: String(session.membershipId) } : null),
    [session]
  )
  const chorists = useMemo(() => (sessionChorist ? [sessionChorist, ...mockChorists] : mockChorists), [sessionChorist])
  const roleHistory = useMemo(
    () => (sessionChorist ? { ...mockRoleHistory, [sessionChorist.id]: apiRoleHistory } : mockRoleHistory),
    [sessionChorist, apiRoleHistory]
  )

  const currentUser = useMemo(() => chorists.find((c) => c.id === userId) ?? null, [chorists, userId])

  /** Ouvre la session : identifiant local, carte de cotisation vide, historique des rôles. */
  const openSession = useCallback((next: api.Session) => {
    const id = localIdOf(next)
    setSession(next)
    setUserId(id)
    setStatutaire((prev) => (prev[id] ? prev : { ...prev, [id]: Array<boolean>(12).fill(false) }))
    if (!next.doitChangerMotDePasse) {
      api
        .fetchRoleHistory()
        .then(setApiRoleHistory)
        .catch(() => setApiRoleHistory([]))
    }
  }, [])

  const closeSession = useCallback(() => {
    setSession(null)
    setApiRoleHistory([])
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
  const loginAs = useCallback((id: number) => {
    void api.clearToken()
    setSession(null)
    setApiRoleHistory([])
    setUserId(id)
  }, [])

  const logout = useCallback(() => {
    void api.clearToken()
    closeSession()
  }, [closeSession])

  const roleLabelFor = useCallback((user: Chorist) => {
    const role = user.roles.find((r) => r !== "choriste") ?? "choriste"
    return roleLabels[role]
  }, [])

  const confirmPaymentStatutaire = useCallback(
    (chorishId: number, monthIndex: number, amount: number = MENSUALITE) => {
      setStatutaire((prev) => {
        const next = { ...prev, [chorishId]: [...prev[chorishId]] }
        next[chorishId][monthIndex] = true
        return next
      })
      if (currentUser) {
        setRecus((prev) => [
          {
            id: fabricateReceiptId(),
            chorishId,
            type: "Statutaire",
            label: "Cotisation — " + MONTHS[monthIndex] + " " + ANNEE,
            montant: amount,
            date: new Date().toLocaleDateString("fr-FR"),
            enregistrePar: currentUser.name + " (" + roleLabelFor(currentUser) + ")",
          },
          ...prev,
        ])
      }
    },
    [currentUser, roleLabelFor]
  )

  const confirmEventPayment = useCallback(
    (eventId: number, chorishId: number, amount: number) => {
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
            date: new Date().toLocaleDateString("fr-FR"),
            enregistrePar: currentUser.name,
          },
          ...prev,
        ])
      }
    },
    [events, currentUser]
  )

  const createEvent = useCallback((input: NewEventInput) => {
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
  }, [chorists])

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

  const addDepense = useCallback((eventId: number, label: string, montant: number) => {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === eventId
          ? { ...ev, depenses: [...ev.depenses, { label, montant, valide: false }] }
          : ev
      )
    )
  }, [])

  const validateDepense = useCallback((eventId: number, idx: number) => {
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
  }, [])

  const saveChant = useCallback((id: number | null, data: ChantInput) => {
    setChants((prev) => {
      if (id) {
        return prev.map((c) => (c.id === id ? { ...c, ...data } : c))
      }
      return [...prev, { id: Math.max(...prev.map((c) => c.id)) + 1, statut: "actif", ...data }]
    })
  }, [])

  const proposeDeleteSong = useCallback((id: number) => {
    setChants((prev) => prev.map((c) => (c.id === id ? { ...c, statut: "a_valider" } : c)))
  }, [])

  const validateDeleteSong = useCallback((id: number) => {
    setChants((prev) => prev.filter((c) => c.id !== id))
  }, [])

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
    signIn,
    changePassword,
    events,
    chants,
    recus,
    statutaire,
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
    validateDeleteSong,
    receiptsFor,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
