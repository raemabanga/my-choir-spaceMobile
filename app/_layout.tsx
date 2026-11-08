import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  useFonts,
} from "@expo-google-fonts/geist"
import { GeistMono_400Regular, GeistMono_500Medium, GeistMono_600SemiBold, useFonts as useGeistMono } from "@expo-google-fonts/geist-mono"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect, useState } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
// @ts-ignore - NativeWind loads this stylesheet at runtime.
import "../global.css"
import "../lib/nativewind-interop"

import { colors } from "../constants/theme"
import { AppProvider } from "../context/AppContext"
import { SheetProvider } from "../context/SheetContext"
import { ToastProvider } from "../context/ToastContext"
import { hasStoredToken } from "../lib/api"
import { initializeOffline, OfflineProvider } from "../lib/offline"
// Déclarations des entités hors ligne : à importer avant initializeOffline().
import { OFFLINE_DATA_VERSION } from "../lib/offline/entities"

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [geistLoaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold })
  const [monoLoaded] = useGeistMono({ GeistMono_400Regular, GeistMono_500Medium, GeistMono_600SemiBold })
  const fontsLoaded = geistLoaded && monoLoaded
  // Mode hors ligne : base SQLite → surveillance du réseau → syncManager (prêt ou désactivé, l'app démarre).
  const [offlineStarted, setOfflineStarted] = useState(false)

  useEffect(() => {
    // Rien n'est envoyé au serveur sans session (déconnecté).
    void initializeOffline({ canSync: hasStoredToken, dataVersion: OFFLINE_DATA_VERSION }).finally(() => setOfflineStarted(true))
  }, [])

  const ready = fontsLoaded && offlineStarted

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  if (!ready) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <OfflineProvider>
          <AppProvider>
            <ToastProvider>
              <SheetProvider>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="change-password" />
                  <Stack.Screen name="forgot-password" />
                  <Stack.Screen name="comptes" />
                  <Stack.Screen name="chant/[id]" />
                  <Stack.Screen name="initial-sync" options={{ gestureEnabled: false }} />
                  <Stack.Screen name="(tabs)" />
                </Stack>
              </SheetProvider>
            </ToastProvider>
          </AppProvider>
        </OfflineProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
