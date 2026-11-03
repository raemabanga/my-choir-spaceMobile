import React, { createContext, useCallback, useContext, useRef, useState } from "react"
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { shadows } from "../constants/theme"

interface SheetContextValue {
  openSheet: (content: React.ReactNode) => void
  closeSheet: () => void
}

const SheetContext = createContext<SheetContextValue | null>(null)

const SCREEN_HEIGHT = Dimensions.get("window").height

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [content, setContent] = useState<React.ReactNode>(null)
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current

  const openSheet = useCallback(
    (node: React.ReactNode) => {
      setContent(node)
      setVisible(true)
      translateY.setValue(60)
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()
    },
    [backdropOpacity, translateY]
  )

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 60, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false)
      setContent(null)
    })
  }, [backdropOpacity, translateY])

  return (
    <SheetContext.Provider value={{ openSheet, closeSheet }}>
      {children}
      {visible && (
        <View className="absolute inset-0 items-center justify-end" pointerEvents="box-none">
          {/* Voile (.sheet-overlay) : l'opacité animée reste en style. */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
            <Pressable className="absolute inset-0 bg-overlay" onPress={closeSheet} accessibilityLabel="Fermer le panneau" />
          </Animated.View>
          {/* Panneau (.sheet) : fond surface, rayon haut 26 ; translation animée en style. */}
          <Animated.View style={[{ width: "100%", maxWidth: 640, maxHeight: "88%", transform: [{ translateY }] }, shadows.sheet]}>
            <View className="shrink rounded-t-sheet bg-surface">
              <View className="mb-3.5 mt-4 h-1 w-[38px] self-center rounded-[10px] bg-handle" />
              <ScrollView contentContainerClassName="px-5 pb-[30px]" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {content}
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      )}
    </SheetContext.Provider>
  )
}

export function useSheet() {
  const ctx = useContext(SheetContext)
  if (!ctx) throw new Error("useSheet must be used within SheetProvider")
  return ctx
}

