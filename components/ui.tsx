import { Picker } from "@react-native-picker/picker"
import { LinearGradient } from "expo-linear-gradient"
import React from "react"
import {
  Pressable,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewProps,
} from "react-native"
import { colors } from "../constants/theme"

/* ----------------------------- Section header ---------------------------- */

export function SectionHeader({ title, style }: { title: string; style?: ViewProps["style"] }) {
  return (
    <View className="flex-row items-center gap-2 mt-6 mb-2.5" style={style}>
      <Text className="font-serif text-[15px] text-aubergine">{title}</Text>
      <View className="flex-1 h-px bg-aubergine/20" />
    </View>
  )
}

/* --------------------------------- Card ---------------------------------- */

export function Card({
  tint,
  children,
  onPress,
  style,
}: {
  tint?: boolean
  children: React.ReactNode
  onPress?: () => void
  style?: ViewProps["style"]
}) {
  const Wrapper: any = onPress ? Pressable : View
  if (tint) {
    return (
      <Wrapper onPress={onPress} style={style}>
        <LinearGradient
          colors={[colors.aubergine, colors.aubergine2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 18, padding: 16, marginBottom: 12 }}
        >
          {children}
        </LinearGradient>
      </Wrapper>
    )
  }
  return (
    <Wrapper
      onPress={onPress}
      className="bg-white border border-aubergine/10 rounded-[18px] p-4 mb-3"
      style={[{ shadowColor: colors.aubergine, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, style]}
    >
      {children}
    </Wrapper>
  )
}

export function CardTitle({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <Text className={`font-serif text-base mb-1 ${light ? "text-white" : "text-ink"}`}>
      {children}
    </Text>
  )
}

export function Muted({ children, light, style }: { children: React.ReactNode; light?: boolean; style?: TextProps["style"] }) {
  return (
    <Text className={`text-[12.5px] ${light ? "text-goldSoft/70" : "text-muted"}`} style={style}>
      {children}
    </Text>
  )
}

export function RowBetween({ children, style }: { children: React.ReactNode; style?: ViewProps["style"] }) {
  return (
    <View className="flex-row items-center justify-between" style={style}>
      {children}
    </View>
  )
}

/* --------------------------------- Pill ----------------------------------- */

type PillVariant = "default" | "gold" | "burg" | "green" | "pending"

const pillStyles: Record<PillVariant, { bg: string; text: string }> = {
  default: { bg: colors.paper2, text: colors.aubergine2 },
  gold: { bg: colors.goldSoft, text: "#6b551d" },
  burg: { bg: "#f1dbdd", text: colors.burgundy },
  green: { bg: "#dcebe1", text: colors.green },
  pending: { bg: "#fbe6cf", text: "#9a5b1c" },
}

export function Pill({ children, variant = "default" }: { children: React.ReactNode; variant?: PillVariant }) {
  const s = pillStyles[variant]
  return (
    <View
      style={{ backgroundColor: s.bg, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 100, alignSelf: "flex-start" }}
    >
      <Text style={{ color: s.text, fontFamily: "Inter_700Bold", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {children}
      </Text>
    </View>
  )
}

/* -------------------------------- Button ----------------------------------- */

type ButtonVariant = "primary" | "gold" | "outline" | "ghost" | "danger"

const buttonStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: colors.aubergine, text: colors.goldSoft },
  gold: { bg: colors.gold, text: colors.aubergine },
  outline: { bg: "transparent", text: colors.aubergine, border: colors.aubergine },
  ghost: { bg: "rgba(46,27,51,0.06)", text: colors.aubergine },
  danger: { bg: "#f1dbdd", text: colors.danger },
}

export function Button({
  title,
  onPress,
  variant = "primary",
  block,
  small,
  disabled,
  style,
}: {
  title: string
  onPress?: () => void
  variant?: ButtonVariant
  block?: boolean
  small?: boolean
  disabled?: boolean
  style?: ViewProps["style"]
}) {
  const s = buttonStyles[variant]
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: s.bg,
          borderRadius: 100,
          paddingVertical: small ? 8 : 12,
          paddingHorizontal: small ? 14 : 18,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: s.border ? 1.5 : 0,
          borderColor: s.border,
          width: block ? "100%" : undefined,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          marginBottom: 8,
        },
        style,
      ]}
    >
      <Text style={{ color: s.text, fontFamily: "Inter_700Bold", fontSize: small ? 11.5 : 13 }}>{title}</Text>
    </Pressable>
  )
}

/* -------------------------------- Progress ---------------------------------- */

export function ProgressBar({ percent, light }: { percent: number; light?: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <View
      style={{
        height: 8,
        borderRadius: 100,
        backgroundColor: light ? "rgba(255,255,255,0.15)" : "rgba(46,27,51,0.08)",
        overflow: "hidden",
        marginVertical: 6,
      }}
    >
      <View style={{ width: `${clamped}%`, height: "100%", backgroundColor: colors.gold, borderRadius: 100 }} />
    </View>
  )
}

/* ---------------------------------- Chip ------------------------------------ */

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 100,
        backgroundColor: active ? colors.aubergine : colors.white,
        borderWidth: 1.3,
        borderColor: active ? colors.aubergine : "rgba(46,27,51,0.15)",
        marginRight: 7,
        marginBottom: 7,
      }}
    >
      <Text style={{ color: active ? colors.goldSoft : colors.aubergine2, fontFamily: "Inter_500Medium", fontSize: 11.5 }}>
        {label}
      </Text>
    </Pressable>
  )
}

/* --------------------------------- Avatar ------------------------------------ */

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2)
}

export function Avatar({ name, color, size = 38 }: { name: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontFamily: "Fraunces_600SemiBold", fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  )
}

/* -------------------------------- List row ------------------------------------ */

export function ListRow({
  left,
  title,
  subtitle,
  right,
  onPress,
  last,
}: {
  left?: React.ReactNode
  title: string
  subtitle?: string
  right?: React.ReactNode
  onPress?: () => void
  last?: boolean
}) {
  const Wrapper: any = onPress ? Pressable : View
  return (
    <Wrapper
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "rgba(46,27,51,0.07)",
      }}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13.5, color: colors.ink, fontFamily: "Inter_500Medium" }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 1 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Wrapper>
  )
}

/* -------------------------------- Empty state ---------------------------------- */

export function EmptyState({ icon, title, subtitle }: { icon?: string; title: string; subtitle: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 12 }}>
      {icon ? <Text style={{ fontSize: 30, marginBottom: 8 }}>{icon}</Text> : null}
      <Text style={{ fontFamily: "Fraunces_600SemiBold", fontSize: 15, color: colors.aubergine, marginBottom: 4 }}>
        {title}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center" }}>{subtitle}</Text>
    </View>
  )
}

/* --------------------------------- Search bar ----------------------------------- */

export function SearchBar(props: TextInputProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: colors.white,
        borderWidth: 1.5,
        borderColor: "rgba(46,27,51,0.12)",
        borderRadius: 100,
        paddingHorizontal: 14,
        paddingVertical: 9,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: colors.muted }}>⌕</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={{ flex: 1, fontSize: 13, color: colors.ink, padding: 0 }}
        {...props}
      />
    </View>
  )
}

/* ----------------------------------- Field --------------------------------------- */

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 11.5,
        fontFamily: "Inter_700Bold",
        color: colors.aubergine2,
        marginTop: 12,
        marginBottom: 6,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </Text>
  )
}

/* ---------------------------------- Select ---------------------------------------- */

export function Select<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { label: string; value: T }[]
}) {
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <View
        style={{
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: "rgba(46,27,51,0.15)",
          backgroundColor: colors.white,
          overflow: "hidden",
        }}
      >
        <Picker
          selectedValue={value}
          onValueChange={(v) => onChange(v as T)}
          style={{ color: colors.ink }}
          dropdownIconColor={colors.aubergine}
        >
          {options.map((opt) => (
            <Picker.Item key={String(opt.value)} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </View>
    </View>
  )
}

/* ---------------------------------- Seal ------------------------------------------ */

export function Seal({
  month,
  paid,
  clickable,
  onPress,
}: {
  month: string
  paid: boolean
  clickable?: boolean
  onPress?: () => void
}) {
  const Wrapper: any = clickable ? Pressable : View
  return (
    <Wrapper
      onPress={clickable ? onPress : undefined}
      style={({ pressed }: any) => [
        {
          aspectRatio: 1,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: paid ? 2 : 2,
          borderStyle: paid ? "solid" : "dashed",
          borderColor: paid ? colors.gold : "rgba(46,27,51,0.25)",
          backgroundColor: paid ? "#fff6e0" : "transparent",
          transform: [{ rotate: paid ? "-3deg" : "0deg" }, { scale: clickable && pressed ? 0.93 : 1 }],
        },
      ]}
    >
      <Text style={{ fontFamily: "SpaceMono_400Regular", fontSize: 9, letterSpacing: 0.5, color: paid ? "#6b551d" : colors.muted, fontWeight: paid ? "700" : "400" }}>
        {month}
      </Text>
      {paid ? (
        <Text style={{ fontFamily: "Fraunces_500Medium_Italic", fontSize: 10, color: colors.green, marginTop: 1 }}>
          ✓ payé
        </Text>
      ) : null}
    </Wrapper>
  )
}

export function Field(props: TextInputProps & { label: string; multiline?: boolean }) {
  const { label, multiline, style, ...rest } = props
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[
          {
            width: "100%",
            paddingVertical: 11,
            paddingHorizontal: 13,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: "rgba(46,27,51,0.15)",
            fontSize: 13.5,
            backgroundColor: colors.white,
            color: colors.ink,
            textAlignVertical: multiline ? "top" : "center",
            minHeight: multiline ? 90 : undefined,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  )
}
