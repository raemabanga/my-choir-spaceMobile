// Assiduité : résumé (taux, catégorie, totaux) partagé par « Mon assiduité » (Profil) et la section
// « Présences » du détail d'un compte, calculée sur le téléphone (marche hors ligne).
import { useMemo, useState } from "react"
import { Text, View } from "react-native"
import { useOfflineCollection } from "../hooks/offline"
import { LIBELLE_TYPE_SEANCE, type CategorieAssiduite, type StatutPresence, type TypeSeance } from "../lib/api"
import { addDaysISO, formatDateShort, todayLocalISO } from "../lib/format"
import { seanceRepository } from "../lib/offline/entities"
import { assiduiteMembre, feuillesUniques, type ResumeAssiduite } from "../lib/presences"
import { Button, Card, ListRow, Muted, Numeric, Pill, ProgressBar, RowBetween, type PillVariant } from "./ui"

/** Pastille de la catégorie d'assiduité (seuils de l'API : 75 % et 40 %). */
export const CATEGORIE_ASSIDUITE: Record<CategorieAssiduite, { label: string; variant: PillVariant }> = {
  ASSIDU: { label: "Assidu", variant: "green" },
  IRREGULIER: { label: "Irrégulier", variant: "pending" },
  DECROCHEUR: { label: "Décrocheur", variant: "burg" },
}

export const STATUT_PRESENCE: Record<StatutPresence, { label: string; variant: PillVariant }> = {
  PRESENT: { label: "Présent", variant: "green" },
  EXCUSE: { label: "Excusé", variant: "pending" },
  ABSENT: { label: "Absent", variant: "burg" },
}

/** Grand taux, pastille de catégorie, barre de progression et totaux. */
export function ResumeAssiduiteBloc({
  resume,
  categorie,
  suffixe = "",
}: {
  resume: ResumeAssiduite
  categorie: CategorieAssiduite | null
  /** Ajouté après les totaux (ex. « (12 derniers mois) »). */
  suffixe?: string
}) {
  return (
    <>
      <RowBetween>
        <Numeric className="font-sans-semibold text-[28px] tracking-[-0.5px]">{resume.taux != null ? `${resume.taux} %` : "—"}</Numeric>
        {categorie ? <Pill variant={CATEGORIE_ASSIDUITE[categorie].variant}>{CATEGORIE_ASSIDUITE[categorie].label}</Pill> : null}
      </RowBetween>
      <ProgressBar percent={resume.taux ?? 0} />
      <Muted className="mt-1">
        {`${resume.presents} présences · ${resume.excuses} excusées · ${resume.absents} absences sur ${resume.attendues} séances${suffixe}`}
      </Muted>
    </>
  )
}

const TYPES: { type: TypeSeance; label: string }[] = [
  { type: "REPETITION", label: "Répétitions" },
  { type: "CULTE", label: "Cultes" },
  { type: "EVENEMENT", label: "Événements" },
]

/** Séances affichées d'abord, puis à chaque « Voir plus ». */
const PAGE = 10

/**
 * Présences d'un choriste (identifiant d'adhésion) sur les 12 derniers mois, calculées à partir des
 * feuilles enregistrées sur le téléphone : mêmes formules que l'API.
 */
export function PresencesMembre({ membreId }: { membreId: number }) {
  const { items: seances } = useOfflineCollection(seanceRepository)
  const [visibles, setVisibles] = useState(PAGE)
  const assiduite = useMemo(
    () => assiduiteMembre(feuillesUniques(seances), membreId, addDaysISO(todayLocalISO(), -365)),
    [seances, membreId]
  )

  if (assiduite.attendues === 0) {
    return (
      <Card>
        <Muted>Aucune séance enregistrée pour ce choriste.</Muted>
      </Card>
    )
  }

  const liste = assiduite.seances.slice(0, visibles)
  return (
    <Card>
      <ResumeAssiduiteBloc resume={assiduite} categorie={assiduite.categorie} />

      <View className="mt-3 flex-row gap-2">
        {TYPES.map(({ type, label }) => {
          const r = assiduite.parType[type]
          return (
            <View key={type} className="flex-1 rounded-lg border border-line-soft px-2.5 py-2">
              <Muted className="text-[11.5px]">{label}</Muted>
              <Numeric className="mt-0.5 font-sans-semibold text-[15px]">{`${r.presents}/${r.attendues}`}</Numeric>
              <Text className="font-sans text-[11.5px] tabular-nums text-ink-light">{r.taux != null ? `${r.taux} %` : "—"}</Text>
            </View>
          )
        })}
      </View>

      <View className="mt-2">
        {liste.map((s, i) => (
          <ListRow
            key={s.localId}
            last={i === liste.length - 1}
            title={s.libelle}
            subtitle={`${LIBELLE_TYPE_SEANCE[s.type] ?? "Séance"} · ${formatDateShort(s.date)}${s.motif ? ` · ${s.motif}` : ""}`}
            right={<Pill variant={STATUT_PRESENCE[s.statut].variant}>{STATUT_PRESENCE[s.statut].label}</Pill>}
          />
        ))}
      </View>
      {assiduite.seances.length > visibles ? (
        <Button
          title={`Voir plus (${assiduite.seances.length - visibles})`}
          variant="ghost"
          small
          block
          className="mt-1"
          onPress={() => setVisibles((n) => n + PAGE)}
        />
      ) : null}
    </Card>
  )
}
