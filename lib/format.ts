import type { Evenement } from "../types"

/** Abréviations des mois (0 = janvier), comme sur les cartes de cotisation. */
export const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

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

const pad2 = (n: number) => String(n).padStart(2, "0")

/** "AAAA-MM-JJ" d'une date en heure locale (toISOString donnerait la veille entre minuit et 1 h en UTC+1). */
export function localISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayLocalISO(): string {
  return localISODate(new Date())
}

/** "AAAA-MM-JJ" → Date locale à midi (pas de décalage de fuseau dans le sélecteur). */
export function parseLocalISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12)
}

/** Ajoute `jours` (négatif possible) à une date "AAAA-MM-JJ". */
export function addDaysISO(iso: string, jours: number): string {
  const d = parseLocalISODate(iso)
  d.setDate(d.getDate() + jours)
  return localISODate(d)
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
/** Les `n` prochains événements datés (aujourd'hui compris), du plus proche au plus lointain. */
export function upcomingEvents(events: Evenement[], n: number): Evenement[] {
  const today = todayISO()
  return events
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, n)
}

/**
 * Liste des événements en deux parts : à venir (aujourd'hui compris, du plus proche au plus
 * lointain ; les non datés à la fin) puis passés (du plus récent au plus ancien).
 */
export function splitEvents(events: Evenement[]): { aVenir: Evenement[]; passes: Evenement[] } {
  const today = todayISO()
  const jour = (e: Evenement) => e.date.slice(0, 10)
  const aVenir = events
    .filter((e) => !e.date || jour(e) >= today)
    .sort((a, b) => (!a.date ? 1 : !b.date ? -1 : jour(a).localeCompare(jour(b))))
  const passes = events.filter((e) => e.date && jour(e) < today).sort((a, b) => jour(b).localeCompare(jour(a)))
  return { aVenir, passes }
}

export function nextEvent(events: Evenement[]): Evenement | undefined {
  const today = todayISO()
  const sorted = events.filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date))
  return sorted.find((e) => e.date >= today) ?? sorted[sorted.length - 1]
}
