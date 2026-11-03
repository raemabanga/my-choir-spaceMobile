// Active `className` (NativeWind) sur les composants tiers utilisés dans l'app.
// Importé une seule fois au démarrage, dans app/_layout.tsx.
import { cssInterop } from "nativewind"
import { SafeAreaView } from "react-native-safe-area-context"

cssInterop(SafeAreaView, { className: "style" })
