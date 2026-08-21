import { Redirect } from "expo-router"
import { useApp } from "../context/AppContext"

export default function Index() {
  const { userId } = useApp()
  return <Redirect href={userId ? "/(tabs)" : "/login"} />
}
