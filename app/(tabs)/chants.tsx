import { router } from "expo-router"
import { useState } from "react"
import { View } from "react-native"

import { Screen } from "../../components/layout"
import { ChantFormSheet } from "../../components/sheets/ChantSheets"
import { Music } from "lucide-react-native"
import { Button, Card, CardTitle, Chip, ChipsRow, EmptyState, Muted, Pill, RowBetween, SearchBar } from "../../components/ui"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"

// Écran « Répertoire » : conforme à renderChants() du prototype.
export default function ChantsScreen() {
  const { chants, can } = useApp()
  const { openSheet } = useSheet()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Tous")

  const categories = ["Tous", ...Array.from(new Set(chants.map((c) => c.categorie)))]
  const q = search.trim().toLowerCase()
  const filtered = chants.filter(
    (c) =>
      (category === "Tous" || c.categorie === category) &&
      (c.titre.toLowerCase().includes(q) || c.compositeur.toLowerCase().includes(q))
  )

  return (
    <Screen title="Répertoire">
      <SearchBar placeholder="Rechercher un chant..." value={search} onChangeText={setSearch} />
      <ChipsRow>
        {categories.map((c) => (
          <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </ChipsRow>

      {can("chantsCreer") ? (
        <Button title="+ Ajouter un chant" block className="mb-3" onPress={() => openSheet(<ChantFormSheet />)} />
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState icon={Music} title="Aucun chant trouvé" subtitle="Essayez une autre recherche ou catégorie." />
      ) : (
        filtered.map((c) => (
          <Card key={c.id} accessibilityLabel={c.titre} onPress={() => router.push(`/chant/${c.id}`)}>
            <RowBetween>
              <CardTitle className="shrink">{c.titre}</CardTitle>
              {c.statut === "a_valider" ? <Pill variant="pending">Suppression proposée</Pill> : null}
            </RowBetween>
            <Muted>{c.compositeur}</Muted>
            <View className="mt-2 flex-row flex-wrap gap-1">
              <Pill>{c.categorie}</Pill>
              {c.tonalite ? <Pill variant="gold">{c.tonalite}</Pill> : null}
            </View>
          </Card>
        ))
      )}
    </Screen>
  )
}
