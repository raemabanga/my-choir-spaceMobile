// Composants partagés, calqués sur les classes CSS du prototype cantoria-app-mobile-v2.html
// (.card, .pill, .btn, .progress, .seal, .chip, .avatar, .listrow, .empty, .searchbar, champs, .qr…).
// Style en classes NativeWind (tailwind.config.js) ; `style` n'est utilisé que pour les ombres,
// les valeurs calculées et les props des composants tiers.

import { Picker } from "@react-native-picker/picker"
import { LinearGradient } from "expo-linear-gradient"
import { Search, type LucideIcon } from "lucide-react-native"
import React, { useState } from "react"
import { Pressable, Text, TextInput, TextInputProps, TextProps, View, ViewProps } from "react-native"
import Svg, { Rect } from "react-native-svg"
import palette from "../constants/palette"
import { avatarClasses, colors, fonts, MIN_TOUCH, shadows } from "../constants/theme"

/* ------------------------------ Fusion de classes (cx) ------------------------------ */

// NativeWind 4 ne résout pas les classes contradictoires selon leur ordre dans `className`
// (c'est l'ordre des règles CSS générées qui décide). `cx` fusionne donc les classes :
// quand une classe ajoutée plus loin touche la même propriété qu'une classe précédente
// (ex. `text-ink` puis `text-success`, `mt-[22px]` puis `mt-3`), seule la dernière est gardée.

const COLOR_NAMES = new Set([...Object.keys(palette), "transparent", "white", "black"])
const isColor = (v: string) => COLOR_NAMES.has(v) || /^\[(#|rgba?\()/.test(v)

/** Groupe de propriété d'une classe (variante incluse, ex. "active:scale"), ou null si inconnu. */
function classGroup(cls: string): string | null {
  const raw = cls.replace(/^!/, "")
  const i = raw.lastIndexOf(":")
  const variant = i >= 0 ? raw.slice(0, i + 1) : ""
  const u = i >= 0 ? raw.slice(i + 1) : raw
  let m: RegExpMatchArray | null
  if ((m = u.match(/^(-?)(m|p)([trblxyse]?)-/))) return variant + m[2] + m[3]
  if ((m = u.match(/^text-(.+)$/))) return variant + (isColor(m[1]!) ? "text-color" : /^(left|center|right|justify)$/.test(m[1]!) ? "text-align" : "text-size")
  if ((m = u.match(/^(bg|border)-(.+)$/)) && isColor(m[2]!)) return variant + m[1] + "-color"
  if (/^font-(sans|mono)/.test(u)) return variant + "font-family"
  if ((m = u.match(/^(tracking|leading|rounded|opacity|scale|gap|self|items|justify|shrink|grow|basis|aspect|z|order)(-|$)/))) return variant + m[1]
  if ((m = u.match(/^(min-h|min-w|max-h|max-w|h|w)-/))) return variant + m[1]
  if (/^border(-[0-9[]|$)/.test(u)) return variant + "border-width"
  return null
}

/** Concatène des classes en ignorant les valeurs vides ; la dernière classe d'un même groupe l'emporte. */
export function cx(...classes: (string | false | null | undefined)[]) {
  const tokens = classes.filter(Boolean).join(" ").split(/\s+/).filter(Boolean)
  const lastIndex = new Map<string, number>()
  tokens.forEach((t, idx) => {
    const g = classGroup(t)
    if (g) lastIndex.set(g, idx)
  })
  return tokens
    .filter((t, idx) => {
      const g = classGroup(t)
      return !g || lastIndex.get(g) === idx
    })
    .join(" ")
}

/* ------------------------------ Pressable avec effet d'appui ------------------------------ */

/**
 * Pressable qui rétrécit légèrement pendant l'appui (« pressed scale » du prototype).
 * L'échelle passe par `style` et non par une classe `active:scale-[…]` : sous NativeWind (iOS/Android),
 * les classes de transformation reposent sur des variables CSS ajoutées après le premier rendu,
 * ce qui déclenche un avertissement d'« upgrade » qui plante avec expo-router
 * (« Couldn't find a LinkingContext context »).
 */
export function PressableScale({
  scale = 0.97,
  style,
  onPressIn,
  onPressOut,
  ...props
}: React.ComponentProps<typeof Pressable> & { scale?: number; style?: ViewProps["style"] }) {
  const [pressed, setPressed] = useState(false)
  return (
    <Pressable
      {...props}
      onPressIn={(e) => {
        setPressed(true)
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        setPressed(false)
        onPressOut?.(e)
      }}
      style={[style, pressed ? { transform: [{ scale }] } : null]}
    />
  )
}

/* ------------------------------ Titre de section (h2.section) ------------------------------ */

export function SectionHeader({ title, className }: { title: string; className?: string }) {
  return (
    <View className={cx("mb-2.5 mt-[22px] flex-row items-center gap-2", className)}>
      <Text accessibilityRole="header" className="font-sans-semibold text-[12px] uppercase tracking-[0.6px] text-ink-light">
        {title}
      </Text>
      <LinearGradient colors={[colors.ruleStart, colors.ruleEnd]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1, height: 1 }} />
    </View>
  )
}

/** Titre d'un bottom sheet (.sheet h2). */
export function SheetTitle({ children }: { children: React.ReactNode }) {
  return <Text className="mb-1 font-sans-semibold text-[19px] tracking-[-0.2px] text-navy">{children}</Text>
}

/* ------------------------------------- Carte (.card) ------------------------------------- */

export function Card({
  tint,
  children,
  onPress,
  className,
  style,
  accessibilityLabel,
}: {
  /** Carte d'en-tête sombre (fond navy, texte clair). */
  tint?: boolean
  children: React.ReactNode
  onPress?: () => void
  className?: string
  style?: ViewProps["style"]
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      className={cx("mb-3 rounded-card p-4 active:opacity-90", tint ? "bg-navy" : "border border-line bg-paper", className)}
      style={[shadows.card, style]}
    >
      {children}
    </Pressable>
  )
}

/** Titre de carte (.card h3). */
export function CardTitle({ children, light, className }: { children: React.ReactNode; light?: boolean; className?: string }) {
  return <Text className={cx("mb-1 font-sans-semibold text-[16px] tracking-[-0.2px]", light ? "text-paper" : "text-ink", className)}>{children}</Text>
}

/** Texte secondaire (.muted) ; `light` pour la carte sombre. */
export function Muted({ children, light, className, style }: { children: React.ReactNode; light?: boolean; className?: string; style?: TextProps["style"] }) {
  return (
    <Text className={cx("font-sans text-[12.5px]", light ? "text-on-navy-muted" : "text-ink-light", className)} style={style}>
      {children}
    </Text>
  )
}

/** Valeur mise en avant (montants, dates, numéros) en Geist Mono à chiffres tabulaires. */
export function Numeric({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={cx("font-mono-medium text-[13px] tabular-nums text-ink", className)}>{children}</Text>
}

export function RowBetween({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={cx("flex-row items-center justify-between gap-2.5", className)}>{children}</View>
}

/** Ligne libellé / valeur des cartes de détail (« Date … 20/12/2026 »). `mono` : valeur en Geist Mono. */
export function KeyValue({
  label,
  value,
  valueClassName,
  first,
  mono,
}: {
  label: string
  value: string
  /** Classe de couleur de la valeur (ex. "text-success"). */
  valueClassName?: string
  first?: boolean
  mono?: boolean
}) {
  return (
    <RowBetween className={first ? undefined : "mt-2"}>
      <Muted>{label}</Muted>
      <Text className={cx("shrink text-right text-[13px] tabular-nums", mono ? "font-mono-semibold" : "font-sans-bold", valueClassName ?? "text-ink")}>{value}</Text>
    </RowBetween>
  )
}

/* ------------------------------------- Badge (.pill) ------------------------------------- */

export type PillVariant = "default" | "gold" | "burg" | "green" | "pending"

const pillClasses: Record<PillVariant, { bg: string; text: string }> = {
  default: { bg: "bg-surface-soft", text: "text-ink-soft" },
  gold: { bg: "bg-gold-soft", text: "text-gold-ink" },
  burg: { bg: "bg-danger-bg", text: "text-danger" },
  green: { bg: "bg-success-bg", text: "text-success" },
  pending: { bg: "bg-warning-bg", text: "text-warning" },
}

/** Badge en capitales ; `mono` pour un montant (Geist Mono, chiffres tabulaires). */
export function Pill({ children, variant = "default", mono }: { children: React.ReactNode; variant?: PillVariant; mono?: boolean }) {
  const s = pillClasses[variant]
  return (
    <View className={cx("self-start rounded-full px-[9px] py-1", s.bg)}>
      <Text className={cx("text-[10.5px] uppercase tracking-[0.4px]", mono ? "font-mono-semibold tabular-nums" : "font-sans-bold", s.text)}>{children}</Text>
    </View>
  )
}

/* ------------------------------------- Bouton (.btn) ------------------------------------- */

export type ButtonVariant = "primary" | "gold" | "outline" | "ghost" | "danger"

const buttonClasses: Record<ButtonVariant, { box: string; text: string; icon: string }> = {
  primary: { box: "bg-navy", text: "text-paper", icon: colors.paper },
  gold: { box: "bg-gold", text: "text-navy", icon: colors.navy },
  /** « Secondaire » : or pâle, bordure or à 35 %. */
  outline: { box: "border border-gold-35 bg-gold-soft", text: "text-navy", icon: colors.navy },
  ghost: { box: "bg-surface-soft", text: "text-navy", icon: colors.navy },
  danger: { box: "bg-danger-bg", text: "text-danger", icon: colors.danger },
}

export function Button({
  title,
  onPress,
  variant = "primary",
  icon: Icon,
  block,
  small,
  disabled,
  className,
}: {
  title: string
  onPress?: () => void
  variant?: ButtonVariant
  icon?: LucideIcon
  block?: boolean
  small?: boolean
  disabled?: boolean
  /** Marges uniquement (ex. "mt-5"). */
  className?: string
}) {
  const s = buttonClasses[variant]
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={small ? 6 : undefined}
      className={cx(
        "flex-row items-center justify-center gap-1.5 rounded-full",
        small ? "min-h-[32px] px-[13px] py-[7px]" : "min-h-touch px-[18px] py-[11px]",
        block ? "self-stretch" : "self-start",
        disabled && "opacity-50",
        s.box,
        className
      )}
    >
      {Icon ? <Icon size={small ? 13 : 15} color={s.icon} strokeWidth={2} /> : null}
      <Text className={cx("font-sans-bold", small ? "text-[11.5px]" : "text-[13px]", s.text)}>{title}</Text>
    </PressableScale>
  )
}

/* ---------------------------------- Progression (.progress) ---------------------------------- */

export function ProgressBar({ percent, light }: { percent: number; light?: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent || 0))
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      className={cx("mb-1 mt-2 h-2 overflow-hidden rounded-full", light ? "bg-on-navy-track" : "bg-surface-soft")}
    >
      {/* Largeur calculée : seule valeur en style. */}
      <View className="h-full rounded-full bg-gold" style={{ width: `${clamped}%` }} />
    </View>
  )
}

/* ------------------------------------ Filtre (.chip) ------------------------------------ */

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 6, bottom: 6 }}
      className={cx("min-h-[32px] justify-center rounded-full border-[1.3px] px-3", active ? "border-navy bg-navy" : "border-line-strong bg-paper")}
    >
      <Text className={cx("font-sans-semibold text-[11.5px]", active ? "text-paper" : "text-slate")}>{label}</Text>
    </Pressable>
  )
}

/** Rangée de chips (.chipsrow). */
export function ChipsRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={cx("mb-3.5 flex-row flex-wrap gap-[7px]", className)}>{children}</View>
}

/* ------------------------------------- Avatar (.avatar) ------------------------------------- */

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** Avatar rond à initiales ; teinte attribuée en rotation selon l'identifiant du choriste. */
export function Avatar({ id, name, size = 38 }: { id: number; name: string; size?: number }) {
  const tone = avatarClasses(id)
  return (
    // Taille paramétrable : dimensions calculées en style.
    <View className={cx("items-center justify-center rounded-full", tone.bg)} style={{ width: size, height: size }}>
      <Text className={cx("font-sans-semibold", tone.fg)} style={{ fontSize: size * 0.37 }}>
        {initials(name)}
      </Text>
    </View>
  )
}

/* ----------------------------------- Ligne de liste (.listrow) ----------------------------------- */

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
  /** Texte ou contenu riche (ex. montant en Geist Mono). */
  subtitle?: React.ReactNode
  right?: React.ReactNode
  onPress?: () => void
  last?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      className={cx("min-h-touch flex-row items-center gap-3 py-3 active:opacity-70", !last && "border-b border-line-soft")}
    >
      {left}
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-sans-bold text-[13.5px] text-ink">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} className="font-sans text-[11.5px] text-ink-light">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  )
}

/** Chevron « › » des lignes cliquables (.chev). */
export function Chevron() {
  return <Text className="font-sans text-[16px] text-ink-light">›</Text>
}

/* ------------------------------------ État vide (.empty) ------------------------------------ */

export function EmptyState({ icon, title, subtitle }: { icon?: string; title: string; subtitle: string }) {
  return (
    <View className="items-center px-3 py-9">
      {icon ? <Text className="mb-2 text-[30px]">{icon}</Text> : null}
      <Text className="mb-1 font-sans-semibold text-[15px] tracking-[-0.2px] text-navy">{title}</Text>
      <Text className="text-center font-sans text-[13px] text-ink-light">{subtitle}</Text>
    </View>
  )
}

/* ---------------------------------- Recherche (.searchbar) ---------------------------------- */

export function SearchBar(props: TextInputProps) {
  return (
    <View className="mb-3 min-h-touch flex-row items-center gap-2 rounded-full border-[1.5px] border-line bg-paper px-3.5">
      <Search size={16} color={colors.inkLight} strokeWidth={2} />
      <TextInput
        placeholderTextColor={colors.inkLight}
        accessibilityLabel={props.placeholder}
        className="flex-1 p-0 font-sans text-[13px] text-ink"
        {...props}
      />
    </View>
  )
}

/* ------------------------------------ Champs de formulaire ------------------------------------ */

/** Libellé de champ (label.field). `first` : sans marge haute. */
export function FieldLabel({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <Text className={cx("mb-1.5 font-sans-bold text-[11.5px] tracking-[0.2px] text-ink-soft", first ? "mt-0" : "mt-3")}>{children}</Text>
}

/** Contour or 2px du champ actif (propriétés `outline*` : non couvertes par NativeWind). */
const focusOutline = { outlineColor: colors.gold, outlineWidth: 2, outlineOffset: 1, outlineStyle: "solid" as const }

/** Classes de la boîte d'un champ ; au focus : bordure gold-strong (+ contour or via `focusOutline`). */
export function fieldBoxClasses(focused: boolean, disabled?: boolean) {
  return cx("rounded-field border", focused ? "border-gold-strong" : "border-line-strong", disabled ? "bg-surface-soft" : "bg-paper")
}

export type FieldHandle = React.ComponentRef<typeof TextInput>

export function Field(
  props: TextInputProps & {
    label: string
    first?: boolean
    multiline?: boolean
    right?: React.ReactNode
    /** Saisie numérique en Geist Mono. */
    mono?: boolean
    /** Accès au champ (ex. focus du champ suivant au clavier). */
    ref?: React.Ref<FieldHandle>
  }
) {
  const { label, first, multiline, style, right, editable, onFocus, onBlur, mono, ref, ...rest } = props
  const [focused, setFocused] = useState(false)
  return (
    <View>
      {label ? <FieldLabel first={first}>{label}</FieldLabel> : null}
      <View className={cx(fieldBoxClasses(focused, editable === false), "flex-row", multiline ? "items-start" : "items-center")} style={focused ? focusOutline : undefined}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.inkLight}
          accessibilityLabel={label || props.placeholder}
          multiline={multiline}
          editable={editable}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          className={cx(
            "flex-1 px-[13px] py-[11px] text-[13.5px]",
            mono ? "font-mono tabular-nums" : "font-sans",
            multiline ? "min-h-[90px]" : "min-h-touch",
            editable === false ? "text-ink-soft" : "text-ink"
          )}
          style={[{ textAlignVertical: multiline ? "top" : "center" }, style]}
          {...rest}
        />
        {right}
      </View>
    </View>
  )
}

export function Select<T extends string | number>({
  label,
  value,
  onChange,
  options,
  first,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { label: string; value: T }[]
  first?: boolean
}) {
  return (
    <View>
      <FieldLabel first={first}>{label}</FieldLabel>
      <View className={cx(fieldBoxClasses(false), "overflow-hidden")}>
        {/* Composant tiers : style passé en props. */}
        <Picker
          selectedValue={value}
          onValueChange={(v) => onChange(v as T)}
          accessibilityLabel={label}
          style={{ color: colors.ink, fontFamily: fonts.regular, fontSize: 13.5, minHeight: MIN_TOUCH, paddingHorizontal: 13, borderWidth: 0, backgroundColor: colors.paper }}
          dropdownIconColor={colors.navy}
        >
          {options.map((opt) => (
            <Picker.Item key={String(opt.value)} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </View>
    </View>
  )
}

/** Deux champs côte à côte (.formrow2). */
export function FormRow2({ children }: { children: [React.ReactNode, React.ReactNode] }) {
  return (
    <View className="flex-row gap-2.5">
      <View className="flex-1">{children[0]}</View>
      <View className="flex-1">{children[1]}</View>
    </View>
  )
}

/* --------------------------------- Case de cotisation (.seal) --------------------------------- */

/**
 * Case ronde d'un mois sur la carte de cotisation.
 * Payé : rond or pâle, bordure or, « ✓ payé » en vert. À encaisser (si droit) : pointillé gold-strong, tactile.
 * Non payé : pointillé line-strong sur fond surface.
 */
export function Seal({ month, paid, clickable, onPress }: { month: string; paid: boolean; clickable?: boolean; onPress?: () => void }) {
  return (
    <PressableScale
      scale={0.93}
      onPress={clickable ? onPress : undefined}
      disabled={!clickable}
      accessibilityRole={clickable ? "button" : undefined}
      accessibilityLabel={`${month} : ${paid ? "payé" : clickable ? "non payé, toucher pour enregistrer le paiement" : "non payé"}`}
      className={cx(
        "aspect-square items-center justify-center rounded-full border-[1.5px]",
        paid ? "border-solid border-gold bg-gold-soft" : cx("border-dashed bg-surface", clickable ? "border-gold-strong" : "border-line-strong")
      )}
    >
      <Text className={cx("text-[9px] tracking-[0.5px]", paid ? "font-mono-semibold text-gold-ink" : "font-mono text-ink-light")}>{month}</Text>
      {paid ? <Text className="mt-px font-sans-semibold text-[10.5px] text-success">✓ payé</Text> : null}
    </PressableScale>
  )
}

/* ---------------------------------------- QR du reçu (.qr) ---------------------------------------- */

/** Motif QR décoratif (damier), comme dans le prototype. */
export function QrPlaceholder({ size = 70 }: { size?: number }) {
  const cell = 5
  const n = Math.floor(size / cell)
  const cells: React.ReactNode[] = []
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if ((x + y) % 2 === 0) cells.push(<Rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={colors.ink} />)
    }
  }
  return (
    <View accessibilityLabel="Code QR du reçu" className="border border-line bg-paper p-1.5">
      <Svg width={n * cell} height={n * cell}>
        {cells}
      </Svg>
    </View>
  )
}
