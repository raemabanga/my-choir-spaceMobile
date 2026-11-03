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
      {/* Toast (.toast) : pilule navy, texte or pâle, au-dessus de la barre de navigation.
          Position et animation en style (Animated), apparence en classes. */}
      <Animated.View
        pointerEvents="none"
        accessibilityLiveRegion="polite"
        style={{ position: "absolute", left: 20, right: 20, bottom: 104, alignItems: "center", zIndex: 80, opacity, transform: [{ translateY }] }}
      >
        <View className="rounded-full bg-navy px-[18px] py-2.5" style={shadows.toast}>
          <Text className="text-center font-sans-semibold text-[12.5px] text-gold-soft">{message}</Text>
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

