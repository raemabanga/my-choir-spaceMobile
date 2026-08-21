import { useState } from "react"
import { Text, View } from "react-native"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { fmt, formatDateShort } from "../../lib/format"
import { DateField } from "../DateField"
import { Button, Field, ListRow, Muted, Pill, RowBetween, Select } from "../ui"

function SheetTitle({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 19, color: colors.aubergine, marginBottom: 4 }}>{children}</Text>
}

const EVENT_TYPES = ["Concert", "Sortie", "Veillée", "Mariage", "Décès", "Maladie"]

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
    const finalTitre = titre || "Nouvel événement"
    createEvent({
      titre: finalTitre,
      type,
      date: date.toISOString().slice(0, 10),
      description,
      budgetPrevisionnel: parseInt(budget) || 0,
      cotisationMontant: parseInt(cotisation) || 1000,
    })
    closeSheet()
    toast("Événement créé : " + finalTitre)
  }

  return (
    <View>
      <SheetTitle>Créer un événement</SheetTitle>
      <Field label="Titre" placeholder="Ex : Veillée de prière" value={titre} onChangeText={setTitre} />
      <Select label="Type" value={type} onChange={setType} options={EVENT_TYPES.map((t) => ({ label: t, value: t }))} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <DateField label="Date" value={date} onChange={setDate} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Budget prév." placeholder="0" value={budget} onChangeText={setBudget} keyboardType="numeric" />
        </View>
      </View>
      <Field label="Montant de cotisation / personne" placeholder="2000" value={cotisation} onChangeText={setCotisation} keyboardType="numeric" />
      <Field label="Description" placeholder="Détails de l'événement..." value={description} onChangeText={setDescription} multiline />
      <Button title="Créer l'événement" onPress={confirm} block style={{ marginTop: 20 }} />
      <Button title="Annuler" variant="ghost" onPress={closeSheet} block />
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
  const rec = Object.values(ev.contributions).reduce((a, b) => a + b, 0)
  const dep = ev.depenses.filter((d) => d.valide).reduce((a, b) => a + b.montant, 0)

  function handleAddDepense() {
    const montant = parseInt(depMontant) || 0
    if (!depLabel || !montant) {
      toast("Renseignez un intitulé et un montant")
      return
    }
    addDepense(eventId, depLabel, montant)
    setDepLabel("")
    setDepMontant("")
  }

  return (
    <View>
      <SheetTitle>{ev.titre}</SheetTitle>
      <Pill variant="gold">{ev.type}</Pill>
      <Muted style={{ marginTop: 10 }}>{ev.description}</Muted>

      <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: "rgba(46,27,51,0.08)", borderRadius: 18, padding: 16, marginTop: 6, marginBottom: 12 }}>
        <RowBetween>
          <Muted>Date</Muted>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>{formatDateShort(ev.date)}</Text>
        </RowBetween>
        <RowBetween style={{ marginTop: 8 }}>
          <Muted>Cotisation</Muted>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>{fmt(ev.cotisationMontant)} / personne</Text>
        </RowBetween>
        <RowBetween style={{ marginTop: 8 }}>
          <Muted>Inscrits</Muted>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>{ev.inscrits.length} choriste(s)</Text>
        </RowBetween>
      </View>

      <Button
        title={inscrit ? "Inscrit ✓ — Se désinscrire" : "S'inscrire à l'événement"}
        variant={inscrit ? "ghost" : "primary"}
        block
        onPress={() => {
          toggleInscription(eventId)
          toast(inscrit ? "Désinscription confirmée" : "Inscription confirmée")
        }}
      />

      {can("manageDepense") ? (
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 15, color: colors.aubergine }}>Dépenses</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(46,27,51,0.25)" }} />
          </View>

          {ev.depenses.length === 0 ? (
            <Muted>Aucune dépense enregistrée.</Muted>
          ) : (
            ev.depenses.map((d, i) => (
              <ListRow
                key={i}
                title={d.label}
                subtitle={fmt(d.montant)}
                right={
                  d.valide ? (
                    <Pill variant="green">Validée</Pill>
                  ) : (
                    <Button title="Valider" variant="outline" small onPress={() => validateDepense(eventId, i)} />
                  )
                }
              />
            ))
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="" placeholder="Intitulé" value={depLabel} onChangeText={setDepLabel} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="" placeholder="Montant" value={depMontant} onChangeText={setDepMontant} keyboardType="numeric" />
            </View>
          </View>
          <Button title="+ Ajouter une dépense" variant="ghost" block onPress={handleAddDepense} />

          <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: "rgba(46,27,51,0.08)", borderRadius: 18, padding: 16, marginTop: 4 }}>
            <RowBetween>
              <Muted>Recettes</Muted>
              <Text style={{ fontFamily: "Inter_700Bold", color: colors.green }}>{fmt(rec)}</Text>
            </RowBetween>
            <RowBetween style={{ marginTop: 6 }}>
              <Muted>Dépenses validées</Muted>
              <Text style={{ fontFamily: "Inter_700Bold", color: colors.burgundy }}>{fmt(dep)}</Text>
            </RowBetween>
            <RowBetween style={{ marginTop: 6 }}>
              <Muted>Solde</Muted>
              <Text style={{ fontFamily: "Inter_700Bold" }}>{fmt(rec - dep)}</Text>
            </RowBetween>
            {can("exportReport") ? (
              <Button
                title="Exporter le rapport"
                variant="outline"
                block
                style={{ marginTop: 10 }}
                onPress={() => toast("Export PDF généré (démo)")}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <Button title="Fermer" variant="ghost" block onPress={closeSheet} style={{ marginTop: 14 }} />
    </View>
  )
}
