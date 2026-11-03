import { useState } from "react"
import { View } from "react-native"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { Chant } from "../../types"
import { Button, Field, FieldLabel, FormRow2, SheetTitle } from "../ui"

// Formulaire du répertoire (openChantForm() du prototype). Le détail d'un chant est une page : app/chant/[id].tsx.

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
    if (!titre.trim()) {
      toast("Renseignez au moins le titre du chant")
      return
    }
    saveChant(chant?.id ?? null, {
      titre: titre.trim(),
      compositeur,
      categorie: categorie || "Non classé",
      tonalite,
      paroles,
    })
    closeSheet()
    toast(chant ? "Chant modifié" : "Chant ajouté au répertoire")
  }

  const comingSoon = () => toast("Fonctionnalité à venir")

  return (
    <View>
      <SheetTitle>{chant ? "Modifier le chant" : "Ajouter un chant"}</SheetTitle>
      <Field label="Titre" value={titre} onChangeText={setTitre} />
      <FormRow2>
        <Field label="Compositeur / auteur" value={compositeur} onChangeText={setCompositeur} />
        <Field label="Tonalité" value={tonalite} onChangeText={setTonalite} placeholder="Ex : Sol majeur" />
      </FormRow2>
      <Field label="Catégorie / thème" value={categorie} onChangeText={setCategorie} placeholder="Louange, Liturgique..." />
      <Field label="Paroles" value={paroles} onChangeText={setParoles} multiline />
      <FieldLabel>Partition (fichier)</FieldLabel>
      <Button title="Choisir un fichier" variant="ghost" block onPress={comingSoon} />
      <FieldLabel>Fichier audio</FieldLabel>
      <Button title="Choisir un fichier" variant="ghost" block onPress={comingSoon} />
      <Button title="Enregistrer le chant" block className="mt-5" onPress={confirm} />
      <Button title="Annuler" variant="ghost" block className="mt-2" onPress={closeSheet} />
    </View>
  )
}
