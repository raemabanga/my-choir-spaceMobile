import { useState } from "react"
import { ScrollView, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AppHeader } from "../../components/AppHeader"
import { ChantDetailSheet, ChantFormSheet } from "../../components/sheets/ChantSheets"
import { Button, Card, CardTitle, Chip, EmptyState, Muted, Pill, RowBetween, SearchBar } from "../../components/ui"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"

export default function ChantsScreen() {
  const { chants, can } = useApp()
  const { openSheet } = useSheet()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Tous")

  const categories = ["Tous", ...Array.from(new Set(chants.map((c) => c.categorie)))]
  const filtered = chants.filter(
    (c) =>
      (category === "Tous" || c.categorie === category) &&
      c.titre.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["top"]}>
      <AppHeader title="Répertoire" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 100 }}>
        <SearchBar placeholder="Rechercher un chant..." value={search} onChangeText={setSearch} />
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {categories.map((c) => (
            <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>

        {can("addSong") ? (
          <Button title="+ Ajouter un chant" block style={{ marginBottom: 4 }} onPress={() => openSheet(<ChantFormSheet />)} />
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState icon="🎼" title="Aucun chant trouvé" subtitle="Essayez une autre recherche ou catégorie." />
        ) : (
          filtered.map((c) => (
            <Card key={c.id} onPress={() => openSheet(<ChantDetailSheet chantId={c.id} />)}>
              <RowBetween>
                <CardTitle>{c.titre}</CardTitle>
                {c.statut === "a_valider" ? <Pill variant="pending">Suppression proposée</Pill> : null}
              </RowBetween>
              <Muted>{c.compositeur}</Muted>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                <Pill>{c.categorie}</Pill>
                <Pill variant="gold">{c.tonalite}</Pill>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
