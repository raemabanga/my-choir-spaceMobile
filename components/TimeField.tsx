import DateTimePicker from "@react-native-community/datetimepicker"
import { useState } from "react"
import { Platform, Pressable, Text, View } from "react-native"
import { heureFr } from "../lib/api"
import { fieldBoxClasses, FieldLabel } from "./ui"

const pad = (n: number) => String(n).padStart(2, "0")

/** "HH:MM" → Date du jour à cette heure (le sélecteur natif travaille sur des Date). */
function versDate(heure: string | null) {
  const d = new Date()
  const [h, m] = (heure ?? "09:00").split(":").map(Number)
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

const versHeure = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/**
 * Heure d'une répétition ou d'un culte ("HH:MM"), même présentation que DateField.
 * `value` null : ancienne feuille sans heure (« Non précisée »).
 */
export function TimeField({ label, value, onChange }: { label: string; value: string | null; onChange: (heure: string) => void }) {
  const [show, setShow] = useState(false)
  const affichee = value ? heureFr(value) : "Non précisée"

  if (Platform.OS === "ios") {
    return (
      <View>
        <FieldLabel>{label}</FieldLabel>
        <View className={`${fieldBoxClasses(false)} items-start pl-1.5`}>
          <DateTimePicker
            value={versDate(value)}
            mode="time"
            display="compact"
            locale="fr-FR"
            minuteInterval={5}
            onChange={(_, date) => date && onChange(versHeure(date))}
            themeVariant="light"
          />
        </View>
      </View>
    )
  }

  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        onPress={() => setShow(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${affichee}`}
        className={`${fieldBoxClasses(false)} min-h-touch justify-center px-[13px]`}
      >
        <Text className={`font-sans text-[13.5px] ${value ? "text-ink" : "text-ink-light"}`}>{affichee}</Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={versDate(value)}
          mode="time"
          display="default"
          is24Hour
          onChange={(event, date) => {
            setShow(false)
            if (event.type === "set" && date) onChange(versHeure(date))
          }}
        />
      ) : null}
    </View>
  )
}
