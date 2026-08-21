import DateTimePicker from "@react-native-community/datetimepicker"
import { useState } from "react"
import { Platform, Pressable, Text, View } from "react-native"
import { colors } from "../constants/theme"
import { FieldLabel } from "./ui"

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
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: "rgba(46,27,51,0.15)",
            backgroundColor: colors.white,
            alignItems: "flex-start",
            paddingLeft: 6,
          }}
        >
          <DateTimePicker
            value={value}
            mode="date"
            display="compact"
            onChange={(_, date) => date && onChange(date)}
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
        style={{
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: "rgba(46,27,51,0.15)",
          backgroundColor: colors.white,
          paddingVertical: 11,
          paddingHorizontal: 13,
        }}
      >
        <Text style={{ fontSize: 13.5, color: colors.ink }}>{formatted}</Text>
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
