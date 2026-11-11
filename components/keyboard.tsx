// Clavier : le garder hors des champs et des boutons, et pouvoir le fermer facilement.
// - KeyboardToolbar : barre « OK » au-dessus du clavier sur iPhone (les claviers numériques
//   n'y ont pas de touche pour se fermer). À rendre une seule fois, à la racine.
// - useKeyboardOverlap : de combien le clavier recouvre une vue (0 s'il ne la recouvre pas,
//   par exemple quand Android a déjà redimensionné la fenêtre).
// - KeyboardAwareScrollView : ScrollView qui laisse la place du clavier, remonte le champ en
//   cours de saisie et ferme le clavier quand on fait glisser la liste.

import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  InputAccessoryView,
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewProps,
  Text,
  TextInput,
  View,
} from "react-native"

type ScrollRef = React.ComponentRef<typeof ScrollView>
type ViewRef = React.ComponentRef<typeof View>

/** `inputAccessoryViewID` des champs : barre « OK » sur iPhone. */
export const KEYBOARD_TOOLBAR_ID = "clavier-ok"
export const keyboardToolbarProps = Platform.OS === "ios" ? { inputAccessoryViewID: KEYBOARD_TOOLBAR_ID } : {}

/** Marge laissée entre le champ en cours de saisie et le haut du clavier. */
const MARGE = 24

export function KeyboardToolbar() {
  if (Platform.OS !== "ios") return null
  return (
    <InputAccessoryView nativeID={KEYBOARD_TOOLBAR_ID}>
      <View className="flex-row items-center justify-end border-t border-line bg-surface-soft px-3 py-1.5">
        <Pressable
          onPress={() => Keyboard.dismiss()}
          accessibilityRole="button"
          accessibilityLabel="Fermer le clavier"
          hitSlop={8}
          className="min-h-[36px] justify-center rounded-full px-4 active:opacity-60"
        >
          <Text className="font-sans-semibold text-[15px] text-navy">OK</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  )
}

const SHOW = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
const HIDE = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"

/** Haut du clavier dans la fenêtre (null quand il est fermé). */
export function useKeyboardTop() {
  const [top, setTop] = useState<number | null>(null)
  useEffect(() => {
    const show = Keyboard.addListener(SHOW, (e: KeyboardEvent) => setTop(e.endCoordinates.screenY))
    const hide = Keyboard.addListener(HIDE, () => setTop(null))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return top
}

/**
 * Partie de la vue `ref` recouverte par le clavier, en points (0 quand il est fermé ou ne la
 * recouvre pas). Mesurée plutôt que supposée : sur Android, la fenêtre peut déjà s'être réduite.
 */
export function useKeyboardOverlap(ref: React.RefObject<ViewRef | ScrollRef | null>) {
  const keyboardTop = useKeyboardTop()
  const [overlap, setOverlap] = useState(0)
  useEffect(() => {
    if (keyboardTop === null) {
      setOverlap(0)
      return
    }
    const node = ref.current as unknown as ViewRef | null
    node?.measureInWindow((_x, y, _w, h) => setOverlap(Math.max(0, y + h - keyboardTop)))
  }, [keyboardTop, ref])
  return { overlap, keyboardTop }
}

/** Remonte le champ en cours de saisie s'il est sous le clavier (ou trop près). */
function remonterChampActif(scroll: ScrollRef | null, scrollY: number, keyboardTop: number) {
  const champ = TextInput.State.currentlyFocusedInput() as unknown as ViewRef | null
  if (!scroll || !champ) return
  champ.measureInWindow((_x, y, _w, h) => {
    const depassement = y + h + MARGE - keyboardTop
    if (depassement > 0) scroll.scrollTo({ y: scrollY + depassement, animated: true })
  })
}

/**
 * ScrollView pour les écrans et panneaux qui contiennent des champs.
 * `keyboardPadding` : ajoute en bas la place du clavier qui recouvre la liste (à couper quand
 * le conteneur remonte déjà au-dessus du clavier, comme le panneau du bas).
 */
export function KeyboardAwareScrollView({
  ref,
  keyboardPadding = true,
  contentContainerStyle,
  onScroll,
  children,
  ...props
}: ScrollViewProps & { ref?: React.Ref<ScrollRef>; keyboardPadding?: boolean }) {
  const inner = useRef<ScrollRef | null>(null)
  const scrollY = useRef(0)
  const { overlap, keyboardTop } = useKeyboardOverlap(inner)

  const setRef = useCallback(
    (node: ScrollRef | null) => {
      inner.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.RefObject<ScrollRef | null>).current = node
    },
    [ref]
  )

  // Clavier ouvert (ou autre champ choisi pendant qu'il est ouvert) : le champ reste visible.
  useEffect(() => {
    if (keyboardTop === null) return
    // Après la mise en page (place du clavier ajoutée) et l'animation du clavier.
    const t = setTimeout(() => remonterChampActif(inner.current, scrollY.current, keyboardTop), Platform.OS === "ios" ? 60 : 120)
    return () => clearTimeout(t)
  }, [keyboardTop, overlap])

  // Autre champ touché pendant que le clavier est ouvert.
  const keyboardTopRef = useRef(keyboardTop)
  keyboardTopRef.current = keyboardTop
  useEffect(() => {
    const f = () =>
      setTimeout(() => {
        if (keyboardTopRef.current !== null) remonterChampActif(inner.current, scrollY.current, keyboardTopRef.current)
      }, 80)
    abonnesFocus.add(f)
    return () => {
      abonnesFocus.delete(f)
    }
  }, [])

  return (
    <ScrollView
      ref={setRef}
      keyboardShouldPersistTaps="handled"
      // Faire glisser la liste ferme le clavier (sur iPhone : en le suivant du doigt).
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      scrollEventThrottle={16}
      onScroll={(e) => {
        scrollY.current = e.nativeEvent.contentOffset.y
        onScroll?.(e)
      }}
      contentContainerStyle={contentContainerStyle}
      {...props}
    >
      {children}
      {/* Place du clavier : on peut faire défiler jusqu'au dernier champ. */}
      {keyboardPadding && overlap > 0 ? <View style={{ height: overlap + MARGE }} /> : null}
    </ScrollView>
  )
}

/* Un champ prend le focus alors que le clavier est déjà ouvert : Android ne renvoie pas
   d'événement clavier ; les champs (Field, SearchBar) le signalent ici. */
const abonnesFocus = new Set<() => void>()
export function signalerFocusChamp() {
  abonnesFocus.forEach((f) => f())
}
