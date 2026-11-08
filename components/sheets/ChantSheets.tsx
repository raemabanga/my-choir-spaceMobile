import { useState } from "react"
import { View } from "react-native"
import { errorMessage, useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { Button, Field, FieldLabel, FormRow2, Select, SheetTitle } from "../ui"

// Formulaire du répertoire (openChantForm() du prototype). Le détail d'un chant est une page : app/chant/[id].tsx.

/** Ajout d'un chant au répertoire (l'API ne permet pas encore de modifier un chant). */
export function ChantFormSheet() {
  const { createChant, parametres } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  // Catégories et tonalités de la chorale (Paramètres du portail web) ; tonalité facultative.
  const categories = parametres.categoriesChant
  const tonalites = [{ label: "Non précisée", value: "" }, ...parametres.tonalitesChant.map((t) => ({ label: t, value: t }))]

  const [titre, setTitre] = useState("")
  const [compositeur, setCompositeur] = useState("")
  const [tonalite, setTonalite] = useState("")
  const [categorie, setCategorie] = useState(categories[0] ?? "")
  const [paroles, setParoles] = useState("")
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (busy) return
    if (!titre.trim()) {
      toast("Renseignez au moins le titre du chant")
      return
    }
    setBusy(true)
    try {
      await createChant({
        titre: titre.trim(),
        compositeur: compositeur.trim(),
        categorie: categorie.trim() || "Non classé",
        tonalite: tonalite.trim(),
        paroles,
      })
      closeSheet()
      toast("Chant ajouté au répertoire")
    } catch (e) {
      toast(errorMessage(e))
      setBusy(false)
    }
  }

  const comingSoon = () => toast("Fonctionnalité à venir")

  return (
    <View>
      <SheetTitle>Ajouter un chant</SheetTitle>
      <Field label="Titre" value={titre} onChangeText={setTitre} />
      <FormRow2>
        <Field label="Compositeur / auteur" value={compositeur} onChangeText={setCompositeur} />
        <Select label="Tonalité" value={tonalite} onChange={setTonalite} options={tonalites} />
      </FormRow2>
      <Select label="Catégorie" value={categorie} onChange={setCategorie} options={categories.map((c) => ({ label: c, value: c }))} />
      <Field label="Paroles" value={paroles} onChangeText={setParoles} multiline />
      <FieldLabel>Partition (fichier)</FieldLabel>
      <Button title="Choisir un fichier" variant="ghost" block onPress={comingSoon} />
      <FieldLabel>Fichier audio</FieldLabel>
      <Button title="Choisir un fichier" variant="ghost" block onPress={comingSoon} />
      <Button title={busy ? "Enregistrement…" : "Enregistrer le chant"} block className="mt-5" disabled={busy} onPress={confirm} />
      <Button title="Annuler" variant="ghost" block className="mt-2" onPress={closeSheet} />
    </View>
  )
}
