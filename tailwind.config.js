/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./context/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#211722",
        aubergine: "#2E1B33",
        "aubergine-2": "#3D2A52",
        gold: "#C9A24B",
        "gold-soft": "#E8D9AE",
        paper: "#F6EFE3",
        "paper-2": "#EFE4CF",
        burgundy: "#8C3A46",
        green: "#3F6B4F",
        muted: "#8A7C82",
        white: "#FFFDF8",
        danger: "#B23A3A",
      },
      fontFamily: {
        serif: ["Fraunces_600SemiBold"],
        "serif-italic": ["Fraunces_500Medium_Italic"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-bold": ["Inter_700Bold"],
        mono: ["SpaceMono_400Regular"],
      },
      borderRadius: {
        card: "18px",
      },
    },
  },
  plugins: [],
}