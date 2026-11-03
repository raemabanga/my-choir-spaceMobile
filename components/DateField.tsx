import DateTimePicker from "@react-native-community/datetimepicker"
import { useState } from "react"
import { Platform, Pressable, Text, View } from "react-native"
import { fieldBoxClasses, FieldLabel } from "./ui"

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: Date
  onChange: (date: Date) => void
}) {
  const [show, setShow] = useState(false)

  const formatted = value.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })

  if (Platform.OS === "ios") {
    return (
      <View>
        <FieldLabel>{label}</FieldLabel>
        <View className={`${fieldBoxClasses(false)} items-start pl-1.5`}>
          <DateTimePicker value={value} mode="date" display="compact" onChange={(_, date) => date && onChange(date)} themeVariant="light" />
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
        accessibilityLabel={`${label} : ${formatted}`}
        className={`${fieldBoxClasses(false)} min-h-touch justify-center px-[13px]`}
      >
        <Text className="font-sans text-[13.5px] text-ink">{formatted}</Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          onChange={(_, date) => {
            setShow(false)
            if (date) onChange(date)
          }}
        />
      ) : null}
    </View>
  )
}
