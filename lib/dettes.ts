// Dettes d'un choriste, calculées sur le téléphone avec les mêmes règles que le portail web
// (my-choir-space-FrontOffice, src/lib/cotisations.ts, situationMembre) : seul l'échu compte,
// c'est-à-dire les mois passés ou en cours non réglés (hors mois non dus) et le reste à payer
// des événements déjà passés.
import type { Evenement } from "../types"
import { todayLocalISO } from "./format"

const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

export interface DetteMembre {
  libelle: string
  detail: string
  montant: number
  /** Tri : "AAAA-MM" pour un mois, date de l'événement sinon. */
  echeance: string
}

/** Mois échus d'un exercice : 12 pour une année passée, jusqu'au mois en cours pour l'année en cours, 0 ensuite. */
function moisEcoules(annee: number, aujourdhui: Date) {
  const courante = aujourdhui.getFullYear()
  if (annee < courante) return 12
  if (annee > courante) return 0
  return aujourdhui.getMonth() + 1
}

export function dettesMembre(
  membreId: number,
  donnees: {
    statutaireParAnnee: Record<number, Record<number, boolean[]>>
    nonDuParAnnee: Record<number, Record<number, boolean[]>>
    mensualite: number
    events: Evenement[]
  },
  aujourdhui = new Date()
): { dettes: DetteMembre[]; total: number } {
  const dettes: DetteMembre[] = []

  if (donnees.mensualite > 0) {
    for (const [an, cartes] of Object.entries(donnees.statutaireParAnnee)) {
      const annee = Number(an)
      const payes = cartes[membreId]
      if (!payes) continue
      const nonDus = donnees.nonDuParAnnee[annee]?.[membreId] ?? []
      for (let m = 0; m < moisEcoules(annee, aujourdhui); m++) {
        if (payes[m] || nonDus[m]) continue
        dettes.push({
          libelle: "Cotisation statutaire",
          detail: `${NOMS_MOIS[m]} ${annee}`,
          montant: donnees.mensualite,
          echeance: `${annee}-${String(m + 1).padStart(2, "0")}`,
        })
      }
    }
  }

  const jour = todayLocalISO()
  for (const e of donnees.events) {
    if (!(e.cotisationMontant > 0) || !e.date || e.date.slice(0, 10) > jour) continue
    const verse = e.contributions[membreId] ?? 0
    const reste = e.cotisationMontant - verse
    if (reste <= 0) continue
    dettes.push({
      libelle: e.titre,
      detail: verse > 0 ? `Déjà versé ${verse.toLocaleString("fr-FR")} F` : "Rien de versé",
      montant: reste,
      echeance: e.date.slice(0, 10),
    })
  }

  dettes.sort((a, b) => a.echeance.localeCompare(b.echeance))
  return { dettes, total: dettes.reduce((s, d) => s + d.montant, 0) }
}
