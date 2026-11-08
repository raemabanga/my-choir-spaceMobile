// Bottom sheets Événements — conformes à openEventForm() et openEventSheet() du prototype cantoria-app-mobile-v2.html.
import { useState } from "react"
import { Text, View } from "react-native"
import { errorMessage, useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import type { ModeReglement } from "../../lib/api"
import { eventBilan, fmt, formatDateShort } from "../../lib/format"
import { DateField } from "../DateField"
import { Button, Card, Field, FormRow2, KeyValue, ListRow, Muted, Pill, RowBetween, SectionHeader, Select, SheetTitle } from "../ui"

// Types d'événement, catégories de dépense et modes de règlement : ceux de la chorale
// (Paramètres du portail web), via useApp().parametres.

/** "concert" → "Concert" : le backend enregistre les types en minuscules. */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "AAAA-MM-JJ" en heure locale (toISOString décalerait la date selon le fuseau). */
function localISODate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Police Geist Mono des champs numériques. Exception `style` : Field ne transmet pas de className
 * à son TextInput (un className écraserait ses classes internes), on passe donc par sa prop `style`.
 */

/** Ligne de la carte Recettes / Dépenses / Solde : espacement de 6 (KeyValue n'offre que 0 ou 8). */
function BilanRow({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <View className={first ? undefined : "mt-1.5"}>{children}</View>
}

export function EventFormSheet() {
  const { createEvent, isDemo, parametres } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  // Libellés avec majuscule : affichés tels quels en démonstration, remis en minuscules par l'API.
  const eventTypes = parametres.typesEvenement.map(capitalize)

  const [titre, setTitre] = useState("")
  const [type, setType] = useState(eventTypes[0] ?? "Concert")
  const [date, setDate] = useState(new Date())
  const [budget, setBudget] = useState("")
  const [cotisation, setCotisation] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (busy) return
    if (!titre.trim()) {
      toast("Renseignez le titre de l'événement")
      return
    }
    setBusy(true)
    try {
      await createEvent({
        titre: titre.trim(),
        type,
        date: localISODate(date),
        description,
        budgetPrevisionnel: parseInt(budget) || 0,
        cotisationMontant: parseInt(cotisation) || 1000,
      })
      closeSheet()
      toast("Événement créé : " + titre.trim())
    } catch (e) {
      toast(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <View>
      <SheetTitle>Créer un événement</SheetTitle>
      <Field label="Titre" placeholder="Ex : Veillée de prière" value={titre} onChangeText={setTitre} />
      <Select label="Type" value={type} onChange={setType} options={eventTypes.map((t) => ({ label: t, value: t }))} />
      <FormRow2>
        <DateField label="Date" value={date} onChange={setDate} />
        <Field label="Budget prév." placeholder="0" value={budget} onChangeText={setBudget} keyboardType="numeric" mono />
      </FormRow2>
      <Field
        label="Montant de cotisation / personne"
        placeholder="1000"
        value={cotisation}
        onChangeText={setCotisation}
        keyboardType="numeric"
        mono
      />
      {/* Description : démonstration uniquement (l'API ne l'enregistre pas). */}
      {isDemo ? (
        <Field label="Description" placeholder="Détails de l'événement..." value={description} onChangeText={setDescription} multiline />
      ) : null}
      <Button title={busy ? "Création…" : "Créer l'événement"} onPress={confirm} disabled={busy} block className="mt-5" />
      <Button title="Annuler" variant="ghost" onPress={closeSheet} block className="mt-2" />
    </View>
  )
}

export function EventDetailSheet({ eventId }: { eventId: number }) {
  const { events, currentUser, can, isDemo, parametres, toggleInscription, addDepense, validateDepense } = useApp()
  const { toast } = useToast()
  const { closeSheet } = useSheet()
  const ev = events.find((e) => e.id === eventId)
  const { categoriesDepense, modesReglement } = parametres
  const [depLabel, setDepLabel] = useState("")
  const [depMontant, setDepMontant] = useState("")
  const [depCategorie, setDepCategorie] = useState(categoriesDepense[0] ?? "Divers")
  const [depBeneficiaire, setDepBeneficiaire] = useState("")
  const [depMode, setDepMode] = useState<ModeReglement>(modesReglement[0]?.code ?? "ESPECES")
  const [busy, setBusy] = useState(false)

  if (!ev || !currentUser) return null

  const inscrit = ev.inscrits.includes(currentUser.id)
  const bilan = eventBilan(ev)

  async function handleAddDepense() {
    if (busy) return
    const montant = parseInt(depMontant) || 0
    if (!depLabel.trim() || !montant) {
      toast("Renseignez un intitulé et un montant")
      return
    }
    if (!isDemo && !depBeneficiaire.trim()) {
      toast("Renseignez le bénéficiaire de la dépense")
      return
    }
    setBusy(true)
    try {
      await addDepense(eventId, depLabel.trim(), montant, { categorie: depCategorie, beneficiaire: depBeneficiaire.trim(), mode: depMode })
      setDepLabel("")
      setDepMontant("")
      setDepBeneficiaire("")
      toast("Dépense ajoutée — en attente de validation")
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleValidate(idx: number) {
    try {
      await validateDepense(eventId, idx)
      toast("Dépense validée")
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  return (
    <View>
      <SheetTitle>{ev.titre}</SheetTitle>
      <Pill variant="gold">{ev.type}</Pill>
      {ev.description ? <Muted className="mb-1.5 mt-2.5 leading-[18px]">{ev.description}</Muted> : null}

      <Card className="mt-1.5">
        <KeyValue label="Date" value={formatDateShort(ev.date)} first mono />
        <KeyValue label="Cotisation" value={`${fmt(ev.cotisationMontant)} / personne`} mono />
        {/* Inscriptions : démonstration uniquement (pas encore gérées par l'API). */}
        {isDemo ? (
          // Valeur mixte (nombre en Geist Mono + texte en Geist) : KeyValue n'accepte qu'une chaîne.
          <RowBetween className="mt-2">
            <Muted>Inscrits</Muted>
            <Text className="shrink text-right font-sans-bold text-[13px] tabular-nums text-ink">
              <Text className="font-sans-semibold">{ev.inscrits.length}</Text> choriste(s)
            </Text>
          </RowBetween>
        ) : null}
      </Card>

      {isDemo ? (
        <Button
          title={inscrit ? "Se désinscrire de l’événement" : "S’inscrire à l’événement"}
          variant={inscrit ? "ghost" : "primary"}
          block
          onPress={() => {
            toggleInscription(eventId)
            toast(inscrit ? "Désinscription confirmée" : "Inscription confirmée")
          }}
        />
      ) : null}

      {can("budget") ? (
        <View>
          {/* « ! » : prime sur la marge haute par défaut de SectionHeader (22px). */}
          <SectionHeader title="Dépenses" className="mt-[18px]" />
          {ev.depenses.length === 0 ? (
            <Muted className="mb-0.5">Aucune dépense enregistrée.</Muted>
          ) : (
            ev.depenses.map((d, i) => (
              <ListRow
                key={d.id ?? i}
                title={d.label}
                // Montant en Geist Mono ; taille et couleur héritées du sous-titre de ListRow.
                subtitle={<Text className="font-sans-medium tabular-nums">{fmt(d.montant)}</Text>}
                right={
                  d.valide ? (
                    <Pill variant="green">Validée</Pill>
                  ) : !can("depensesValider") ? (
                    <Pill variant="pending">En attente</Pill>
                  ) : (
                    <Button title="Valider" variant="outline" small onPress={() => handleValidate(i)} />
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
            {/* Champs exigés par l'API (comme sur le web). */}
            {!isDemo ? (
              <>
                <Field label="Bénéficiaire" placeholder="Ex : Sono Plus SARL" value={depBeneficiaire} onChangeText={setDepBeneficiaire} />
                <FormRow2>
                  <Select label="Catégorie" value={depCategorie} onChange={setDepCategorie} options={categoriesDepense.map((c) => ({ label: c, value: c }))} />
                  <Select
                    label="Mode"
                    value={depMode}
                    onChange={setDepMode}
                    options={modesReglement.map((m) => ({ label: m.label, value: m.code }))}
                  />
                </FormRow2>
              </>
            ) : null}
          </View>
          <Button
            title={busy ? "Ajout…" : "+ Ajouter une dépense"}
            variant="ghost"
            block
            className="mt-2"
            disabled={busy}
            onPress={handleAddDepense}
          />

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
