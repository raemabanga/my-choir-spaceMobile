import { useState } from "react"
import { View } from "react-native"
import { errorMessage, useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { Chant } from "../../types"
import { Button, Field, FieldLabel, FormRow2, Select, SheetTitle } from "../ui"

// Formulaire du répertoire (openChantForm() du prototype). Le détail d'un chant est une page : app/chant/[id].tsx.

export function ChantFormSheet({ chant }: { chant?: Chant }) {
  const { saveChant, parametres } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  // Catégories de la chorale (Paramètres du portail web) ; celle d'un chant modifié reste proposée
  // même si elle a été retirée de la liste depuis.
  const categories = [...new Set([...parametres.categoriesChant, ...(chant?.categorie ? [chant.categorie] : [])])]
  // Tonalités de la chorale (facultative : « Non précisée ») ; même règle pour celle d'un chant modifié.
  const tonalites = [
    { label: "Non précisée", value: "" },
    ...[...new Set([...parametres.tonalitesChant, ...(chant?.tonalite ? [chant.tonalite] : [])])].map((t) => ({ label: t, value: t })),
  ]

  const [titre, setTitre] = useState(chant?.titre ?? "")
  const [compositeur, setCompositeur] = useState(chant?.compositeur ?? "")
  const [tonalite, setTonalite] = useState(chant?.tonalite ?? "")
  const [categorie, setCategorie] = useState(chant?.categorie ?? categories[0] ?? "")
  const [paroles, setParoles] = useState(chant?.paroles ?? "")
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (busy) return
    if (!titre.trim()) {
      toast("Renseignez au moins le titre du chant")
      return
    }
    setBusy(true)
    try {
      await saveChant(chant?.id ?? null, {
        titre: titre.trim(),
        compositeur: compositeur.trim(),
        categorie: categorie.trim() || "Non classé",
        tonalite: tonalite.trim(),
        paroles,
      })
      closeSheet()
      toast(chant ? "Chant modifié" : "Chant ajouté au répertoire")
    } catch (e) {
      toast(errorMessage(e))
      setBusy(false)
    }
  }

  const comingSoon = () => toast("Fonctionnalité à venir")

  return (
    <View>
      <SheetTitle>{chant ? "Modifier le chant" : "Ajouter un chant"}</SheetTitle>
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
