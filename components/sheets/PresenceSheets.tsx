// Présences : bottom sheet « Excuser » de l'écran Faire l'appel (app/presences.tsx) et règles
// communes pour retrouver la feuille d'une séance sur le téléphone.
import { useState } from "react"
import { View } from "react-native"
import { useSheet } from "../../context/SheetContext"
import type { OfflineRecord } from "../../lib/offline"
import { NUMERO_CULTE_MAX, nomCulte } from "../../lib/api"
import { numeroSeance, type SeanceData } from "../../lib/offline/entities"
import { localISODate, parseLocalISODate } from "../../lib/format"
import { seancePrioritaire } from "../../lib/presences"
import { DateField } from "../DateField"
import { Button, Chip, ChipsRow, Field, FieldLabel, Muted, Select, SheetTitle } from "../ui"

// Choix entre deux enregistrements locaux d'une même séance : règle pure partagée (lib/presences.ts).
export { seancePrioritaire }

/**
 * Clé d'une feuille choisie à l'écran : la répétition d'un jour, un culte (jour et numéro, plusieurs
 * cultes par jour), ou un événement (sa date n'en fait pas partie).
 */
export type CleAppel = { type: "REPETITION"; date: string } | { type: "CULTE"; date: string; numero: number } | { type: "EVENEMENT"; eventId: number }

/** Numéros de culte proposés (1 à NUMERO_CULTE_MAX). */
export const NUMEROS_CULTE = Array.from({ length: NUMERO_CULTE_MAX }, (_, i) => i + 1)

/** Feuille d'une répétition (jour) ou d'un culte (jour et numéro), null s'il n'y en a pas. */
export function seanceDuJour(
  seances: OfflineRecord<SeanceData>[],
  cle: { type: "REPETITION"; date: string } | { type: "CULTE"; date: string; numero: number }
): OfflineRecord<SeanceData> | null {
  const numero = cle.type === "CULTE" ? cle.numero : null
  let trouvee: OfflineRecord<SeanceData> | null = null
  for (const s of seances) {
    if (s.data.type === cle.type && s.data.date === cle.date && numeroSeance(s.data) === numero) trouvee = trouvee ? seancePrioritaire(trouvee, s) : s
  }
  return trouvee
}

/** Premier numéro de culte du jour sans feuille (1 si tous sont pris). */
export function premierCulteLibre(date: string, existe: (cle: CleAppel) => boolean): number {
  return NUMEROS_CULTE.find((numero) => !existe({ type: "CULTE", date, numero })) ?? 1
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
 * « Nouvel appel » : choisir la séance (répétition d'un jour, culte d'un jour et son numéro, ou événement) avant d'ouvrir la
 * feuille. Le contenu d'un sheet est figé : l'état est local, tout le reste passe par les props.
 */
export function NouvelAppelSheet({
  evenements,
  aujourdhui,
  existe,
  onCommencer,
}: {
  /** Événements proposés (passés ou du jour), du plus récent au plus ancien. */
  evenements: { value: number; label: string }[]
  /** "AAAA-MM-JJ" du jour (heure locale). */
  aujourdhui: string
  /** Une feuille existe déjà pour cette séance (elle sera ouverte pour être complétée). */
  existe: (cle: CleAppel) => boolean
  onCommencer: (cle: CleAppel) => void
}) {
  const { closeSheet } = useSheet()
  const [type, setType] = useState<CleAppel["type"]>("REPETITION")
  const [date, setDate] = useState(aujourdhui)
  // Culte : par défaut, le premier numéro du jour dont l'appel n'est pas encore fait.
  const [numero, setNumero] = useState(() => premierCulteLibre(aujourdhui, existe))
  const [eventId, setEventId] = useState<number>(evenements[0]?.value ?? 0)

  const cle: CleAppel | null =
    type === "REPETITION" ? { type, date } : type === "CULTE" ? { type, date, numero } : eventId ? { type, eventId } : null
  const dejaFaite = cle ? existe(cle) : false
  const cultesFaits = type === "CULTE" ? NUMEROS_CULTE.filter((n) => existe({ type: "CULTE", date, numero: n })) : []

  const changerDate = (jour: string) => {
    setDate(jour)
    setNumero(premierCulteLibre(jour, existe))
  }

  return (
    <View>
      <SheetTitle>Nouvel appel</SheetTitle>
      <Muted>Choisissez la séance, puis cochez les choristes présents.</Muted>
      <ChipsRow className="mb-0 mt-3">
        <Chip label="Répétition" active={type === "REPETITION"} onPress={() => setType("REPETITION")} />
        <Chip label="Culte" active={type === "CULTE"} onPress={() => setType("CULTE")} />
        <Chip label="Événement" active={type === "EVENEMENT"} onPress={() => setType("EVENEMENT")} />
      </ChipsRow>
      {type === "REPETITION" ? (
        <DateField
          label="Date de la répétition"
          value={parseLocalISODate(date)}
          onChange={(d) => changerDate(localISODate(d))}
          maximumDate={new Date()}
        />
      ) : type === "CULTE" ? (
        <>
          <DateField label="Date du culte" value={parseLocalISODate(date)} onChange={(d) => changerDate(localISODate(d))} maximumDate={new Date()} />
          <ChoixCulte numero={numero} onChange={setNumero} />
          {cultesFaits.length > 0 ? (
            <Muted className="mt-1">{`Appel déjà fait ce jour : ${cultesFaits.map(nomCulte).join(", ")}.`}</Muted>
          ) : null}
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

/** Choix du culte du jour : « 1er culte · 2e culte · … » (plusieurs cultes par jour). */
export function ChoixCulte({ numero, onChange }: { numero: number; onChange: (numero: number) => void }) {
  return (
    <View>
      <FieldLabel>Culte</FieldLabel>
      <ChipsRow className="mb-0">
        {NUMEROS_CULTE.map((n) => (
          <Chip key={n} label={nomCulte(n)} active={numero === n} onPress={() => n !== numero && onChange(n)} />
        ))}
      </ChipsRow>
    </View>
  )
}
