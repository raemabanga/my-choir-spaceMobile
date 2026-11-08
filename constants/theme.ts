// Valeurs du design utilisables en TypeScript. Le style passe par les classes NativeWind
// (tailwind.config.js) ; ce fichier sert uniquement là où une classe ne peut pas s'appliquer :
// props de couleur des composants tiers (icônes lucide, LinearGradient, Picker, ActivityIndicator),
// ombres colorées natives et valeurs calculées.

import palette from "./palette"

export const colors = {
  navy: palette.navy,
  navyStrong: palette["navy-strong"],
  slate: palette.slate,
  ink: palette.ink,
  inkSoft: palette["ink-soft"],
  inkLight: palette["ink-light"],
  gold: palette.gold,
  goldStrong: palette["gold-strong"],
  goldSoft: palette["gold-soft"],
  goldSoftStrong: palette["gold-soft-strong"],
  goldInk: palette["gold-ink"],
  surface: palette.surface,
  surfaceSoft: palette["surface-soft"],
  paper: palette.paper,
  line: palette.line,
  lineStrong: palette["line-strong"],
  lineSoft: palette["line-soft"],
  success: palette.success,
  successBg: palette["success-bg"],
  warning: palette.warning,
  warningBg: palette["warning-bg"],
  danger: palette.danger,
  dangerBg: palette["danger-bg"],
  paperTranslucent: palette["paper-translucent"],
  overlay: palette.overlay,
  handle: palette.handle,
  ruleStart: palette["rule-start"],
  ruleEnd: palette["rule-end"],
  gold35: palette["gold-35"],
  onNavyMuted: palette["on-navy-muted"],
  onNavyTrack: palette["on-navy-track"],
  onNavyFill: palette["on-navy-fill"],
  info: palette.info,
  infoBg: palette["info-bg"],
  focusRing: palette["focus-ring"],
  primary: palette.primary,
  primarySoft: palette["primary-soft"],
  luna100: palette["luna-100"],
  luna500: palette["luna-500"],
  luna700: palette["luna-700"],
  luna900: palette["luna-900"],
  n400: palette["n-400"],
} as const

/** Classes NativeWind des avatars (fond / texte), attribuées en rotation selon l'identifiant. */
const AVATAR_CLASSES = [
  { bg: "bg-avatar-1-bg", fg: "text-avatar-1-fg" },
  { bg: "bg-avatar-2-bg", fg: "text-avatar-2-fg" },
  { bg: "bg-avatar-3-bg", fg: "text-avatar-3-fg" },
  { bg: "bg-avatar-4-bg", fg: "text-avatar-4-fg" },
  { bg: "bg-avatar-5-bg", fg: "text-avatar-5-fg" },
  { bg: "bg-avatar-6-bg", fg: "text-avatar-6-fg" },
] as const

export function avatarClasses(id: number) {
  const n = AVATAR_CLASSES.length
  return AVATAR_CLASSES[(((id - 1) % n) + n) % n]!
}

/** Noms des polices (pour les rares styles calculés). Les classes équivalentes : font-sans, font-mono… */
export const fonts = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
  monoSemibold: "GeistMono_600SemiBold",
} as const

/**
 * Ombres teintées navy, discrètes (les bordures font l'essentiel de la séparation).
 * Non exprimables en classes NativeWind sur iOS/Android : à passer en `style`.
 * xs → cartes · md → toasts, carte d'accueil · lg → bottom sheets, dialogues.
 */
export const shadows = {
  /** xs — cartes. */
  card: { shadowColor: palette["luna-900"], shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  /** md — carte mise en avant de l'accueil (« Reste à payer »). */
  hero: { shadowColor: palette["luna-900"], shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  /** md — pastille de marque (connexion). */
  mark: { shadowColor: palette["luna-900"], shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  /** md — toast. */
  toast: { shadowColor: palette["luna-900"], shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  /** lg — bottom sheet. */
  sheet: { shadowColor: palette["luna-900"], shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 16 },
} as const

/** Taille minimale d'une cible tactile (classe : min-h-touch). */
export const MIN_TOUCH = 44
