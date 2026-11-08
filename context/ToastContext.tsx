import React, { createContext, useCallback, useContext, useRef, useState } from "react"
import { Animated, Text, View } from "react-native"
import { shadows } from "../constants/theme"

interface ToastContextValue {
  toast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("")
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(10)).current
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback(
    (msg: string) => {
      setMessage(msg)
      if (hideTimeout.current) clearTimeout(hideTimeout.current)
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start()
      hideTimeout.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 10, duration: 250, useNativeDriver: true }),
        ]).start()
      }, 2200)
    },
    [opacity, translateY]
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast : carte blanche, bordure fine, ombre md, au-dessus de la barre de navigation.
          Sans icône : le même toast sert aux confirmations et aux erreurs.
          Position et animation en style (Animated), apparence en classes. */}
      <Animated.View
        pointerEvents="none"
        accessibilityLiveRegion="polite"
        style={{ position: "absolute", left: 16, right: 16, bottom: 104, alignItems: "center", zIndex: 80, opacity, transform: [{ translateY }] }}
      >
        <View className="max-w-[420px] rounded-row border border-line bg-paper px-4 py-3" style={shadows.toast}>
          <Text className="text-center font-sans-medium text-[13.5px] text-ink">{message}</Text>
        </View>
      </Animated.View>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

