// Présences : règles pures partagées (dédoublonnage des feuilles du téléphone, libellés, assiduité
// d'un choriste calculée sur place, avec les mêmes formules que l'API : back-end presences.stats.ts).
import type { OfflineRecord } from "./offline"
import { evenementRepository, numeroSeance, type SeanceData } from "./offline/entities"
import { nomCulte, type CategorieAssiduite, type StatutPresence, type TypeSeance } from "./api"

/** Seuils d'assiduité (%), comme l'API. */
export const SEUILS_ASSIDUITE = { assidu: 75, irregulier: 40 } as const

/**
 * Entre une création en attente et un téléchargement qui ramène la même séance du serveur, deux
 * enregistrements locaux peuvent partager une clé (jusqu'à applyCreateResult) : on garde celui qui
 * attend l'envoi (ou a échoué), puis le plus récent.
 */
export function seancePrioritaire(a: OfflineRecord<SeanceData>, b: OfflineRecord<SeanceData>): OfflineRecord<SeanceData> {
  const local = (r: OfflineRecord<SeanceData>) => r.syncStatus === "pending" || r.syncStatus === "failed"
  if (local(a) !== local(b)) return local(a) ? a : b
  return (b.data.majLe ?? "") > (a.data.majLe ?? "") ? b : a
}

/** Identifiant serveur d'un événement créé hors ligne (null tant qu'il n'est pas envoyé). */
export const serveurEvenement = (evenementLocalId: string) => evenementRepository.getByLocalId(evenementLocalId)?.serverId ?? null

/**
 * Une feuille par séance (répétition d'un jour, culte d'un jour et numéro, événement), dans l'ordre
 * de la liste reçue. `serveurEvenementDe` retrouve l'identifiant serveur d'un événement créé hors ligne.
 */
export function feuillesUniques(
  seances: OfflineRecord<SeanceData>[],
  serveurEvenementDe: (evenementLocalId: string) => number | string | null | undefined = serveurEvenement
): OfflineRecord<SeanceData>[] {
  const parCle = new Map<string, OfflineRecord<SeanceData>>()
  const ordre: string[] = []
  for (const s of seances) {
    let cle = `REPETITION:${s.data.date}`
    if (s.data.type === "CULTE") cle = `CULTE:${s.data.date}:${numeroSeance(s.data)}`
    else if (s.data.type === "EVENEMENT") {
      const serveur = s.data.evenementId ?? (s.data.evenementLocalId ? serveurEvenementDe(s.data.evenementLocalId) : null)
      cle = serveur != null ? `EVENEMENT:${serveur}` : `EVENEMENT:local:${s.data.evenementLocalId ?? s.localId}`
    }
    const deja = parCle.get(cle)
    if (!deja) ordre.push(cle)
    parCle.set(cle, deja ? seancePrioritaire(deja, s) : s)
  }
  return ordre.map((cle) => parCle.get(cle)!)
}

/** Libellé d'une feuille, comme le `libelle` de l'API (culte : intitulé, sinon « 2e culte »). */
export function libelleSeance(data: SeanceData): string {
  if (data.type === "REPETITION") return data.titre ?? "Répétition"
  if (data.type === "CULTE") return data.titre ?? nomCulte(numeroSeance(data))
  return data.evenementTitre ?? "Événement"
}

/** round(presents / (attendues − excuses) × 100), null quand cette base est nulle. */
export function tauxMembre(presents: number, excuses: number, attendues: number): number | null {
  const base = attendues - excuses
  return base > 0 ? Math.round((presents / base) * 100) : null
}

/** ≥ 75 Assidu, ≥ 40 Irrégulier, sinon Décrocheur ; null → null. */
export function categorieAssiduite(taux: number | null): CategorieAssiduite | null {
  if (taux === null) return null
  if (taux >= SEUILS_ASSIDUITE.assidu) return "ASSIDU"
  if (taux >= SEUILS_ASSIDUITE.irregulier) return "IRREGULIER"
  return "DECROCHEUR"
}

export interface ResumeAssiduite {
  attendues: number
  presents: number
  excuses: number
  absents: number
  taux: number | null
}

export interface SeanceMembre {
  /** Identifiant local de la feuille (clé de liste). */
  localId: string
  date: string
  type: TypeSeance
  libelle: string
  statut: StatutPresence
  motif: string | null
}

export interface AssiduiteMembre extends ResumeAssiduite {
  /** "AAAA-MM-JJ", début de la période. */
  depuis: string
  categorie: CategorieAssiduite | null
  parType: Record<TypeSeance, ResumeAssiduite>
  /** Séances où le choriste figure, de la plus récente à la plus ancienne. */
  seances: SeanceMembre[]
}

function resume(lignes: { statut: StatutPresence }[]): ResumeAssiduite {
  let presents = 0
  let excuses = 0
  let absents = 0
  for (const l of lignes) {
    if (l.statut === "PRESENT") presents++
    else if (l.statut === "EXCUSE") excuses++
    else absents++
  }
  return { attendues: lignes.length, presents, excuses, absents, taux: tauxMembre(presents, excuses, lignes.length) }
}

/**
 * Assiduité d'un choriste (identifiant d'adhésion) sur les feuilles déjà dédoublonnées dont la date
 * est ≥ `depuis` ("AAAA-MM-JJ") : mêmes totaux, taux et catégorie que l'API (/espace/presences/membres/:id).
 */
export function assiduiteMembre(feuilles: OfflineRecord<SeanceData>[], membreId: number, depuis: string): AssiduiteMembre {
  const seances: SeanceMembre[] = []
  const majLe = new Map<string, string>()
  for (const f of feuilles) {
    if (f.data.date < depuis) continue
    const ligne = f.data.presences.find((p) => p.membreId === membreId)
    if (!ligne) continue
    seances.push({
      localId: f.localId,
      date: f.data.date,
      type: f.data.type,
      libelle: libelleSeance(f.data),
      statut: ligne.statut,
      motif: ligne.statut === "EXCUSE" ? ligne.motif : null,
    })
    majLe.set(f.localId, f.data.majLe ?? "")
  }
  seances.sort((a, b) => b.date.localeCompare(a.date) || (majLe.get(b.localId) ?? "").localeCompare(majLe.get(a.localId) ?? ""))
  const total = resume(seances)
  const parType = (type: TypeSeance) => resume(seances.filter((s) => s.type === type))
  return {
    depuis,
    ...total,
    categorie: categorieAssiduite(total.taux),
    parType: { REPETITION: parType("REPETITION"), CULTE: parType("CULTE"), EVENEMENT: parType("EVENEMENT") },
    seances,
  }
}
