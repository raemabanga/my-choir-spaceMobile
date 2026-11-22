// Fiche d'inscription du choriste (état civil, église, situation sociale).
// Same fields as the API (back-end_chorale, src/espace/dto/fiche-choriste.dto.ts) and the web
// portal (my-choir-space-FrontOffice, src/lib/fiche.ts).

export type SituationMatrimoniale = "MARIE" | "CELIBATAIRE" | "VEUF" | "DIVORCE"
export type TypeMariage = "COUTUMIER" | "CIVIL" | "RELIGIEUX"
export type StatutEglise = "CATECHUMENE" | "BAPTISE" | "DIACRE"
export type SituationSociale =
  | "SANS_EMPLOI"
  | "ETUDIANT"
  | "ENTREPRENEUR"
  | "COMMERCANT"
  | "TRAVAILLEUR_PRIVE"
  | "TRAVAILLEUR_PUBLIC"
  | "RETRAITE"
  | "AUTRE"

export type Genre = "FEMME" | "HOMME"
export type Voix = "SOPRANO" | "ALTO" | "TENOR" | "BASSE"

/** Every field is optional. Dates are "YYYY-MM-DD". */
export interface FicheChoriste {
  dateNaissance?: string
  lieuNaissance?: string
  adresse?: string
  quartier?: string
  zone?: string
  situationMatrimoniale?: SituationMatrimoniale
  typesMariage?: TypeMariage[]
  statutEglise?: StatutEglise
  dateBapteme?: string
  lieuBapteme?: string
  transfere?: boolean
  situationSociale?: SituationSociale
  nombreEnfants?: number
  profession?: string
  secteurActivite?: string
  precedentesChorales?: string
  genre?: Genre
  /** Pupitre. */
  voix?: Voix
  /** Joue d'un instrument pour la chorale. */
  instrumentiste?: boolean
}

export const SITUATIONS_MATRIMONIALES: [SituationMatrimoniale, string][] = [
  ["MARIE", "Marié(e)"],
  ["CELIBATAIRE", "Célibataire"],
  ["VEUF", "Veuf / Veuve"],
  ["DIVORCE", "Divorcé(e)"],
]
export const TYPES_MARIAGE: [TypeMariage, string][] = [
  ["COUTUMIER", "Coutumier"],
  ["CIVIL", "État civil"],
  ["RELIGIEUX", "Église"],
]
export const STATUTS_EGLISE: [StatutEglise, string][] = [
  ["CATECHUMENE", "Catéchumène"],
  ["BAPTISE", "Baptisé(e)"],
  ["DIACRE", "Diacre / Diaconesse"],
]
export const SITUATIONS_SOCIALES: [SituationSociale, string][] = [
  ["SANS_EMPLOI", "Sans emploi"],
  ["ETUDIANT", "Étudiant / Élève"],
  ["ENTREPRENEUR", "Entrepreneur"],
  ["COMMERCANT", "Commerçant(e)"],
  ["TRAVAILLEUR_PRIVE", "Travailleur – Privé"],
  ["TRAVAILLEUR_PUBLIC", "Travailleur – Public"],
  ["RETRAITE", "Retraité(e)"],
  ["AUTRE", "Autre"],
]

export const GENRES: [Genre, string][] = [
  ["FEMME", "Femme"],
  ["HOMME", "Homme"],
]
export const VOIX: [Voix, string][] = [
  ["SOPRANO", "Soprano"],
  ["ALTO", "Alto"],
  ["TENOR", "Ténor"],
  ["BASSE", "Basse"],
]

export const libelle = <T extends string>(options: [T, string][], v: T | undefined) =>
  options.find(([k]) => k === v)?.[1]

/** The fiche as typed in a form: the number of children stays a string. */
export type FicheSaisie = Omit<FicheChoriste, "nombreEnfants" | "typesMariage"> & {
  nombreEnfants: string
  typesMariage: TypeMariage[]
}

export type ErreursFiche = Partial<Record<"dateNaissance" | "dateBapteme" | "nombreEnfants", string>>

export function depuisFiche(fiche: FicheChoriste = {}): FicheSaisie {
  return {
    ...fiche,
    typesMariage: fiche.typesMariage ?? [],
    nombreEnfants: fiche.nombreEnfants == null ? "" : String(fiche.nombreEnfants),
  }
}

/** Today, local time, as "YYYY-MM-DD". */
export function aujourdhui() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function validerFiche(s: FicheSaisie): ErreursFiche {
  const e: ErreursFiche = {}
  const max = aujourdhui()
  if (s.dateNaissance && s.dateNaissance > max)
    e.dateNaissance = "La date de naissance ne peut pas être dans le futur."
  if (s.dateBapteme && s.dateBapteme > max)
    e.dateBapteme = "La date de baptême ne peut pas être dans le futur."
  else if (s.dateBapteme && s.dateNaissance && s.dateBapteme < s.dateNaissance)
    e.dateBapteme = "Le baptême ne peut pas précéder la naissance."
  const n = s.nombreEnfants.trim()
  if (n && (!/^\d+$/.test(n) || Number(n) > 50)) e.nombreEnfants = "Nombre invalide."
  return e
}

/** Form → API: empty fields are left out (the API then clears them). */
export function versFiche(s: FicheSaisie): FicheChoriste {
  const fiche: FicheChoriste = {
    ...s,
    typesMariage: s.situationMatrimoniale === "MARIE" ? s.typesMariage : undefined,
    nombreEnfants: s.nombreEnfants.trim() === "" ? undefined : Number(s.nombreEnfants),
  }
  const result: Record<string, unknown> = {}
  for (const [cle, valeur] of Object.entries(fiche)) {
    const v = typeof valeur === "string" ? valeur.trim() : valeur
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue
    result[cle] = v
  }
  return result as FicheChoriste
}

/** API → app: null fields become absent. */
export function ficheDepuisApi(f: Record<string, unknown> | null | undefined): FicheChoriste {
  const result: Record<string, unknown> = {}
  for (const [cle, valeur] of Object.entries(f ?? {})) {
    if (valeur !== null && !(Array.isArray(valeur) && valeur.length === 0)) result[cle] = valeur
  }
  return result as FicheChoriste
}

/** The fiche has at least one field filled in. */
export const ficheRemplie = (f: FicheChoriste | undefined) =>
  !!f && Object.entries(f).some(([cle, v]) => !(cle === "instrumentiste" && v === false))

/** "YYYY-MM-DD" → local Date (no time zone shift). */
export function versDate(iso: string) {
  const [a, m, j] = iso.split("-").map(Number)
  return new Date(a!, m! - 1, j!)
}

/** Local Date → "YYYY-MM-DD". */
export function depuisDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
