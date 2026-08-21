export function fmt(n: number) {
  return n.toLocaleString("fr-FR") + " FCFA"
}

export function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

export function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR")
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
