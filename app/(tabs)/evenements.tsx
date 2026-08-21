import { ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AppHeader } from "../../components/AppHeader"
import { EventDetailSheet, EventFormSheet } from "../../components/sheets/EventSheets"
import { Button, Card, CardTitle, Muted, Pill, RowBetween } from "../../components/ui"
import { colors } from "../../constants/theme"
import { useApp } from "../../context/AppContext"
import { useSheet } from "../../context/SheetContext"
import { fmt, formatDateLong } from "../../lib/format"

export default function EvenementsScreen() {
  const { events, can } = useApp()
  const { openSheet } = useSheet()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["top"]}>
      <AppHeader title="Événements" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 100 }}>
        {can("createEvent") ? (
          <Button title="+ Créer un événement" block onPress={() => openSheet(<EventFormSheet />)} />
        ) : null}

        {events.map((ev) => {
          const rec = Object.values(ev.contributions).reduce((a, b) => a + b, 0)
          const dep = ev.depenses.filter((d) => d.valide).reduce((a, b) => a + b.montant, 0)
          return (
            <Card key={ev.id} onPress={() => openSheet(<EventDetailSheet eventId={ev.id} />)} style={{ marginTop: 14 }}>
              <RowBetween>
                <CardTitle>{ev.titre}</CardTitle>
                <Pill variant="gold">{ev.type}</Pill>
              </RowBetween>
              <Muted>
                {formatDateLong(ev.date)} · {ev.inscrits.length} inscrit(s)
              </Muted>
              {can("viewBudget") ? (
                <RowBetween style={{ marginTop: 10 }}>
                  <Muted>
                    Recettes <Muted style={{ color: colors.green }}>{fmt(rec)}</Muted>
                  </Muted>
                  <Muted>
                    Dépenses <Muted style={{ color: colors.burgundy }}>{fmt(dep)}</Muted>
                  </Muted>
                </RowBetween>
              ) : null}
            </Card>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
