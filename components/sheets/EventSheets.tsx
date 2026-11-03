// Bottom sheets Événements — conformes à openEventForm() et openEventSheet() du prototype cantoria-app-mobile-v2.html.
import { useState } from "react"
import { Text, View } from "react-native"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { eventBilan, fmt, formatDateShort } from "../../lib/format"
import { DateField } from "../DateField"
import { Button, Card, Field, FormRow2, KeyValue, ListRow, Muted, Pill, RowBetween, SectionHeader, Select, SheetTitle } from "../ui"

const EVENT_TYPES = ["Concert", "Sortie", "Veillée", "Mariage", "Décès", "Maladie"]

/**
 * Police Geist Mono des champs numériques. Exception `style` : Field ne transmet pas de className
 * à son TextInput (un className écraserait ses classes internes), on passe donc par sa prop `style`.
 */

/** Ligne de la carte Recettes / Dépenses / Solde : espacement de 6 (KeyValue n'offre que 0 ou 8). */
function BilanRow({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <View className={first ? undefined : "mt-1.5"}>{children}</View>
}

export function EventFormSheet() {
  const { createEvent } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()

  const [titre, setTitre] = useState("")
  const [type, setType] = useState(EVENT_TYPES[0])
  const [date, setDate] = useState(new Date())
  const [budget, setBudget] = useState("")
  const [cotisation, setCotisation] = useState("")
  const [description, setDescription] = useState("")

  function confirm() {
    if (!titre.trim()) {
      toast("Renseignez le titre de l'événement")
      return
    }
    createEvent({
      titre: titre.trim(),
      type,
      date: date.toISOString().slice(0, 10),
      description,
      budgetPrevisionnel: parseInt(budget) || 0,
      cotisationMontant: parseInt(cotisation) || 1000,
    })
    closeSheet()
    toast("Événement créé : " + titre.trim())
  }

  return (
    <View>
      <SheetTitle>Créer un événement</SheetTitle>
      <Field label="Titre" placeholder="Ex : Veillée de prière" value={titre} onChangeText={setTitre} />
      <Select label="Type" value={type} onChange={setType} options={EVENT_TYPES.map((t) => ({ label: t, value: t }))} />
      <FormRow2>
        <DateField label="Date" value={date} onChange={setDate} />
        <Field label="Budget prév." placeholder="0" value={budget} onChangeText={setBudget} keyboardType="numeric" mono />
      </FormRow2>
      <Field
        label="Montant de cotisation / personne"
        placeholder="2000"
        value={cotisation}
        onChangeText={setCotisation}
        keyboardType="numeric"
        mono
      />
      <Field label="Description" placeholder="Détails de l'événement..." value={description} onChangeText={setDescription} multiline />
      <Button title="Créer l'événement" onPress={confirm} block className="mt-5" />
      <Button title="Annuler" variant="ghost" onPress={closeSheet} block className="mt-2" />
    </View>
  )
}

export function EventDetailSheet({ eventId }: { eventId: number }) {
  const { events, currentUser, can, toggleInscription, addDepense, validateDepense } = useApp()
  const { toast } = useToast()
  const { closeSheet } = useSheet()
  const ev = events.find((e) => e.id === eventId)
  const [depLabel, setDepLabel] = useState("")
  const [depMontant, setDepMontant] = useState("")

  if (!ev || !currentUser) return null

  const inscrit = ev.inscrits.includes(currentUser.id)
  const bilan = eventBilan(ev)

  function handleAddDepense() {
    const montant = parseInt(depMontant) || 0
    if (!depLabel || !montant) {
      toast("Renseignez un intitulé et un montant")
      return
    }
    addDepense(eventId, depLabel, montant)
    setDepLabel("")
    setDepMontant("")
    toast("Dépense ajoutée — en attente de validation")
  }

  return (
    <View>
      <SheetTitle>{ev.titre}</SheetTitle>
      <Pill variant="gold">{ev.type}</Pill>
      {ev.description ? <Muted className="mb-1.5 mt-2.5 leading-[18px]">{ev.description}</Muted> : null}

      <Card className="mt-1.5">
        <KeyValue label="Date" value={formatDateShort(ev.date)} first mono />
        <KeyValue label="Cotisation" value={`${fmt(ev.cotisationMontant)} / personne`} mono />
        {/* Valeur mixte (nombre en Geist Mono + texte en Geist) : KeyValue n'accepte qu'une chaîne. */}
        <RowBetween className="mt-2">
          <Muted>Inscrits</Muted>
          <Text className="shrink text-right font-sans-bold text-[13px] tabular-nums text-ink">
            <Text className="font-mono-semibold">{ev.inscrits.length}</Text> choriste(s)
          </Text>
        </RowBetween>
      </Card>

      <Button
        title={inscrit ? "Inscrit ✓ — Se désinscrire" : "S'inscrire à l'événement"}
        variant={inscrit ? "ghost" : "primary"}
        block
        onPress={() => {
          toggleInscription(eventId)
          toast(inscrit ? "Désinscription confirmée" : "Inscription confirmée")
        }}
      />

      {can("budget") ? (
        <View>
          {/* « ! » : prime sur la marge haute par défaut de SectionHeader (22px). */}
          <SectionHeader title="Dépenses" className="mt-[18px]" />
          {ev.depenses.length === 0 ? (
            <Muted className="mb-0.5">Aucune dépense enregistrée.</Muted>
          ) : (
            ev.depenses.map((d, i) => (
              <ListRow
                key={i}
                title={d.label}
                // Montant en Geist Mono ; taille et couleur héritées du sous-titre de ListRow.
                subtitle={<Text className="font-mono-medium tabular-nums">{fmt(d.montant)}</Text>}
                right={
                  d.valide ? (
                    <Pill variant="green">Validée</Pill>
                  ) : !can("depensesValider") ? (
                    <Pill variant="pending">En attente</Pill>
                  ) : (
                    <Button
                      title="Valider"
                      variant="outline"
                      small
                      onPress={() => {
                        validateDepense(eventId, i)
                        toast("Dépense validée")
                      }}
                    />
                  )
                }
              />
            ))
          )}

          <View className="mt-2.5">
            <FormRow2>
              <Field label="" placeholder="Intitulé" value={depLabel} onChangeText={setDepLabel} />
              <Field label="" placeholder="Montant" value={depMontant} onChangeText={setDepMontant} keyboardType="numeric" mono />
            </FormRow2>
          </View>
          <Button title="+ Ajouter une dépense" variant="ghost" block className="mt-2" onPress={handleAddDepense} />

          <Card className="mt-3">
            <BilanRow first>
              <KeyValue label="Recettes" value={fmt(bilan.recettes)} valueClassName="text-success" first mono />
            </BilanRow>
            <BilanRow>
              <KeyValue label="Dépenses validées" value={fmt(bilan.validees)} valueClassName="text-danger" first mono />
            </BilanRow>
            <BilanRow>
              <KeyValue label="Solde" value={fmt(bilan.solde)} first mono />
            </BilanRow>
            {can("rapports") ? (
              <Button title="Exporter le rapport" variant="outline" block className="mt-2.5" onPress={() => toast("Export PDF généré (démo)")} />
            ) : null}
          </Card>
        </View>
      ) : null}

      <Button title="Fermer" variant="ghost" block onPress={closeSheet} className="mt-3.5" />
    </View>
  )
}
