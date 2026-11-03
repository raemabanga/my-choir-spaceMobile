// Source unique des couleurs (prototype cantoria-app-mobile-v2.html / portail web).
// Lue par tailwind.config.js (classes NativeWind : bg-navy, text-ink-light, border-line…)
// et par constants/theme.ts (props de couleur des composants tiers : icônes, dégradés, Picker).
// Aucune couleur ne doit être écrite en dur ailleurs : ajoutez une entrée ici.

module.exports = {
  // Bleu nuit
  navy: "#111827",
  "navy-strong": "#0b1220",
  slate: "#1f2937",
  // Texte
  ink: "#111827",
  "ink-soft": "#4b5563",
  "ink-light": "#6b7280",
  // Or
  gold: "#d9b55d",
  "gold-strong": "#bf8d2f",
  "gold-soft": "#f5e7bb",
  "gold-soft-strong": "#f9f0d1",
  /** Texte sur fond or pâle (badges or, mois payés). */
  "gold-ink": "#7a5a14",
  // Fonds
  surface: "#f5f7fb",
  "surface-soft": "#eef3f8",
  paper: "#ffffff",
  // Bordures
  line: "rgba(17,24,39,0.08)",
  "line-strong": "rgba(17,24,39,0.14)",
  /** Séparateur entre lignes de liste. */
  "line-soft": "rgba(17,24,39,0.07)",
  // États
  success: "#1f8a5b",
  "success-bg": "#e9f9f0",
  warning: "#b7791f",
  "warning-bg": "#fff4d8",
  danger: "#c94a4a",
  "danger-bg": "#fbeaea",
  // Teintes translucides
  /** Barre de navigation basse. */
  "paper-translucent": "rgba(255,255,255,0.88)",
  /** Voile derrière les bottom sheets. */
  overlay: "rgba(17,24,39,0.45)",
  /** Poignée des bottom sheets. */
  handle: "rgba(17,24,39,0.2)",
  /** Filet dégradé des titres de section (début → fin). */
  "rule-start": "rgba(17,24,39,0.25)",
  "rule-end": "rgba(17,24,39,0)",
  /** Bordure des boutons secondaires (or à 35 %). */
  "gold-35": "rgba(191,141,47,0.35)",
  /** Carte sombre : texte secondaire et piste de progression. */
  "on-navy-muted": "rgba(245,247,251,0.65)",
  "on-navy-track": "rgba(255,255,255,0.16)",
  // Avatars à initiales (fond / texte), attribués en rotation selon l'identifiant
  "avatar-1-bg": "#ecfdf5",
  "avatar-1-fg": "#047857",
  "avatar-2-bg": "#f0f9ff",
  "avatar-2-fg": "#0369a1",
  "avatar-3-bg": "#f5f3ff",
  "avatar-3-fg": "#6d28d9",
  "avatar-4-bg": "#fffbeb",
  "avatar-4-fg": "#b45309",
  "avatar-5-bg": "#fff1f2",
  "avatar-5-fg": "#be123c",
  "avatar-6-bg": "#eef2ff",
  "avatar-6-fg": "#4338ca",
}
