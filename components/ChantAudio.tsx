// Lecteur de l'audio d'un chant, façon « mini-lecteur » : barre fixe en bas de l'écran, qui
// reste visible pendant qu'on fait défiler les paroles (pause, ±10 s, déplacement dans le morceau).
// Premier appui sur lecture : téléchargement (réseau requis), puis lecture. Ensuite, le fichier
// reste sur le téléphone et se lit même hors connexion.

import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
import { LinearGradient } from "expo-linear-gradient"
import { Download, Music, Pause, Play, RotateCcw, RotateCw } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, GestureResponderEvent, Pressable, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors, shadows } from "../constants/theme"
import { estSurLeTelephone, fichierChantLocal } from "../lib/fichiersChant"
import type { FichierMeta } from "../types"

/** Secondes → « 2:41 ». */
const duree = (s: number) => {
  if (!Number.isFinite(s) || s <= 0) return "0:00"
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`
}

const SAUT = 10

export function ChantAudio({
  chantId,
  meta,
  titre,
  sousTitre,
}: {
  chantId: number
  meta: FichierMeta
  /** Titre du chant, affiché dans le lecteur. */
  titre: string
  /** Ligne sous le titre (auteur…). */
  sousTitre?: string
}) {
  const player = useAudioPlayer(null)
  const status = useAudioPlayerStatus(player)
  const insets = useSafeAreaInsets()
  const [charge, setCharge] = useState(false)
  const [telechargement, setTelechargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const surLeTelephone = estSurLeTelephone(chantId, "audio", meta)
  const lireApresChargement = useRef(false)

  // Barre de progression : largeur mesurée, et position suivie au doigt pendant le glissement.
  const [largeurBarre, setLargeurBarre] = useState(0)
  const [glisse, setGlisse] = useState<number | null>(null)

  // Lecture même téléphone en silencieux (comme un lecteur de musique).
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
  }, [])

  // Fichier déjà sur le téléphone : prêt à lire tout de suite (aussi hors connexion).
  useEffect(() => {
    setCharge(false)
    setErreur(null)
    if (!surLeTelephone) return
    fichierChantLocal(chantId, "audio", meta)
      .then((uri) => {
        player.replace({ uri })
        setCharge(true)
      })
      .catch((e: Error) => setErreur(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantId, meta.taille, meta.nom])

  // Lecture demandée pendant le téléchargement : elle démarre dès que le son est prêt.
  useEffect(() => {
    if (lireApresChargement.current && status.isLoaded) {
      lireApresChargement.current = false
      player.play()
    }
  }, [status.isLoaded, player])

  async function basculer() {
    setErreur(null)
    if (status.playing) {
      player.pause()
      return
    }
    if (!charge) {
      setTelechargement(true)
      try {
        const uri = await fichierChantLocal(chantId, "audio", meta)
        lireApresChargement.current = true
        player.replace({ uri })
        setCharge(true)
      } catch (e) {
        setErreur((e as Error).message)
      } finally {
        setTelechargement(false)
      }
      return
    }
    // Arrivé à la fin : on repart du début.
    if (status.duration > 0 && status.currentTime >= status.duration - 0.25) await player.seekTo(0)
    player.play()
  }

  const pret = charge && status.duration > 0
  const sauter = (delta: number) => {
    if (!pret) return
    player.seekTo(Math.min(Math.max(status.currentTime + delta, 0), status.duration))
  }

  // Position (0 → 1) sous le doigt.
  const ratioDepuis = (e: GestureResponderEvent) => (largeurBarre > 0 ? Math.min(Math.max(e.nativeEvent.locationX / largeurBarre, 0), 1) : 0)
  const ratio = glisse ?? (status.duration > 0 ? Math.min(status.currentTime / status.duration, 1) : 0)
  const tempsAffiche = glisse !== null ? glisse * status.duration : status.currentTime

  const Icone = telechargement ? null : status.playing ? Pause : charge ? Play : Download
  const ligne2 = erreur ?? (telechargement ? "Téléchargement…" : !charge ? "Touchez lecture pour télécharger l'audio" : sousTitre || meta.nom)

  return (
    // Hors de la ScrollView : la barre reste en bas pendant le défilement des paroles.
    <View className="border-t border-line bg-surface px-3 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 8) + 4 }}>
      <LinearGradient
        colors={[colors.luna700, colors.luna900]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ borderRadius: 16, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }, shadows.toast]}
      >
        <View className="flex-row items-center gap-3">
          {/* Pochette */}
          <LinearGradient
            colors={[colors.luna500, colors.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 46, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
          >
            <Music size={22} color={colors.paper} strokeWidth={2} />
          </LinearGradient>

          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="font-sans-semibold text-[15px] text-paper">
              {titre}
            </Text>
            <Text numberOfLines={1} className={erreur ? "font-sans text-[12px] text-[#ffb4b4]" : "font-sans text-[12px] text-on-navy-muted"}>
              {ligne2}
            </Text>
          </View>

          <Pressable
            onPress={() => sauter(-SAUT)}
            disabled={!pret}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Reculer de 10 secondes"
            className="h-9 w-9 items-center justify-center rounded-full active:opacity-60"
            style={{ opacity: pret ? 1 : 0.4 }}
          >
            <RotateCcw size={19} color={colors.paper} strokeWidth={2} />
          </Pressable>

          <Pressable
            onPress={basculer}
            disabled={telechargement}
            accessibilityRole="button"
            accessibilityLabel={status.playing ? "Mettre en pause" : charge ? "Lire l'audio" : "Télécharger et lire l'audio"}
            hitSlop={6}
            className="h-12 w-12 items-center justify-center rounded-full bg-paper active:opacity-80"
          >
            {Icone ? (
              <Icone size={20} color={colors.luna900} fill={Icone === Download ? "transparent" : colors.luna900} strokeWidth={Icone === Download ? 2.2 : 0} />
            ) : (
              <ActivityIndicator size="small" color={colors.luna900} />
            )}
          </Pressable>

          <Pressable
            onPress={() => sauter(SAUT)}
            disabled={!pret}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Avancer de 10 secondes"
            className="h-9 w-9 items-center justify-center rounded-full active:opacity-60"
            style={{ opacity: pret ? 1 : 0.4 }}
          >
            <RotateCw size={19} color={colors.paper} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Progression : toucher ou glisser pour se déplacer dans le morceau. */}
        <View className="mt-2.5 flex-row items-center gap-2.5">
          <Text className="w-9 font-sans text-[11px] tabular-nums text-on-navy-muted">{duree(tempsAffiche)}</Text>
          <View
            className="h-6 flex-1 justify-center"
            onLayout={(e) => setLargeurBarre(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => pret}
            onMoveShouldSetResponder={() => pret}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(e) => setGlisse(ratioDepuis(e))}
            onResponderMove={(e) => setGlisse(ratioDepuis(e))}
            onResponderRelease={(e) => {
              const r = ratioDepuis(e)
              setGlisse(null)
              player.seekTo(r * status.duration)
            }}
            onResponderTerminate={() => setGlisse(null)}
            accessibilityRole="adjustable"
            accessibilityLabel="Position dans l'audio"
            accessibilityValue={{ min: 0, max: Math.round(status.duration), now: Math.round(tempsAffiche), text: `${duree(tempsAffiche)} sur ${duree(status.duration)}` }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(e) => sauter(e.nativeEvent.actionName === "increment" ? SAUT : -SAUT)}
          >
            <View className="h-[4px] overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.22)" }}>
              <View className="h-full rounded-full bg-gold" style={{ width: `${ratio * 100}%` }} />
            </View>
            {/* Curseur */}
            <View
              pointerEvents="none"
              className="absolute h-3.5 w-3.5 rounded-full bg-paper"
              style={{ left: Math.max(ratio * largeurBarre - 7, -7), opacity: pret ? 1 : 0 }}
            />
          </View>
          <Text className="w-9 text-right font-sans text-[11px] tabular-nums text-on-navy-muted">{duree(status.duration)}</Text>
        </View>
      </LinearGradient>
    </View>
  )
}
