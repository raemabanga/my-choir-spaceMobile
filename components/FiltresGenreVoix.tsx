// Filtres « genre » et « voix » des listes de choristes (feuille d'appel, liste des choristes),
// comme sur le portail web (components/portail/filtres-genre-voix.tsx).
import { View } from "react-native"
import { Select } from "./ui"

/** Valeur des filtres pour les membres dont le champ n'est pas renseigné. */
export const NON_RENSEIGNE = "aucun"
const TOUS = "tous"

const GENRES = [
  { value: TOUS, label: "Tous les genres" },
  { value: "FEMME", label: "Femmes" },
  { value: "HOMME", label: "Hommes" },
  { value: NON_RENSEIGNE, label: "Genre non renseigné" },
]

const VOIX = [
  { value: TOUS, label: "Toutes les voix" },
  { value: "SOPRANO", label: "Sopranos" },
  { value: "ALTO", label: "Altos" },
  { value: "TENOR", label: "Ténors" },
  { value: "BASSE", label: "Basses" },
  { value: NON_RENSEIGNE, label: "Voix non renseignée" },
]

export interface FiltreGenreVoix {
  genre: string
  voix: string
}

export const FILTRE_GENRE_VOIX_DEFAUT: FiltreGenreVoix = { genre: TOUS, voix: TOUS }

const correspond = (filtre: string, valeur: string | null | undefined) =>
  filtre === TOUS || (filtre === NON_RENSEIGNE ? !valeur : valeur === filtre)

/** Le membre passe les filtres genre et voix. */
export function filtrerGenreVoix(m: { genre?: string | null; voix?: string | null }, f: FiltreGenreVoix) {
  return correspond(f.genre, m.genre) && correspond(f.voix, m.voix)
}

/** Les deux listes, côte à côte. */
export function FiltresGenreVoix({ value, onChange }: { value: FiltreGenreVoix; onChange: (f: FiltreGenreVoix) => void }) {
  return (
    <View className="mb-3.5 flex-row gap-2.5">
      <View className="flex-1">
        <Select label="Genre" value={value.genre} options={GENRES} onChange={(genre) => onChange({ ...value, genre })} first />
      </View>
      <View className="flex-1">
        <Select label="Voix" value={value.voix} options={VOIX} onChange={(voix) => onChange({ ...value, voix })} first />
      </View>
    </View>
  )
}
