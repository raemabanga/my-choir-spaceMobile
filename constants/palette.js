// Source unique des couleurs — design system My Choir Space (palette LUNA), identique au
// portail web et au back-office.
// Lue par tailwind.config.js (classes NativeWind : bg-navy, text-ink-light, border-line…)
// et par constants/theme.ts (props de couleur des composants tiers : icônes, dégradés, Picker).
// Aucune couleur ne doit être écrite en dur ailleurs : ajoutez une entrée ici.
//
// Deux couleurs de marque seulement : bleu marine (principale) et turquoise (secondaire,
// petites touches). Tout le reste est en gris froids ; les statuts restent en teintes douces.

// ---- Palette LUNA ----
const luna = {
  "luna-50": "#ecf7f9",
  "luna-100": "#a7ebf2",
  "luna-300": "#54acbf",
  "luna-500": "#26658c",
  "luna-700": "#023859",
  "luna-900": "#011c40",
}

// ---- Neutres froids ----
const neutral = {
  "n-0": "#ffffff",
  "n-25": "#f7f9fb",
  "n-50": "#f0f3f6",
  "n-100": "#e4e9ef",
  "n-200": "#cdd5df",
  "n-300": "#aab6c3",
  "n-400": "#8391a3",
  "n-500": "#5f6e82",
  "n-700": "#3a4859",
  "n-900": "#0f1b2d",
}

module.exports = {
  ...luna,
  ...neutral,

  // Marque
  primary: luna["luna-700"],
  "primary-hover": luna["luna-900"],
  "primary-soft": "#e8edf3",
  secondary: luna["luna-300"],
  "secondary-soft": luna["luna-50"],

  // Bleu marine (noms historiques)
  navy: luna["luna-700"],
  "navy-strong": luna["luna-900"],
  slate: neutral["n-700"],
  // Texte
  ink: neutral["n-900"],
  "ink-soft": neutral["n-700"],
  "ink-light": neutral["n-500"],
  // Accent : historiquement « or », désormais turquoise (couleur secondaire)
  gold: luna["luna-300"],
  "gold-strong": "#3b7886",
  "gold-soft": "#ebf5f7",
  "gold-soft-strong": "#d4eaef",
  /** Texte sur fond turquoise pâle (pastilles d'accent). */
  "gold-ink": "#2c5f6b",
  // Fonds
  surface: neutral["n-25"],
  "surface-soft": neutral["n-50"],
  paper: neutral["n-0"],
  // Bordures
  line: neutral["n-100"],
  "line-strong": neutral["n-200"],
  /** Séparateur entre lignes de liste. */
  "line-soft": "#edf1f5",
  // États (atténués ; toujours en pastille douce, jamais en grand aplat)
  success: "#2f8f6b",
  "success-bg": "#e5f3ec",
  warning: "#a8691a",
  "warning-bg": "#fbf0df",
  danger: "#c2413b",
  "danger-bg": "#fbe9e7",
  /** Bordure rouge douce (mois impayé). */
  "danger-line": "#efc6c3",
  info: luna["luna-500"],
  "info-bg": "#e6eef5",
  // Teintes translucides
  /** Barre de navigation basse. */
  "paper-translucent": "rgba(255,255,255,0.96)",
  /** Voile derrière les bottom sheets. */
  overlay: "rgba(1,28,64,0.45)",
  /** Poignée des bottom sheets. */
  handle: "rgba(1,28,64,0.18)",
  /** Filet dégradé des titres de section (début → fin). */
  "rule-start": "rgba(205,213,223,1)",
  "rule-end": "rgba(205,213,223,0)",
  /** Bordure des éléments d'accent (turquoise à 35 %). */
  "gold-35": "rgba(84,172,191,0.35)",
  /** Focus des champs (turquoise à 45 %). */
  "focus-ring": "rgba(84,172,191,0.45)",
  /** Bloc marine : texte secondaire, piste de progression, remplissages blancs translucides. */
  "on-navy-muted": "rgba(255,255,255,0.72)",
  "on-navy-track": "rgba(255,255,255,0.16)",
  "on-navy-fill": "rgba(255,255,255,0.10)",
  // Avatars : teinte turquoise unique (l'app ne doit pas être très colorée).
  // Six entrées conservées pour l'API avatarClasses(id).
  "avatar-1-bg": "#ebf5f7",
  "avatar-1-fg": "#2c5f6b",
  "avatar-2-bg": "#ebf5f7",
  "avatar-2-fg": "#2c5f6b",
  "avatar-3-bg": "#ebf5f7",
  "avatar-3-fg": "#2c5f6b",
  "avatar-4-bg": "#ebf5f7",
  "avatar-4-fg": "#2c5f6b",
  "avatar-5-bg": "#ebf5f7",
  "avatar-5-fg": "#2c5f6b",
  "avatar-6-bg": "#ebf5f7",
  "avatar-6-fg": "#2c5f6b",
}
