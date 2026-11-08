// Bottom sheets Événements — conformes à openEventForm() et openEventSheet() du prototype cantoria-app-mobile-v2.html.
import { useState } from "react"
import { Pressable, Switch, Text, View } from "react-native"
import { colors } from "../../constants/theme"
import { errorMessage, useApp } from "../../context/AppContext"
import { parId } from "../../context/choraleData"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import type { ModeReglement } from "../../lib/api"
import { eventBilan, fmt, formatDateShort } from "../../lib/format"
import type { Evenement } from "../../types"
import { DateField } from "../DateField"
import { RecordSyncBadge } from "../sync"
import { Button, Card, Field, FieldLabel, FormRow2, KeyValue, ListRow, Muted, Pill, SectionHeader, Select, SheetTitle } from "../ui"

// Types d'événement, catégories de dépense et modes de règlement : ceux de la chorale
// (Paramètres du portail web), via useApp().parametres.

/** "concert" → "Concert" : le backend enregistre les types en minuscules. */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "AAAA-MM-JJ" en heure locale (toISOString décalerait la date selon le fuseau). */
function localISODate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "AAAA-MM-JJ" → Date locale (sans décalage de fuseau) ; aujourd'hui si la date est vide. */
function parseLocalISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return y && m && d ? new Date(y, m - 1, d) : new Date()
}

/**
 * Police Geist Mono des champs numériques. Exception `style` : Field ne transmet pas de className
 * à son TextInput (un className écraserait ses classes internes), on passe donc par sa prop `style`.
 */

/** Ligne de la carte Recettes / Dépenses / Solde : espacement de 6 (KeyValue n'offre que 0 ou 8). */
function BilanRow({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <View className={first ? undefined : "mt-1.5"}>{children}</View>
}

/** Création d'un événement, ou modification de `event`. Enregistré sur le téléphone, envoyé dès que possible. */
export function EventFormSheet({ event }: { event?: Evenement }) {
  const { createEvent, updateEvent, parametres } = useApp()
  const { closeSheet } = useSheet()
  const { toast } = useToast()
  // Libellés affichés avec une majuscule, remis en minuscules par l'API ; le type d'un événement
  // modifié reste proposé même s'il a été retiré de la liste depuis.
  const eventTypes = [...new Set([...parametres.typesEvenement.map(capitalize), ...(event?.type ? [event.type] : [])])]

  const [titre, setTitre] = useState(event?.titre ?? "")
  const [type, setType] = useState(event?.type ?? eventTypes[0] ?? "Concert")
  const [date, setDate] = useState(event ? parseLocalISODate(event.date) : new Date())
  const [inscriptionsOuvertes, setInscriptionsOuvertes] = useState(event?.inscriptionsOuvertes ?? false)
  // Événement sans date (permis par l'API) : il le reste tant qu'on ne choisit pas une date.
  const [sansDate, setSansDate] = useState(event ? event.date === "" : false)
  const [budget, setBudget] = useState(event ? String(event.budgetPrevisionnel) : "")
  const [cotisation, setCotisation] = useState(event ? String(event.cotisationMontant) : "")
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (busy) return
    if (!titre.trim()) {
      toast("Renseignez le titre de l'événement")
      return
    }
    setBusy(true)
    try {
      const input = {
        titre: titre.trim(),
        type,
        date: sansDate ? "" : localISODate(date),
        budgetPrevisionnel: parseInt(budget) || 0,
        // Champ vidé : 1000 à la création ; en modification, 0 reste possible (événement gratuit).
        cotisationMontant: cotisation.trim() === "" ? (event ? 0 : 1000) : parseInt(cotisation) || 0,
        inscriptionsOuvertes,
      }
      if (event) await updateEvent(event.id, input)
      else await createEvent(input)
      closeSheet()
      toast((event ? "Événement modifié : " : "Événement créé : ") + titre.trim())
    } catch (e) {
      toast(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <View>
      <SheetTitle>{event ? "Modifier l'événement" : "Créer un événement"}</SheetTitle>
      <Field label="Titre" placeholder="Ex : Veillée de prière" value={titre} onChangeText={setTitre} />
      <Select label="Type" value={type} onChange={setType} options={eventTypes.map((t) => ({ label: t, value: t }))} />
      <FormRow2>
        {sansDate ? (
          <View>
            <FieldLabel>Date</FieldLabel>
            <Button title="Choisir une date" variant="outline" block onPress={() => setSansDate(false)} />
          </View>
        ) : (
          <DateField label="Date" value={date} onChange={setDate} />
        )}
        <Field label="Budget prév." placeholder="0" value={budget} onChangeText={setBudget} keyboardType="numeric" mono />
      </FormRow2>
      <Pressable
        onPress={() => setSansDate((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: sansDate }}
        hitSlop={6}
        className="mt-2 flex-row items-center gap-2 self-start"
      >
        <View className={sansDate ? "h-4 w-4 items-center justify-center rounded border border-navy bg-navy" : "h-4 w-4 rounded border border-line-strong bg-paper"}>
          {sansDate ? <Text className="font-sans-bold text-[10px] leading-[12px] text-paper">✓</Text> : null}
        </View>
        <Text className="font-sans text-[13px] text-ink">Date à fixer plus tard</Text>
      </Pressable>
      <Field
        label="Montant de cotisation / personne"
        placeholder="1000"
        value={cotisation}
        onChangeText={setCotisation}
        keyboardType="numeric"
        mono
      />
      {/* Interrupteur : les choristes peuvent-ils s'inscrire (concert, sortie…) ? */}
      <View className="mt-4 flex-row items-center gap-3 rounded-field border border-line bg-paper px-3 py-2.5">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-[14px] text-ink">Inscriptions des choristes</Text>
          <Text className="mt-0.5 font-sans text-[12px] text-ink-light">
            {inscriptionsOuvertes ? "Les choristes peuvent s'inscrire à cet événement." : "Activez pour permettre aux choristes de s'inscrire."}
          </Text>
        </View>
        <Switch
          value={inscriptionsOuvertes}
          onValueChange={setInscriptionsOuvertes}
          accessibilityLabel="Inscriptions des choristes"
          // Composant natif : couleurs en props.
          trackColor={{ false: colors.lineStrong, true: colors.navy }}
          thumbColor={colors.paper}
        />
      </View>
      <Button
        title={busy ? "Enregistrement…" : event ? "Enregistrer les modifications" : "Créer l'événement"}
        onPress={confirm}
        disabled={busy}
        block
        className="mt-5"
      />
      <Button title="Annuler" variant="ghost" onPress={closeSheet} block className="mt-2" />
    </View>
  )
}

export function EventDetailSheet({ eventId }: { eventId: number }) {
  const { events, currentUser, can, parametres, addDepense, validateDepense, deleteEvent, updateEvent, session } = useApp()
  const { toast } = useToast()
  const { openSheet, closeSheet } = useSheet()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ev = parId(events, eventId)
  const { categoriesDepense, modesReglement } = parametres
  const [depLabel, setDepLabel] = useState("")
  const [depMontant, setDepMontant] = useState("")
  const [depCategorie, setDepCategorie] = useState(categoriesDepense[0] ?? "Divers")
  const [depBeneficiaire, setDepBeneficiaire] = useState("")
  const [depMode, setDepMode] = useState<ModeReglement>(modesReglement[0]?.code ?? "ESPECES")
  const [busy, setBusy] = useState(false)

  if (!ev || !currentUser) return null

  const bilan = eventBilan(ev)

  async function handleAddDepense() {
    if (busy) return
    const montant = parseInt(depMontant) || 0
    if (!depLabel.trim() || !montant) {
      toast("Renseignez un intitulé et un montant")
      return
    }
    if (!depBeneficiaire.trim()) {
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

  async function handleDelete() {
    try {
      await deleteEvent(eventId)
      closeSheet()
      toast("Événement supprimé")
    } catch (e) {
      toast(errorMessage(e))
      setConfirmDelete(false)
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
      <View className="flex-row flex-wrap items-center gap-1.5">
        <Pill variant="gold">{ev.type}</Pill>
        {ev.syncStatus ? <RecordSyncBadge status={ev.syncStatus} /> : null}
      </View>
      {ev.description ? <Muted className="mb-1.5 mt-2.5 leading-[18px]">{ev.description}</Muted> : null}

      <Card className="mt-1.5">
        <KeyValue label="Date" value={formatDateShort(ev.date)} first mono />
        <KeyValue label="Cotisation" value={`${fmt(ev.cotisationMontant)} / personne`} mono />
      </Card>

      {/* Inscriptions : nombre d'inscrits (liste pour les gestionnaires, qui les ouvrent ou les ferment).
          S'inscrire ou se désinscrire se fait sur la carte de l'événement, dans la liste. */}
      {ev.inscriptionsOuvertes || ev.inscrit || can("evenements") ? (
        <Card className="mt-1.5">
          <Muted className="mb-1.5">{ev.inscriptionsOuvertes ? "Inscriptions ouvertes" : "Inscriptions fermées"}</Muted>
          <KeyValue label="Inscrits" value={`${ev.inscrits?.length ?? 0} choriste${(ev.inscrits?.length ?? 0) > 1 ? "s" : ""}`} first mono />
          {ev.inscrit ? <Muted className="mt-1.5">Vous êtes inscrit(e) à cet événement.</Muted> : null}
          {can("evenements") && (ev.inscrits?.length ?? 0) > 0 ? (
            <Muted className="mt-1.5">{ev.inscrits!.map((i) => i.nom).join(", ")}</Muted>
          ) : null}
          {can("evenements") ? (
            <Button
              title={ev.inscriptionsOuvertes ? "Fermer les inscriptions" : "Ouvrir les inscriptions"}
              variant="outline"
              block
              className="mt-2"
              onPress={() => {
                const ouvrir = !ev.inscriptionsOuvertes
                updateEvent(eventId, {
                  titre: ev.titre,
                  type: ev.type,
                  date: ev.date,
                  budgetPrevisionnel: ev.budgetPrevisionnel,
                  cotisationMontant: ev.cotisationMontant,
                  inscriptionsOuvertes: ouvrir,
                })
                  .then(() => toast(ouvrir ? "Inscriptions ouvertes" : "Inscriptions fermées"))
                  .catch((e) => toast(errorMessage(e)))
              }}
            />
          ) : null}
        </Card>
      ) : null}

      {/* Gestion : bureau, trésorerie, secrétariat (comme sur le web). Marche aussi hors ligne. */}
      {can("evenements") ? (
        confirmDelete ? (
          <Card className="mt-1.5 border-danger bg-danger-bg">
            <Text className="font-sans-medium text-[13px] text-danger">Supprimer définitivement « {ev.titre} » ?</Text>
            <View className="mt-2.5 flex-row gap-2">
              <View className="flex-1">
                <Button title="Supprimer" variant="danger" block onPress={handleDelete} />
              </View>
              <View className="flex-1">
                <Button title="Annuler" variant="ghost" block onPress={() => setConfirmDelete(false)} />
              </View>
            </View>
          </Card>
        ) : (
          <View className="mt-1.5 flex-row gap-2">
            <View className="flex-1">
              <Button title="Modifier" variant="outline" block onPress={() => openSheet(<EventFormSheet event={ev} />)} />
            </View>
            <View className="flex-1">
              <Button title="Supprimer" variant="danger" block onPress={() => setConfirmDelete(true)} />
            </View>
          </View>
        )
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
                  d.syncStatus && d.syncStatus !== "synced" ? (
                    // Pas encore envoyée (ou refusée) : la validation attend le serveur.
                    <RecordSyncBadge status={d.syncStatus} />
                  ) : d.valide ? (
                    <Pill variant="green">Validée</Pill>
                  ) : !can("depensesValider") || (d.saisiParId != null && d.saisiParId === session?.userId) ? (
                    // Sa propre dépense : un autre membre du bureau ou de la trésorerie la valide.
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
