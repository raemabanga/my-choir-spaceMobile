import { Redirect } from "expo-router"
import { useApp } from "../context/AppContext"

export default function Index() {
  const { userId, session, authReady } = useApp()
  // Attend la relecture de la session enregistrée (évite un passage éclair par la connexion).
  if (!authReady) return null
  if (session?.doitChangerMotDePasse) return <Redirect href="/change-password" />
  return <Redirect href={userId ? "/(tabs)" : "/login"} />
}
