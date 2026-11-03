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
import { useEffect } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
// @ts-ignore - NativeWind loads this stylesheet at runtime.
import "../global.css"
import "../lib/nativewind-interop"

import { colors } from "../constants/theme"
import { AppProvider } from "../context/AppContext"
import { SheetProvider } from "../context/SheetContext"
import { ToastProvider } from "../context/ToastContext"

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [geistLoaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold })
  const [monoLoaded] = useGeistMono({ GeistMono_400Regular, GeistMono_500Medium, GeistMono_600SemiBold })
  const fontsLoaded = geistLoaded && monoLoaded

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
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
                <Stack.Screen name="(tabs)" />
              </Stack>
            </SheetProvider>
          </ToastProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
