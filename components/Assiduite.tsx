// Assiduité : résumé (taux, catégorie, totaux) partagé par « Mon assiduité » (Profil) et la section
// « Présences » du détail d'un compte, calculée sur le téléphone (marche hors ligne).
import { router } from "expo-router"
import { useMemo, useState } from "react"
import { Text, View } from "react-native"
import { useApp } from "../context/AppContext"
import { useSheet } from "../context/SheetContext"
import { useOfflineCollection } from "../hooks/offline"
import { usePagination } from "../hooks/usePagination"
import { LIBELLE_TYPE_SEANCE, type CategorieAssiduite, type StatutPresence, type TypeSeance } from "../lib/api"
import { addDaysISO, formatDateShort, todayLocalISO } from "../lib/format"
import { heureSeance, numeroSeance, seanceRepository } from "../lib/offline/entities"
import { assiduiteMembre, feuillesUniques, type ResumeAssiduite } from "../lib/presences"
import { Card, Chip, ChipsRow, ListRow, Muted, Numeric, Pagination, Pill, ProgressBar, RowBetween, type PillVariant } from "./ui"

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

/** Séances par page dans le détail d'un choriste. */
const PAGE = 20

/**
 * Présences d'un choriste (identifiant d'adhésion) sur les 12 derniers mois, calculées à partir des
 * feuilles enregistrées sur le téléphone : mêmes formules que l'API.
 */
export function PresencesMembre({ membreId }: { membreId: number }) {
  const { items: seances } = useOfflineCollection(seanceRepository)
  const { can, events } = useApp()
  const { closeSheet } = useSheet()
  // Filtre par statut (null : toutes les séances).
  const [statut, setStatut] = useState<StatutPresence | null>(null)
  const assiduite = useMemo(
    () => assiduiteMembre(feuillesUniques(seances), membreId, addDaysISO(todayLocalISO(), -365)),
    [seances, membreId]
  )
  const filtrees = useMemo(() => (statut ? assiduite.seances.filter((s) => s.statut === statut) : assiduite.seances), [assiduite, statut])
  const pagination = usePagination(filtrees, PAGE, [statut, membreId])

  if (assiduite.attendues === 0) {
    return (
      <Card>
        <Muted>Aucune séance enregistrée pour ce choriste.</Muted>
      </Card>
    )
  }

  const liste = pagination.pageItems

  /** Ouvre la feuille d'appel de la séance (écran Présences), pour qui peut faire l'appel. */
  const ouvrirSeance = (localId: string) => {
    const f = seances.find((s) => s.localId === localId)?.data
    if (!f) return
    let params: Record<string, string>
    if (f.type === "EVENEMENT") {
      const ev = events.find((e) => (f.evenementId != null && e.id === f.evenementId) || (!!f.evenementLocalId && e.localId === f.evenementLocalId))
      if (!ev) return
      params = { vue: "appel", type: "evenement", evenementId: String(ev.id) }
    } else {
      params = { vue: "appel", type: f.type === "CULTE" ? "culte" : "repetition", date: f.date }
      const heure = heureSeance(f)
      // Ancienne feuille sans heure : un culte se retrouve par son numéro.
      if (heure) params.heure = heure
      else Object.assign(params, { ancienne: "1", numero: String(numeroSeance(f) ?? 1) })
    }
    closeSheet()
    router.push({ pathname: "/presences", params })
  }
  const peutOuvrir = can("presences")
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

      <ChipsRow className="mb-0 mt-3">
        <Chip label={`Toutes (${assiduite.seances.length})`} active={statut === null} onPress={() => setStatut(null)} />
        {(Object.keys(STATUT_PRESENCE) as StatutPresence[]).map((st) => (
          <Chip
            key={st}
            label={`${STATUT_PRESENCE[st].label}s (${assiduite.seances.filter((s) => s.statut === st).length})`}
            active={statut === st}
            onPress={() => setStatut(statut === st ? null : st)}
          />
        ))}
      </ChipsRow>

      <View className="mt-2">
        {liste.map((s, i) => (
          <ListRow
            key={s.localId}
            last={i === liste.length - 1}
            title={s.libelle}
            subtitle={`${LIBELLE_TYPE_SEANCE[s.type] ?? "Séance"} · ${formatDateShort(s.date)}${s.motif ? ` · ${s.motif}` : ""}`}
            right={<Pill variant={STATUT_PRESENCE[s.statut].variant}>{STATUT_PRESENCE[s.statut].label}</Pill>}
            onPress={peutOuvrir ? () => ouvrirSeance(s.localId) : undefined}
            accessibilityLabel={peutOuvrir ? `${s.libelle}, ${formatDateShort(s.date)}, ${STATUT_PRESENCE[s.statut].label}. Ouvrir la feuille d'appel` : undefined}
          />
        ))}
      </View>
      {liste.length === 0 ? <Muted className="mt-1">Aucune séance avec ce statut.</Muted> : null}
      <Pagination {...pagination} className="mb-0 mt-2" />
    </Card>
  )
}
