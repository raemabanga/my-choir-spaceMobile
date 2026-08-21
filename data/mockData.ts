import { Chant, Chorist, Evenement, Recu, RoleHistoryEntry } from "../types"

export const MONTHS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
]

export const MENSUALITE = 1000
export const ANNEE = 2026

export const roleLabels: Record<string, string> = {
  choriste: "Choriste",
  bureau: "Bureau exécutif",
  tresorier: "Trésorier",
  commissionRecette: "Commission recette",
  commissionMusicale: "Commission musicale",
}

export const chorists: Chorist[] = [
  { id: 1, name: "Aline Mbeki", color: "#8C3A46", roles: ["choriste", "commissionRecette"], numero: "CH-014" },
  { id: 2, name: "Joseph Nkeng", color: "#3D2A52", roles: ["choriste", "bureau"], fonction: "Secrétaire général", numero: "CH-002", mandat: { debut: "15/01/2025", fin: "15/01/2027" } },
  { id: 3, name: "Rachel Fotso", color: "#C9A24B", roles: ["choriste", "tresorier"], numero: "CH-007", mandat: { debut: "15/01/2025", fin: "15/01/2027" } },
  { id: 4, name: "Paul Etoundi", color: "#3F6B4F", roles: ["choriste", "commissionMusicale"], numero: "CH-021" },
  { id: 5, name: "Grace Ateba", color: "#2E1B33", roles: ["choriste"], numero: "CH-033" },
]

export const roleHistory: Record<number, RoleHistoryEntry[]> = {
  1: [
    { role: "Choriste", debut: "01/03/2020", fin: null },
    { role: "Commission recette", debut: "10/01/2024", fin: null },
  ],
  2: [
    { role: "Choriste", debut: "01/06/2018", fin: null },
    { role: "Bureau exécutif — Secrétaire général", debut: "15/01/2025", fin: null },
  ],
  3: [
    { role: "Choriste", debut: "12/09/2019", fin: null },
    { role: "Trésorier", debut: "15/01/2025", fin: null },
  ],
  4: [
    { role: "Choriste", debut: "22/04/2021", fin: null },
    { role: "Commission musicale", debut: "03/02/2025", fin: null },
  ],
  5: [{ role: "Choriste", debut: "09/11/2022", fin: null }],
}

export const initialStatutaire: Record<number, boolean[]> = {
  1: [true, true, true, true, true, false, false, false, false, false, false, false],
  2: [true, true, true, true, true, true, true, false, false, false, false, false],
  3: [true, true, true, true, true, true, true, true, true, false, false, false],
  4: [true, true, false, false, false, false, false, false, false, false, false, false],
  5: [true, true, true, false, false, false, false, false, false, false, false, false],
}

export const initialEvents: Evenement[] = [
  {
    id: 1, titre: "Concert de Noël", type: "Concert", date: "2026-12-20",
    description: "Concert annuel de fin d'année à la paroisse Sainte-Cécile.",
    budgetPrevisionnel: 150000, cotisationMontant: 2000,
    inscrits: [1, 3, 4], depenses: [{ label: "Location sono", montant: 40000, valide: true }],
    contributions: { 1: 2000, 2: 0, 3: 2000, 4: 1000, 5: 0 },
  },
  {
    id: 2, titre: "Mariage — Famille Nkeng", type: "Mariage", date: "2026-09-05",
    description: "Cotisation événementielle de soutien pour le mariage d'un membre du bureau.",
    budgetPrevisionnel: 0, cotisationMontant: 3000,
    inscrits: [1, 2, 3, 5], depenses: [],
    contributions: { 1: 3000, 2: 0, 3: 3000, 4: 0, 5: 1500 },
  },
  {
    id: 3, titre: "Sortie annuelle", type: "Sortie", date: "2026-10-12",
    description: "Sortie détente au bord du lac, ouverte à tous les choristes.",
    budgetPrevisionnel: 80000, cotisationMontant: 5000,
    inscrits: [1, 4], depenses: [{ label: "Transport bus", montant: 25000, valide: false }],
    contributions: { 1: 5000, 2: 0, 3: 0, 4: 2500, 5: 0 },
  },
]

export const initialChants: Chant[] = [
  {
    id: 1, titre: "Alléluia du Seigneur", compositeur: "Jean Mbala", categorie: "Louange", tonalite: "Sol majeur",
    paroles: "Alléluia, alléluia,\nLe Seigneur règne à jamais.\nChantons sa gloire, chantons sa paix,\nAlléluia, alléluia.", statut: "actif",
  },
  {
    id: 2, titre: "Sanctus", compositeur: "Traditionnel", categorie: "Liturgique", tonalite: "Ré mineur",
    paroles: "Saint, saint, saint est le Seigneur,\nDieu de l'univers.\nLe ciel et la terre sont remplis de ta gloire.", statut: "actif",
  },
  {
    id: 3, titre: "Vers Toi Seigneur", compositeur: "Marie Ngo", categorie: "Louange", tonalite: "Do majeur",
    paroles: "Vers toi Seigneur je lève les mains,\nVers toi je viens chaque matin.\nTa grâce suffit, ton amour me porte.", statut: "actif",
  },
  {
    id: 4, titre: "Kyrie Eleison", compositeur: "Traditionnel", categorie: "Liturgique", tonalite: "Mi mineur",
    paroles: "Kyrie eleison,\nChriste eleison,\nKyrie eleison.", statut: "a_valider",
  },
]

export const initialRecus: Recu[] = [
  { id: "REC-2026-0114", chorishId: 1, type: "Statutaire", label: "Cotisation — Mai 2026", montant: 1000, date: "03/05/2026", enregistrePar: "Aline Mbeki (Commission recette)" },
  { id: "REC-2026-0098", chorishId: 1, type: "Événementielle", label: "Concert de Noël", montant: 2000, date: "22/04/2026", enregistrePar: "Rachel Fotso (Trésorière)" },
]
