// Écran Événements — conforme à renderEvenements() du prototype cantoria-app-mobile-v2.html.
import { CalendarDays } from "lucide-react-native"
import { useMemo, useState } from "react"
import { Text, View } from "react-native"

import { Screen } from "../../components/layout"
import { EventDetailSheet, EventFormSheet } from "../../components/sheets/EventSheets"
import { Button, Card, CardTitle, Chip, ChipsRow, EmptyState, Muted, Pagination, Pill, RowBetween, SearchBar, SectionHeader } from "../../components/ui"
import { errorMessage, useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { RecordSyncBadge } from "../../components/sync"
import { usePagination } from "../../hooks/usePagination"
import { correspondRecherche, eventBilan, fmt, formatDateLong, splitEvents } from "../../lib/format"
import type { Evenement } from "../../types"

/** Chiffres en Geist Mono imbriqués dans un texte muted (taille et couleur héritées). */
const NUM = "font-sans-medium tabular-nums"
/** Montant en gras (strong) Geist Mono, imbriqué dans un texte muted. */
const STRONG_AMOUNT = "font-sans-semibold tabular-nums"

type Periode = "tous" | "aVenir" | "passes"

export default function EvenementsScreen() {
  const { events, can, toggleInscription } = useApp()
  const { openSheet } = useSheet()
  const { toast } = useToast()
  const [recherche, setRecherche] = useState("")
  const [periode, setPeriode] = useState<Periode>("tous")
  // Type filtré (null : tous les types).
  const [typeFiltre, setTypeFiltre] = useState<string | null>(null)

  const { aVenir, passes } = useMemo(() => splitEvents(events), [events])
  /** Types réellement utilisés, pour les filtres. */
  const types = useMemo(() => [...new Set(events.map((e) => e.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [events])

  // À venir d'abord, puis les passés (du plus récent au plus ancien), comme avant les filtres.
  const visibles = useMemo(() => {
    const garde = (ev: Evenement) => (!typeFiltre || ev.type === typeFiltre) && correspondRecherche(recherche, ev.titre, ev.type, ev.description)
    return [
      ...(periode === "passes" ? [] : aVenir.filter(garde).map((ev) => ({ ev, passe: false }))),
      ...(periode === "aVenir" ? [] : passes.filter(garde).map((ev) => ({ ev, passe: true }))),
    ]
  }, [aVenir, passes, periode, typeFiltre, recherche])
  const pagination = usePagination(visibles, 20, [recherche, periode, typeFiltre])
  const filtreActif = !!recherche.trim() || periode !== "tous" || typeFiltre !== null

  /** S'inscrire ou se désinscrire depuis la carte (marche aussi hors ligne). */
  function inscription(eventId: number, inscrire: boolean) {
    toggleInscription(eventId, inscrire)
      .then(() => toast(inscrire ? "Inscription enregistrée" : "Désinscription enregistrée"))
      .catch((e) => toast(errorMessage(e)))
  }

  return (
    <Screen title="Événements">
      {can("evenements") ? <Button title="+ Créer un événement" block onPress={() => openSheet(<EventFormSheet />)} /> : null}

      {events.length > 0 ? (
        <View className="mt-3.5">
          <SearchBar value={recherche} onChangeText={setRecherche} placeholder="Rechercher un événement" autoCorrect={false} />
          <ChipsRow className="mb-2">
            <Chip label={`Tous (${aVenir.length + passes.length})`} active={periode === "tous"} onPress={() => setPeriode("tous")} />
            <Chip label={`À venir (${aVenir.length})`} active={periode === "aVenir"} onPress={() => setPeriode("aVenir")} />
            <Chip label={`Passés (${passes.length})`} active={periode === "passes"} onPress={() => setPeriode("passes")} />
          </ChipsRow>
          {types.length > 1 ? (
            <ChipsRow className="mb-0">
              <Chip label="Tous les types" active={typeFiltre === null} onPress={() => setTypeFiltre(null)} />
              {types.map((t) => (
                <Chip key={t} label={t} active={typeFiltre === t} onPress={() => setTypeFiltre(typeFiltre === t ? null : t)} />
              ))}
            </ChipsRow>
          ) : null}
        </View>
      ) : null}

      {!filtreActif && aVenir.length === 0 && passes.length > 0 ? <Muted className="mt-4">Aucun événement à venir.</Muted> : null}
      {filtreActif && visibles.length === 0 ? <EmptyState icon={CalendarDays} title="Aucun événement" subtitle="Modifiez la recherche ou les filtres." /> : null}

      {/* Événements passés en bas, du plus récent au plus ancien, atténués (titre « Passés » en tête de leur partie de page). */}
      {pagination.pageItems.map(({ ev, passe }, i) => (
        <View key={ev.localId ?? ev.id}>
          {passe && periode === "tous" && (i === 0 || !pagination.pageItems[i - 1]!.passe) ? (
            <SectionHeader title="Passés" className="mt-7" />
          ) : null}
          {carte(ev, passe)}
        </View>
      ))}
      <Pagination {...pagination} className="mt-4" />
    </Screen>
  )

  function carte(ev: Evenement, passe: boolean) {
    const bilan = eventBilan(ev)
    return (
      // « ! » : prime sur la marge basse par défaut de Card (mb-3).
      <Card
        key={ev.id}
        className={passe ? "mb-0 mt-3.5 opacity-70" : "mb-0 mt-3.5"}
        accessibilityLabel={passe ? `${ev.titre}, passé` : ev.titre}
        onPress={() => openSheet(<EventDetailSheet eventId={ev.id} />)}
      >
        <RowBetween>
          <CardTitle className="shrink">{ev.titre}</CardTitle>
          <Pill variant="gold">{ev.type}</Pill>
        </RowBetween>
        <Muted>
          <Text className={NUM}>{formatDateLong(ev.date)}</Text>
          {ev.inscriptionsOuvertes || ev.inscrit ? (
            <>
              {" · "}
              <Text className={NUM}>{ev.inscrits?.length ?? 0}</Text> inscrit{(ev.inscrits?.length ?? 0) > 1 ? "s" : ""}
              {ev.inscrit ? " · vous êtes inscrit(e)" : ""}
            </>
          ) : null}
        </Muted>
        {ev.syncStatus && ev.syncStatus !== "synced" ? (
          <View className="mt-1.5">
            <RecordSyncBadge status={ev.syncStatus} />
          </View>
        ) : null}
        {can("budget") ? (
          <View className="mt-2.5">
            <RowBetween>
              <Muted>
                Recettes <Text className={`${STRONG_AMOUNT} text-success`}>{fmt(bilan.recettes)}</Text>
              </Muted>
              <Muted>
                Dépenses <Text className={`${STRONG_AMOUNT} text-danger`}>{fmt(bilan.validees)}</Text>
              </Muted>
            </RowBetween>
          </View>
        ) : null}
        {/* Inscription directement sur la carte : pas besoin d'ouvrir le détail. */}
        {ev.inscrit || ev.inscriptionsOuvertes ? (
          <Button
            title={ev.inscrit ? "Se désinscrire" : "S'inscrire"}
            variant={ev.inscrit ? "outline" : "primary"}
            small
            className="mt-3"
            onPress={() => inscription(ev.id, !ev.inscrit)}
          />
        ) : null}
      </Card>
    )
  }
}
