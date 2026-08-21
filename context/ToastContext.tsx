import React, { createContext, useCallback, useContext, useRef, useState } from "react"
import { Animated, StyleSheet, Text } from "react-native"
import { colors } from "../constants/theme"

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
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, { opacity, transform: [{ translateY }] }]}
      >
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: "50%",
    bottom: 110,
    marginLeft: -140,
    width: 280,
    alignItems: "center",
    backgroundColor: colors.aubergine,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 100,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 80,
  },
  text: {
    color: colors.goldSoft,
    fontFamily: "Inter_700Bold",
    fontSize: 12.5,
    textAlign: "center",
  },
})
