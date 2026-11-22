// Présences : bottom sheet « Excuser » de l'écran Faire l'appel (app/presences.tsx) et règles
// communes pour retrouver la feuille d'une séance sur le téléphone.
import { useState } from "react"
import { View } from "react-native"
import { useSheet } from "../../context/SheetContext"
import type { OfflineRecord } from "../../lib/offline"
import { HEURE_DEFAUT, heureFr, heureValide } from "../../lib/api"
import { creneauSeance, heureSeance, type SeanceData } from "../../lib/offline/entities"
import { localISODate, parseLocalISODate } from "../../lib/format"
import { seancePrioritaire } from "../../lib/presences"
import { DateField } from "../DateField"
import { TimeField } from "../TimeField"
import { Button, Chip, ChipsRow, Field, Muted, Select, SheetTitle } from "../ui"

// Choix entre deux enregistrements locaux d'une même séance : règle pure partagée (lib/presences.ts).
export { seancePrioritaire }

/** Répétition ou culte : jour et heure ("HH:MM") ; ancienne feuille sans heure : heure null (culte : son numéro). */
export type CleJour = { type: "REPETITION" | "CULTE"; date: string; heure: string | null; numero?: number | null }

/** Clé d'une feuille choisie à l'écran : une répétition ou un culte (jour et heure), ou un événement (sa date n'en fait pas partie). */
export type CleAppel = CleJour | { type: "EVENEMENT"; eventId: number }

/** Créneau d'une clé, comparable à `creneauSeance` d'une feuille enregistrée. */
const creneauCle = (cle: CleJour) => creneauSeance({ type: cle.type, heure: cle.heure, numero: cle.numero ?? null })

/** Feuille d'une répétition ou d'un culte (jour et heure), null s'il n'y en a pas. */
export function seanceDuJour(seances: OfflineRecord<SeanceData>[], cle: CleJour): OfflineRecord<SeanceData> | null {
  const creneau = creneauCle(cle)
  let trouvee: OfflineRecord<SeanceData> | null = null
  for (const s of seances) {
    if (s.data.type === cle.type && s.data.date === cle.date && creneauSeance(s.data) === creneau) trouvee = trouvee ? seancePrioritaire(trouvee, s) : s
  }
  return trouvee
}

/** Heures des feuilles déjà prises ce jour pour ce type (ordre croissant). */
export function heuresPrises(seances: OfflineRecord<SeanceData>[], type: CleJour["type"], date: string): string[] {
  const heures = new Set<string>()
  for (const s of seances) {
    const h = heureSeance(s.data)
    if (s.data.type === type && s.data.date === date && h) heures.add(h)
  }
  return [...heures].sort()
}

/** Feuille de présence d'un événement (par identifiant serveur ou local), null s'il n'y en a pas. */
export function seanceDeEvenement(
  seances: OfflineRecord<SeanceData>[],
  evenement: { serverId: number | null; localId: string | null }
): OfflineRecord<SeanceData> | null {
  let trouvee: OfflineRecord<SeanceData> | null = null
  for (const s of seances) {
    if (s.data.type !== "EVENEMENT") continue
    const vise =
      (evenement.serverId != null && s.data.evenementId === evenement.serverId) ||
      (evenement.localId != null && s.data.evenementLocalId === evenement.localId)
    if (vise) trouvee = trouvee ? seancePrioritaire(trouvee, s) : s
  }
  return trouvee
}

/** Totaux d'une feuille (présents, excusés, absents, effectif). */
export function totauxSeance(presences: { statut: SeanceData["presences"][number]["statut"] }[]) {
  let presents = 0
  let excuses = 0
  let absents = 0
  for (const p of presences) {
    if (p.statut === "PRESENT") presents++
    else if (p.statut === "EXCUSE") excuses++
    else absents++
  }
  return { presents, excuses, absents, effectif: presences.length }
}

/** Excuser un choriste : motif facultatif. Le contenu d'un sheet est figé : tout passe par les props. */
export function ExcuseSheet({
  nom,
  motifInitial,
  dejaExcuse,
  onConfirm,
  onRetirer,
}: {
  nom: string
  motifInitial: string | null
  dejaExcuse: boolean
  onConfirm: (motif: string | null) => void
  onRetirer: () => void
}) {
  const { closeSheet } = useSheet()
  const [motif, setMotif] = useState(motifInitial ?? "")

  return (
    <View>
      <SheetTitle>Excuser {nom}</SheetTitle>
      <Muted>L'absence sera comptée comme excusée : elle ne baisse pas son taux d'assiduité.</Muted>
      <Field label="Motif (facultatif)" multiline maxLength={200} placeholder="Ex. Malade, voyage, travail…" value={motif} onChangeText={setMotif} />
      <Button
        title="Marquer excusé"
        block
        className="mt-5"
        onPress={() => {
          onConfirm(motif.trim() || null)
          closeSheet()
        }}
      />
      {dejaExcuse ? (
        <Button
          title="Retirer l'excuse"
          variant="outline"
          block
          className="mt-2"
          onPress={() => {
            onRetirer()
            closeSheet()
          }}
        />
      ) : null}
      <Button title="Annuler" variant="ghost" block className="mt-2" onPress={closeSheet} />
    </View>
  )
}


/**
 * « Nouvel appel » : choisir la séance (répétition ou culte : jour et heure ; ou événement) avant
 * d'ouvrir la feuille. Le contenu d'un sheet est figé : l'état est local, tout le reste passe par les props.
 */
export function NouvelAppelSheet({
  evenements,
  aujourdhui,
  existe,
  heuresDejaPrises,
  onCommencer,
}: {
  /** Événements proposés (passés ou du jour), du plus récent au plus ancien. */
  evenements: { value: number; label: string }[]
  /** "AAAA-MM-JJ" du jour (heure locale). */
  aujourdhui: string
  /** Une feuille existe déjà pour cette séance (elle sera ouverte pour être complétée). */
  existe: (cle: CleAppel) => boolean
  /** Heures déjà faites ce jour pour ce type (rappel sous le champ). */
  heuresDejaPrises: (type: CleJour["type"], date: string) => string[]
  onCommencer: (cle: CleAppel) => void
}) {
  const { closeSheet } = useSheet()
  const [type, setType] = useState<CleAppel["type"]>("REPETITION")
  const [date, setDate] = useState(aujourdhui)
  const [heures, setHeures] = useState({ ...HEURE_DEFAUT })
  const [eventId, setEventId] = useState<number>(evenements[0]?.value ?? 0)

  const cle: CleAppel | null =
    type === "EVENEMENT" ? (eventId ? { type, eventId } : null) : heureValide(heures[type]) ? { type, date, heure: heures[type] } : null
  const dejaFaite = cle ? existe(cle) : false
  const faites = type === "EVENEMENT" ? [] : heuresDejaPrises(type, date)

  return (
    <View>
      <SheetTitle>Nouvel appel</SheetTitle>
      <Muted>Choisissez la séance, puis cochez les choristes présents.</Muted>
      <ChipsRow className="mb-0 mt-3">
        <Chip label="Répétition" active={type === "REPETITION"} onPress={() => setType("REPETITION")} />
        <Chip label="Culte" active={type === "CULTE"} onPress={() => setType("CULTE")} />
        <Chip label="Événement" active={type === "EVENEMENT"} onPress={() => setType("EVENEMENT")} />
      </ChipsRow>
      {type !== "EVENEMENT" ? (
        <>
          <DateField
            label={type === "CULTE" ? "Date du culte" : "Date de la répétition"}
            value={parseLocalISODate(date)}
            onChange={(d) => setDate(localISODate(d))}
            maximumDate={new Date()}
          />
          <TimeField label="Heure" value={heures[type]} onChange={(h) => setHeures((x) => ({ ...x, [type]: h }))} />
          {faites.length > 0 ? <Muted className="mt-1">{`Appel déjà fait ce jour à ${faites.map(heureFr).join(", ")}.`}</Muted> : null}
        </>
      ) : evenements.length === 0 ? (
        <Muted className="mt-3">Aucun événement passé ou du jour. Créez d'abord l'événement, puis faites l'appel.</Muted>
      ) : (
        <Select label="Événement" value={eventId} placeholder="Choisir un événement" options={evenements} onChange={setEventId} />
      )}
      {dejaFaite ? (
        <Muted className="mt-2.5">L'appel a déjà été fait pour cette séance : la feuille sera ouverte pour être complétée.</Muted>
      ) : null}
      <Button
        block
        className="mt-4"
        title={dejaFaite ? "Ouvrir la feuille" : "Commencer l'appel"}
        disabled={!cle}
        onPress={() => {
          if (!cle) return
          closeSheet()
          onCommencer(cle)
        }}
      />
      <Button block variant="ghost" title="Annuler" onPress={closeSheet} />
    </View>
  )
}
