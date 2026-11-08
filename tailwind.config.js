/** @type {import('tailwindcss').Config} */
// Design system NativeWind — My Choir Space (palette LUNA), identique au portail web et au back-office.
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
      // Geist pour l'interface et les montants (chiffres tabulaires) ; Geist Mono pour les numéros de reçu et les codes.
      fontFamily: {
        sans: ["Geist_400Regular"],
        "sans-medium": ["Geist_500Medium"],
        "sans-semibold": ["Geist_600SemiBold"],
        "sans-bold": ["Geist_700Bold"],
        mono: ["GeistMono_400Regular"],
        "mono-medium": ["GeistMono_500Medium"],
        "mono-semibold": ["GeistMono_600SemiBold"],
      },
      // Rayons : 8 contrôles · 12 tuiles · 16 cartes mobiles · 24 feuilles.
      borderRadius: {
        card: "16px",
        tile: "12px",
        field: "8px",
        row: "12px",
        sheet: "24px",
      },
      // Cible tactile minimale.
      minHeight: { touch: "44px" },
      minWidth: { touch: "44px" },
    },
  },
  plugins: [],
}
