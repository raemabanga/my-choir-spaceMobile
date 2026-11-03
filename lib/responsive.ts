import { useWindowDimensions } from "react-native"

/** Points de rupture : petit téléphone (< 360), téléphone, tablette (≥ 700). */
export function useResponsive() {
  const { width } = useWindowDimensions()
  const compact = width < 360
  const tablet = width >= 700
  return {
    width,
    compact,
    tablet,
    gutter: compact ? 14 : tablet ? 28 : 18,
    maxWidth: tablet ? 760 : undefined,
  }
}
