import type { Evenement } from "../types"

export function fmt(n: number) {
  return n.toLocaleString("fr-FR") + " FCFA"
}

/** Événement sans date (possible avec l'API). */
const NO_DATE = "Date à préciser"

export function formatDateLong(iso: string) {
  if (!iso) return NO_DATE
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

export function formatDateShort(iso: string) {
  if (!iso) return NO_DATE
  return new Date(iso).toLocaleDateString("fr-FR")
}

/** Année en cours : exercice de la cotisation statutaire (janvier → décembre). */
export function currentYear() {
  return new Date().getFullYear()
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Index du mois en cours dans l'exercice `annee` (-1 avant, 12 après). */
export function currentMonthIndex(annee: number) {
  const now = new Date()
  if (now.getFullYear() < annee) return -1
  if (now.getFullYear() > annee) return 12
  return now.getMonth()
}

export function daysUntil(iso: string) {
  const start = new Date(todayISO()).getTime()
  return Math.round((new Date(iso).getTime() - start) / 86_400_000)
}

export function relativeDay(iso: string) {
  const d = daysUntil(iso)
  if (d === 0) return "Aujourd'hui"
  if (d === 1) return "Demain"
  if (d > 1) return `Dans ${d} jours`
  if (d === -1) return "Hier"
  return `Il y a ${-d} jours`
}

export function eventBilan(ev: Evenement) {
  const recettes = Object.values(ev.contributions).reduce((a, b) => a + b, 0)
  const validees = ev.depenses.filter((d) => d.valide).reduce((a, b) => a + b.montant, 0)
  const enAttente = ev.depenses.filter((d) => !d.valide).reduce((a, b) => a + b.montant, 0)
  const attendu = ev.cotisationMontant * Object.keys(ev.contributions).length
  return { recettes, validees, enAttente, solde: recettes - validees, attendu }
}

/** Prochain événement daté à venir, sinon le plus récent. */
export function nextEvent(events: Evenement[]): Evenement | undefined {
  const today = todayISO()
  const sorted = events.filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date))
  return sorted.find((e) => e.date >= today) ?? sorted[sorted.length - 1]
}
