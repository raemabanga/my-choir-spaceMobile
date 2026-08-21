import React, { createContext, useCallback, useContext, useMemo, useState } from "react"
import {
  ANNEE,
  MENSUALITE,
  MONTHS,
  chorists,
  initialChants,
  initialEvents,
  initialRecus,
  initialStatutaire,
  roleHistory,
  roleLabels,
} from "../data/mockData"
import { Chant, Chorist, Evenement, Permission, Recu, Role } from "../types"

const PERMISSION_ROLES: Record<Permission, Role[]> = {
  createEvent: ["bureau", "tresorier"],
  createCotisation: ["bureau", "tresorier"],
  registerPayment: ["tresorier", "commissionRecette"],
  viewAllCotisations: ["bureau", "tresorier", "commissionRecette"],
  viewBudget: ["bureau", "tresorier"],
  manageDepense: ["bureau", "tresorier"],
  exportReport: ["bureau", "tresorier"],
  addSong: ["bureau", "commissionMusicale"],
  proposeDeleteSong: ["commissionMusicale"],
  validateDeleteSong: ["bureau"],
}

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
  roleHistory: typeof roleHistory
  events: Evenement[]
  chants: Chant[]
  recus: Recu[]
  statutaire: Record<number, boolean[]>
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

  const currentUser = useMemo(
    () => chorists.find((c) => c.id === userId) ?? null,
    [userId]
  )

  const can = useCallback(
    (perm: Permission) => {
      if (!currentUser) return false
      return PERMISSION_ROLES[perm]?.some((r) => currentUser.roles.includes(r)) ?? false
    },
    [currentUser]
  )

  const loginAs = useCallback((id: number) => setUserId(id), [])
  const logout = useCallback(() => setUserId(null), [])

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
  }, [])

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
    events,
    chants,
    recus,
    statutaire,
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
