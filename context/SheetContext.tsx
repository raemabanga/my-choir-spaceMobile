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
import { colors } from "../constants/theme"

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
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          </Animated.View>
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            <View style={styles.handle} />
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {content}
            </ScrollView>
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

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(20,13,20,0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "88%",
    backgroundColor: colors.paper,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 20,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 10,
    backgroundColor: "rgba(46,27,51,0.2)",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 4,
  },
})
