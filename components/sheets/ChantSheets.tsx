import { useState } from "react"
import { Text, View } from "react-native"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { Chant } from "../../types"
import { Button, Field, Muted, Pill, ProgressBar, RowBetween } from "../ui"

function SheetTitle({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 19, color: colors.aubergine, marginBottom: 4 }}>{children}</Text>
}

export function ChantFormSheet({ chant }: { chant?: Chant }) {
  const { saveChant } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()

  const [titre, setTitre] = useState(chant?.titre ?? "")
  const [compositeur, setCompositeur] = useState(chant?.compositeur ?? "")
  const [tonalite, setTonalite] = useState(chant?.tonalite ?? "")
  const [categorie, setCategorie] = useState(chant?.categorie ?? "")
  const [paroles, setParoles] = useState(chant?.paroles ?? "")

  function confirm() {
    saveChant(chant?.id ?? null, {
      titre: titre || "Sans titre",
      compositeur,
      categorie: categorie || "Non classé",
      tonalite,
      paroles,
    })
    closeSheet()
    toast(chant ? "Chant modifié" : "Chant ajouté au répertoire")
  }

  return (
    <View>
      <SheetTitle>{chant ? "Modifier le chant" : "Ajouter un chant"}</SheetTitle>
      <Field label="Titre" value={titre} onChangeText={setTitre} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Compositeur / auteur" value={compositeur} onChangeText={setCompositeur} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Tonalité" value={tonalite} onChangeText={setTonalite} placeholder="Ex : Sol majeur" />
        </View>
      </View>
      <Field label="Catégorie / thème" value={categorie} onChangeText={setCategorie} placeholder="Louange, Liturgique..." />
      <Field label="Paroles" value={paroles} onChangeText={setParoles} multiline />
      <Button title="Partition (PDF) — choisir un fichier" variant="ghost" block onPress={() => toast("Fonctionnalité à venir")} />
      <Button title="Fichier audio — choisir un fichier" variant="ghost" block onPress={() => toast("Fonctionnalité à venir")} />
      <Button title="Enregistrer le chant" onPress={confirm} block style={{ marginTop: 12 }} />
      <Button title="Annuler" variant="ghost" onPress={closeSheet} block />
    </View>
  )
}

export function ChantDetailSheet({ chantId }: { chantId: number }) {
  const { chants, can, proposeDeleteSong, validateDeleteSong } = useApp()
  const { openSheet, closeSheet } = useSheet()
  const { toast } = useToast()
  const chant = chants.find((c) => c.id === chantId)
  if (!chant) return null

  return (
    <View>
      <SheetTitle>{chant.titre}</SheetTitle>
      <Muted>{chant.compositeur}</Muted>
      <View style={{ flexDirection: "row", gap: 6, marginVertical: 10, flexWrap: "wrap" }}>
        <Pill>{chant.categorie}</Pill>
        <Pill variant="gold">{chant.tonalite}</Pill>
        {chant.statut === "a_valider" ? <Pill variant="pending">Suppression proposée</Pill> : null}
      </View>

      <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: "rgba(46,27,51,0.08)", borderRadius: 18, padding: 16, marginBottom: 12 }}>
        <RowBetween>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>▶ Écouter l'audio</Text>
          <Muted>02:41</Muted>
        </RowBetween>
        <ProgressBar percent={30} />
      </View>

      <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: "rgba(46,27,51,0.08)", borderRadius: 18, padding: 16, marginBottom: 12 }}>
        <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 14, color: colors.ink }}>Paroles</Text>
        <Text style={{ fontSize: 13.5, color: colors.ink, marginTop: 8, lineHeight: 20 }}>{chant.paroles}</Text>
      </View>

      <Button title="📄 Voir la partition (PDF)" variant="ghost" block onPress={() => toast("Fonctionnalité à venir")} />

      {can("addSong") ? (
        <Button title="Modifier" variant="outline" block onPress={() => openSheet(<ChantFormSheet chant={chant} />)} />
      ) : null}
      {can("proposeDeleteSong") && chant.statut !== "a_valider" ? (
        <Button
          title="Proposer la suppression"
          variant="danger"
          block
          onPress={() => {
            proposeDeleteSong(chant.id)
            closeSheet()
            toast("Suppression proposée au bureau exécutif")
          }}
        />
      ) : null}
      {can("validateDeleteSong") && chant.statut === "a_valider" ? (
        <Button
          title="Valider la suppression"
          variant="danger"
          block
          onPress={() => {
            validateDeleteSong(chant.id)
            closeSheet()
            toast("Chant supprimé du répertoire")
          }}
        />
      ) : null}

      <Button title="Fermer" variant="ghost" block onPress={closeSheet} style={{ marginTop: 8 }} />
    </View>
  )
}
