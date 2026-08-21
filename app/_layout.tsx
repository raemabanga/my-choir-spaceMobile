import {
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  useFonts as useFraunces,
} from "@expo-google-fonts/fraunces"
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  useFonts as useInter,
} from "@expo-google-fonts/inter"
import { SpaceMono_400Regular, useFonts as useSpaceMono } from "@expo-google-fonts/space-mono"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useEffect } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
// @ts-ignore - NativeWind loads this stylesheet at runtime.
import "../global.css"

import { AppProvider } from "../context/AppContext"
import { SheetProvider } from "../context/SheetContext"
import { ToastProvider } from "../context/ToastContext"

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [frauncesLoaded] = useFraunces({ Fraunces_600SemiBold, Fraunces_500Medium_Italic })
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_700Bold })
  const [monoLoaded] = useSpaceMono({ SpaceMono_400Regular })

  const fontsLoaded = frauncesLoaded && interLoaded && monoLoaded

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <ToastProvider>
            <SheetProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            </SheetProvider>
          </ToastProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
