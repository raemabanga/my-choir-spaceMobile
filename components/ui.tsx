// Composants partagés — design system Harmonix (carte, pastille, bouton, progression,
// case de mois, filtre, avatar, ligne de liste, état vide, recherche, champs, QR…).
// Style en classes NativeWind (tailwind.config.js) ; `style` n'est utilisé que pour les ombres,
// les valeurs calculées et les props des composants tiers.
// Règles : sentence case, deux couleurs de marque (marine + turquoise en petites touches),
// statuts en pastilles douces avec point, montants en Geist à chiffres tabulaires,
// Geist Mono réservé aux numéros de reçu et aux codes, aucune emoji.

import { LinearGradient } from "expo-linear-gradient"
import { Check, ChevronDown, ChevronRight, Search, X, type LucideIcon } from "lucide-react-native"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { FlatList, Keyboard, Modal, Pressable, Text, TextInput, TextInputProps, TextProps, useWindowDimensions, View, ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Rect } from "react-native-svg"
import palette from "../constants/palette"
import { keyboardToolbarProps, signalerFocusChamp } from "./keyboard"
import { avatarClasses, colors, MIN_TOUCH, shadows } from "../constants/theme"

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
    <View className={cx("mb-2.5 mt-6 flex-row items-center gap-2", className)}>
      <Text accessibilityRole="header" className="font-sans-semibold text-[16px] tracking-[-0.3px] text-ink">
        {title}
      </Text>
      <LinearGradient colors={[colors.ruleStart, colors.ruleEnd]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1, height: 1 }} />
    </View>
  )
}

/** Overline : 11px, semibold, majuscules, +0.06em (en-têtes de bloc, libellés techniques). */
export function Overline({ children, light, className }: { children: React.ReactNode; light?: boolean; className?: string }) {
  return (
    <Text className={cx("font-sans-semibold text-[11px] uppercase tracking-[0.66px]", light ? "text-on-navy-muted" : "text-ink-light", className)}>
      {children}
    </Text>
  )
}

/** Titre d'un bottom sheet. */
export function SheetTitle({ children }: { children: React.ReactNode }) {
  return <Text className="mb-1 font-sans-semibold text-[20px] tracking-[-0.4px] text-ink">{children}</Text>
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
  return <Text className={cx("mb-1 font-sans-semibold text-[16px] tracking-[-0.3px]", light ? "text-paper" : "text-ink", className)}>{children}</Text>
}

/** Texte secondaire (.muted) ; `light` pour la carte sombre. */
export function Muted({ children, light, className, style }: { children: React.ReactNode; light?: boolean; className?: string; style?: TextProps["style"] }) {
  return (
    <Text className={cx("font-sans text-[13px] leading-[19px]", light ? "text-on-navy-muted" : "text-ink-light", className)} style={style}>
      {children}
    </Text>
  )
}

/** Valeur mise en avant (montants, dates) en Geist à chiffres tabulaires. */
export function Numeric({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={cx("font-sans-medium text-[13px] tabular-nums text-ink", className)}>{children}</Text>
}

/** Numéro de reçu ou code technique (RCU-2026-0015) : seul usage de Geist Mono. */
export function Code({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={cx("font-mono-medium text-[12.5px] text-ink", className)}>{children}</Text>
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
      <Text className={cx("shrink text-right text-[13px] tabular-nums", mono ? "font-sans-semibold" : "font-sans-medium", valueClassName ?? "text-ink")}>{value}</Text>
    </RowBetween>
  )
}

/* ------------------------------------- Pastille (badge) ------------------------------------- */

/** default : neutre · gold : accent turquoise · burg : impayé / rejeté · green : payé / validé · pending : en retard / en attente · info. */
export type PillVariant = "default" | "gold" | "burg" | "green" | "pending" | "info"

const pillClasses: Record<PillVariant, { bg: string; text: string; dot: string | null }> = {
  default: { bg: "bg-surface-soft", text: "text-ink-soft", dot: null },
  gold: { bg: "bg-gold-soft", text: "text-gold-ink", dot: null },
  burg: { bg: "bg-danger-bg", text: "text-danger", dot: "bg-danger" },
  green: { bg: "bg-success-bg", text: "text-success", dot: "bg-success" },
  pending: { bg: "bg-warning-bg", text: "text-warning", dot: "bg-warning" },
  info: { bg: "bg-info-bg", text: "text-info", dot: "bg-info" },
}

/** Pastille en sentence case ; les statuts portent un point de couleur. `mono` : chiffres tabulaires. */
export function Pill({ children, variant = "default", mono }: { children: React.ReactNode; variant?: PillVariant; mono?: boolean }) {
  const s = pillClasses[variant]
  return (
    <View className={cx("flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-[3px]", s.bg)}>
      {s.dot ? <View className={cx("h-1.5 w-1.5 rounded-full", s.dot)} /> : null}
      <Text className={cx("font-sans-medium text-[12px]", mono && "tabular-nums", s.text)}>{children}</Text>
    </View>
  )
}

/* ------------------------------------- Bouton (.btn) ------------------------------------- */

export type ButtonVariant = "primary" | "gold" | "outline" | "ghost" | "danger"

const buttonClasses: Record<ButtonVariant, { box: string; text: string; icon: string }> = {
  /** Principal : marine plein. Un seul par écran de préférence. */
  primary: { box: "bg-navy", text: "text-paper", icon: colors.paper },
  /** Secondaire : turquoise plein (couleur d'accent). */
  gold: { box: "bg-gold", text: "text-paper", icon: colors.paper },
  /** Contour : blanc, bordure grise. */
  outline: { box: "border border-line-strong bg-paper", text: "text-ink", icon: colors.ink },
  /** Discret : gris très clair. */
  ghost: { box: "bg-surface-soft", text: "text-ink", icon: colors.ink },
  /** Destructif : rouge doux (action répétée dans les listes, sans aplat criard). */
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
        "flex-row items-center justify-center gap-2 rounded-field",
        small ? "min-h-[32px] px-3 py-1.5" : "min-h-touch px-[18px] py-[11px]",
        block ? "self-stretch" : "self-start",
        disabled && "opacity-50",
        s.box,
        className
      )}
    >
      {Icon ? <Icon size={small ? 14 : 16} color={s.icon} strokeWidth={1.75} /> : null}
      <Text className={cx("font-sans-semibold", small ? "text-[12.5px]" : "text-[14px]", s.text)}>{title}</Text>
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
      className={cx("mb-1 mt-2 h-1.5 overflow-hidden rounded-full", light ? "bg-on-navy-track" : "bg-line")}
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
      className={cx("min-h-[34px] justify-center rounded-full border px-3.5", active ? "border-navy bg-navy" : "border-line-strong bg-paper")}
    >
      <Text className={cx("font-sans-medium text-[13px]", active ? "text-paper" : "text-ink-soft")}>{label}</Text>
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
        <Text numberOfLines={1} className="font-sans-medium text-[14px] text-ink">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} className="font-sans text-[12px] text-ink-light">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  )
}

/** Chevron des lignes cliquables. */
export function Chevron() {
  return <ChevronRight size={18} color={colors.n400} strokeWidth={1.75} />
}

/* ------------------------------------ État vide ------------------------------------ */

/** État vide : icône lucide dans une tuile grise, titre, explication (dit pourquoi). */
export function EmptyState({ icon: Icon, title, subtitle }: { icon?: LucideIcon; title: string; subtitle: string }) {
  return (
    <View className="items-center px-3 py-9">
      {Icon ? (
        <View className="mb-3 h-12 w-12 items-center justify-center rounded-tile bg-surface-soft">
          <Icon size={22} color={colors.luna500} strokeWidth={1.75} />
        </View>
      ) : null}
      <Text className="mb-1 font-sans-semibold text-[15px] tracking-[-0.2px] text-ink">{title}</Text>
      <Text className="text-center font-sans text-[13px] leading-[19px] text-ink-light">{subtitle}</Text>
    </View>
  )
}

/* ---------------------------------- Recherche (.searchbar) ---------------------------------- */

export function SearchBar(props: TextInputProps) {
  return (
    <View className="mb-3 min-h-touch flex-row items-center gap-2 rounded-field border border-line-strong bg-paper px-3">
      <Search size={16} color={colors.n400} strokeWidth={1.75} />
      <TextInput
        placeholderTextColor={colors.inkLight}
        accessibilityLabel={props.placeholder}
        className="flex-1 p-0 font-sans text-[13px] text-ink"
        returnKeyType="search"
        {...keyboardToolbarProps}
        {...props}
        onFocus={(e) => {
          signalerFocusChamp()
          props.onFocus?.(e)
        }}
      />
    </View>
  )
}

/* ------------------------------------ Champs de formulaire ------------------------------------ */

/** Libellé de champ (label.field). `first` : sans marge haute. */
export function FieldLabel({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <Text className={cx("mb-1.5 font-sans-medium text-[13px] text-ink", first ? "mt-0" : "mt-3")}>{children}</Text>
}

/** Anneau turquoise 3px à 45 % du champ actif (propriétés `outline*` : non couvertes par NativeWind). */
const focusOutline = { outlineColor: colors.focusRing, outlineWidth: 3, outlineOffset: 0, outlineStyle: "solid" as const }

/** Classes de la boîte d'un champ ; au focus : bordure turquoise (+ anneau via `focusOutline`). */
export function fieldBoxClasses(focused: boolean, disabled?: boolean) {
  return cx("rounded-field border", focused ? "border-gold" : "border-line-strong", disabled ? "bg-surface-soft" : "bg-paper")
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
          // Barre « OK » au-dessus du clavier sur iPhone (aussi pour les claviers numériques).
          {...keyboardToolbarProps}
          onFocus={(e) => {
            setFocused(true)
            signalerFocusChamp()
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          className={cx(
            "min-w-0 flex-1 px-3 py-[11px] text-[15px]",
            mono ? "font-sans tabular-nums" : "font-sans",
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

/** Recherche sans tenir compte des accents ni de la casse (« Eleve » trouve « Élevé »). */
const normalizeSearch = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()

/** Hauteur d'une option, hauteur max de la liste, écart au champ et marge aux bords de l'écran. */
const OPTION_HEIGHT = MIN_TOUCH
const LIST_MAX_HEIGHT = 5.5 * OPTION_HEIGHT
const POPOVER_GAP = 6
const SCREEN_MARGIN = 12

/**
 * Champ de sélection : se présente comme un champ de saisie ; au toucher, un petit cadre
 * s'ouvre juste sous le champ (ou au-dessus s'il manque de place) avec une recherche et la
 * liste des choix. Toucher en dehors ou le bouton retour le referme.
 */
export function Select<T extends string | number>({
  label,
  value,
  onChange,
  options,
  first,
  placeholder = "Choisir…",
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { label: string; value: T }[]
  first?: boolean
  placeholder?: string
}) {
  const triggerRef = useRef<React.ComponentRef<typeof View>>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [query, setQuery] = useState("")
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const window = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const open = anchor !== null

  const selected = options.find((o) => o.value === value)
  const filtered = useMemo(() => {
    const q = normalizeSearch(query)
    return q ? options.filter((o) => normalizeSearch(o.label).includes(q)) : options
  }, [options, query])

  // Le clavier (recherche) réduit la place disponible sous le champ.
  useEffect(() => {
    if (!open) return
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [open])

  const openPopover = () => {
    Keyboard.dismiss()
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setQuery("")
      setAnchor({ x, y, width, height })
    })
  }
  const close = () => {
    Keyboard.dismiss()
    setAnchor(null)
  }
  const choose = (v: T) => {
    onChange(v)
    close()
  }

  // Position du cadre : largeur du champ (240 min), sous le champ si la place suffit, sinon au-dessus.
  let popoverStyle: ViewProps["style"] = undefined
  if (anchor) {
    const width = Math.min(Math.max(anchor.width, 240), window.width - 2 * SCREEN_MARGIN)
    const left = Math.min(Math.max(anchor.x, SCREEN_MARGIN), window.width - SCREEN_MARGIN - width)
    const wanted = 56 + Math.min(Math.max(filtered.length, 1) * OPTION_HEIGHT, LIST_MAX_HEIGHT) + 8
    const below = window.height - keyboardHeight - insets.bottom - SCREEN_MARGIN - (anchor.y + anchor.height + POPOVER_GAP)
    const above = anchor.y - POPOVER_GAP - insets.top - SCREEN_MARGIN
    popoverStyle =
      below >= wanted || below >= above
        ? { left, width, top: anchor.y + anchor.height + POPOVER_GAP, maxHeight: Math.max(below, 120) }
        : { left, width, bottom: window.height - anchor.y + POPOVER_GAP, maxHeight: above }
  }

  return (
    <View>
      <FieldLabel first={first}>{label}</FieldLabel>
      <Pressable
        ref={triggerRef}
        onPress={openPopover}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        accessibilityState={{ expanded: open }}
        className={cx(fieldBoxClasses(open), "min-h-touch flex-row items-center gap-2 pl-3 pr-2.5")}
        style={open ? focusOutline : undefined}
      >
        <Text numberOfLines={1} className={cx("flex-1 font-sans text-[15px]", selected ? "text-ink" : "text-ink-light")}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} color={colors.inkLight} strokeWidth={1.75} style={open ? { transform: [{ rotate: "180deg" }] } : undefined} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
        {/* Fond transparent : toucher en dehors du cadre le referme. */}
        <Pressable className="flex-1" onPress={close} accessibilityLabel="Fermer la liste" accessibilityRole="button" />
        {anchor ? (
          <View className="absolute overflow-hidden rounded-[12px] border border-line bg-paper" style={[shadows.toast, popoverStyle]}>
            <View className="border-b border-line-soft p-2">
              <View className="min-h-[40px] flex-row items-center gap-2 rounded-field border border-line-strong bg-surface-soft px-2.5">
                <Search size={15} color={colors.n400} strokeWidth={1.75} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Rechercher…"
                  placeholderTextColor={colors.inkLight}
                  accessibilityLabel={`Rechercher dans ${label}`}
                  autoCorrect={false}
                  returnKeyType="search"
                  className="flex-1 p-0 font-sans text-[14px] text-ink"
                />
                {query ? (
                  <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Effacer la recherche" accessibilityRole="button">
                    <X size={15} color={colors.inkLight} strokeWidth={1.75} />
                  </Pressable>
                ) : null}
              </View>
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(o) => String(o.value)}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: LIST_MAX_HEIGHT, flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ paddingVertical: 4 }}
              getItemLayout={(_, index) => ({ length: OPTION_HEIGHT, offset: OPTION_HEIGHT * index, index })}
              initialScrollIndex={Math.max(0, filtered.findIndex((o) => o.value === value))}
              ListEmptyComponent={<Text className="px-3 py-3 font-sans text-[13px] text-ink-light">Aucun résultat</Text>}
              renderItem={({ item }) => {
                const isSelected = item.value === value
                return (
                  <Pressable
                    onPress={() => choose(item.value)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isSelected }}
                    className={cx("mx-1 h-[44px] flex-row items-center gap-2 rounded-[8px] px-2.5", isSelected ? "bg-gold-soft" : "active:bg-surface-soft")}
                  >
                    <Text numberOfLines={1} className={cx("flex-1 text-[14px]", isSelected ? "font-sans-semibold text-ink" : "font-sans text-ink")}>
                      {item.label}
                    </Text>
                    {isSelected ? <Check size={16} color={colors.goldStrong} strokeWidth={2} /> : null}
                  </Pressable>
                )
              }}
            />
          </View>
        ) : null}
      </Modal>
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

/* --------------------------------- Case de mois (carte 12 mois) --------------------------------- */

/**
 * Case d'un mois sur la carte de cotisation (grille 4 × 3).
 * Payé : vert doux, libellé « Payé ». Impayé : fond blanc, bordure rouge douce, libellé « Impayé ».
 * Tactile seulement si l'utilisateur peut enregistrer le paiement.
 */
export function Seal({ month, paid, clickable, onPress }: { month: string; paid: boolean; clickable?: boolean; onPress?: () => void }) {
  return (
    <PressableScale
      scale={0.96}
      onPress={clickable ? onPress : undefined}
      disabled={!clickable}
      accessibilityRole={clickable ? "button" : undefined}
      accessibilityLabel={`${month} : ${paid ? "payé" : clickable ? "impayé, toucher pour enregistrer le paiement" : "impayé"}`}
      className={cx(
        "min-h-[52px] justify-center rounded-row border px-2.5 py-2",
        paid ? "border-success-bg bg-success-bg" : "border-danger-line bg-paper"
      )}
    >
      <Text numberOfLines={1} className="font-sans-semibold text-[13px] text-ink">
        {month}
      </Text>
      <Text numberOfLines={1} className={cx("mt-0.5 font-sans-medium text-[11px]", paid ? "text-success" : "text-danger")}>
        {paid ? "Payé" : "Impayé"}
      </Text>
    </PressableScale>
  )
}

/* --------------------------------- Motif de cercles (bloc marine) --------------------------------- */

/**
 * Seul motif décoratif du design system : grands cercles doux (LUNA 500) sur un bloc marine.
 * Réservé à la connexion et à l'en-tête de l'accueil. Le parent doit être `relative overflow-hidden`.
 */
/**
 * Motif décoratif de cercles. `navy` (défaut) : sur un bandeau marine, en haut.
 * `paper` : version pâle pour un fond blanc, ancrée en bas pour ne pas gêner la lecture des champs.
 * Le parent doit être `relative overflow-hidden`.
 */
export function NavyCircles({ variant = "navy" }: { variant?: "navy" | "paper" }) {
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="absolute inset-0">
      {variant === "navy" ? (
        <>
          <View className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-luna-500 opacity-60" />
          <View className="absolute -right-12 top-10 h-40 w-40 rounded-full bg-luna-500 opacity-70" />
          <View className="absolute -bottom-24 left-1/3 h-44 w-44 rounded-full bg-luna-500 opacity-40" />
        </>
      ) : (
        <>
          <View className="absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-luna-100 opacity-30" />
          <View className="absolute -left-12 bottom-24 h-40 w-40 rounded-full bg-luna-50" />
          <View className="absolute -bottom-28 right-1/3 h-44 w-44 rounded-full bg-luna-100 opacity-20" />
        </>
      )}
    </View>
  )
}

/* ---------------------------------------- QR du reçu ---------------------------------------- */

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
