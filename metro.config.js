const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

// expo-sqlite sur le web (mode hors ligne) : charge le moteur SQLite compilé en WebAssembly.
config.resolver.assetExts.push("wasm")

module.exports = withNativeWind(config, { input: './global.css' })