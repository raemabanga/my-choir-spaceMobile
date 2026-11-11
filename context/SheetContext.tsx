import React, { createContext, useCallback, useContext, useRef, useState } from "react"
import { Animated, Dimensions, Easing, Pressable, StyleSheet, useWindowDimensions, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { KeyboardAwareScrollView, useKeyboardOverlap } from "../components/keyboard"
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
      {visible && <SheetLayer backdropOpacity={backdropOpacity} translateY={translateY} onClose={closeSheet} content={content} />}
    </SheetContext.Provider>
  )
}

/**
 * Voile + panneau. Clavier ouvert : le panneau remonte de la hauteur qu'il recouvre (mesurée,
 * pour ne pas doubler quand Android a déjà réduit la fenêtre) et le champ actif reste visible.
 */
function SheetLayer({
  backdropOpacity,
  translateY,
  onClose,
  content,
}: {
  backdropOpacity: Animated.Value
  translateY: Animated.Value
  onClose: () => void
  content: React.ReactNode
}) {
  const layer = useRef<React.ComponentRef<typeof View>>(null)
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const { overlap } = useKeyboardOverlap(layer)
  // Hauteur max : 88 % de l'écran, ou ce qui reste au-dessus du clavier (sous la barre d'état).
  const maxHeight = overlap > 0 ? windowHeight - overlap - insets.top - 12 : windowHeight * 0.88

  return (
    <View ref={layer} className="absolute inset-0 items-center justify-end" pointerEvents="box-none">
      {/* Voile (.sheet-overlay) : l'opacité animée reste en style. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
        <Pressable className="absolute inset-0 bg-overlay" onPress={onClose} accessibilityLabel="Fermer le panneau" />
      </Animated.View>
      {/* Panneau (.sheet) : fond surface, rayon haut 26 ; translation animée en style. */}
      <Animated.View style={[{ width: "100%", maxWidth: 640, maxHeight, marginBottom: overlap, transform: [{ translateY }] }, shadows.sheet]}>
        <View className="shrink rounded-t-sheet bg-surface">
          <View className="mb-3.5 mt-4 h-1 w-[38px] self-center rounded-[10px] bg-handle" />
          {/* Le panneau remonte déjà au-dessus du clavier : pas de place à ajouter en bas. */}
          <KeyboardAwareScrollView keyboardPadding={false} contentContainerClassName="px-5 pb-[30px]" showsVerticalScrollIndicator={false}>
            {content}
          </KeyboardAwareScrollView>
        </View>
      </Animated.View>
    </View>
  )
}

export function useSheet() {
  const ctx = useContext(SheetContext)
  if (!ctx) throw new Error("useSheet must be used within SheetProvider")
  return ctx
}

