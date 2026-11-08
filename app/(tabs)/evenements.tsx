// Écran Événements — conforme à renderEvenements() du prototype cantoria-app-mobile-v2.html.
import { Text, View } from "react-native"

import { Screen } from "../../components/layout"
import { EventDetailSheet, EventFormSheet } from "../../components/sheets/EventSheets"
import { Button, Card, CardTitle, Muted, Pill, RowBetween } from "../../components/ui"
import { errorMessage, useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { useToast } from "../../context/ToastContext"
import { RecordSyncBadge } from "../../components/sync"
import { eventBilan, fmt, formatDateLong } from "../../lib/format"

/** Chiffres en Geist Mono imbriqués dans un texte muted (taille et couleur héritées). */
const NUM = "font-sans-medium tabular-nums"
/** Montant en gras (strong) Geist Mono, imbriqué dans un texte muted. */
const STRONG_AMOUNT = "font-sans-semibold tabular-nums"

export default function EvenementsScreen() {
  const { events, can, toggleInscription } = useApp()
  const { openSheet } = useSheet()
  const { toast } = useToast()

  /** S'inscrire ou se désinscrire depuis la carte (marche aussi hors ligne). */
  function inscription(eventId: number, inscrire: boolean) {
    toggleInscription(eventId, inscrire)
      .then(() => toast(inscrire ? "Inscription enregistrée" : "Désinscription enregistrée"))
      .catch((e) => toast(errorMessage(e)))
  }

  return (
    <Screen title="Événements">
      {can("evenements") ? <Button title="+ Créer un événement" block onPress={() => openSheet(<EventFormSheet />)} /> : null}

      {events.map((ev) => {
        const bilan = eventBilan(ev)
        return (
          // « ! » : prime sur la marge basse par défaut de Card (mb-3).
          <Card key={ev.id} className="mb-0 mt-3.5" accessibilityLabel={ev.titre} onPress={() => openSheet(<EventDetailSheet eventId={ev.id} />)}>
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
      })}
    </Screen>
  )
}
