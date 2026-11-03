# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v58.0.0/ before writing any code.

This project runs Expo SDK 58 (upgraded 2026-10-27 from SDK 57, itself upgraded 2026-08-21 from SDK 54): React Native 0.88, React 19.3, react-native-gesture-handler 3. Notable schema changes from SDK 54: no more top-level `splash` in app.json (use the `expo-splash-screen` plugin config), no more `newArchEnabled` (New Architecture is mandatory), no more `android.edgeToEdgeEnabled` (edge-to-edge is always on).

`.npmrc` sets `legacy-peer-deps=true`: `@react-native-community/datetimepicker` lists `react-native-windows` as an optional peer, which lags behind the SDK's React Native version and otherwise blocks `npm install`.
