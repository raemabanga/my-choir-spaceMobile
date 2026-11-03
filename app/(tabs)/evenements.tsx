// Écran Événements — conforme à renderEvenements() du prototype cantoria-app-mobile-v2.html.
import { Text, View } from "react-native"

import { Screen } from "../../components/layout"
import { EventDetailSheet, EventFormSheet } from "../../components/sheets/EventSheets"
import { Button, Card, CardTitle, Muted, Pill, RowBetween } from "../../components/ui"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { eventBilan, fmt, formatDateLong } from "../../lib/format"

/** Chiffres en Geist Mono imbriqués dans un texte muted (taille et couleur héritées). */
const NUM = "font-mono-medium tabular-nums"
/** Montant en gras (strong) Geist Mono, imbriqué dans un texte muted. */
const STRONG_AMOUNT = "font-mono-semibold tabular-nums"

export default function EvenementsScreen() {
  const { events, can } = useApp()
  const { openSheet } = useSheet()

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
              {" · "}
              <Text className={NUM}>{ev.inscrits.length}</Text> inscrit(s)
            </Muted>
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
          </Card>
        )
      })}
    </Screen>
  )
}
