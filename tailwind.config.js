/** @type {import('tailwindcss').Config} */
// Design system NativeWind, aligné sur le prototype cantoria-app-mobile-v2.html.
// Couleurs : constants/palette.js (source unique, partagée avec constants/theme.ts).
const palette = require("./constants/palette")

module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./context/**/*.{js,jsx,ts,tsx}",
    // Classes déclarées hors des composants (ex. teintes d'avatar dans constants/theme.ts).
    "./constants/**/*.{js,ts}",
    "./lib/**/*.{js,ts}",
  ],
  presets: [require("nativewind/preset")],
  // Le mode sombre n'est pas géré ; "class" évite une erreur de NativeWind sur le web.
  darkMode: "class",
  theme: {
    extend: {
      colors: palette,
      // Geist pour l'interface ; Geist Mono pour libellés techniques, numéros, montants et dates.
      fontFamily: {
        sans: ["Geist_400Regular"],
        "sans-medium": ["Geist_500Medium"],
        "sans-semibold": ["Geist_600SemiBold"],
        "sans-bold": ["Geist_700Bold"],
        mono: ["GeistMono_400Regular"],
        "mono-medium": ["GeistMono_500Medium"],
        "mono-semibold": ["GeistMono_600SemiBold"],
      },
      borderRadius: {
        card: "16px",
        field: "10px",
        row: "14px",
        sheet: "26px",
      },
      // Cible tactile minimale.
      minHeight: { touch: "44px" },
      minWidth: { touch: "44px" },
    },
  },
  plugins: [],
}
