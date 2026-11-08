// Lecteur de l'audio d'un chant (ajouté depuis le portail web).
// Premier appui : téléchargement (réseau requis), puis lecture. Ensuite, le fichier reste sur le
// téléphone et se lit même hors connexion.

import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
import { Download, Pause, Play } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { colors } from "../constants/theme"
import { estSurLeTelephone, fichierChantLocal } from "../lib/fichiersChant"
import type { FichierMeta } from "../types"
import { Card, ProgressBar, RowBetween } from "./ui"

/** Secondes → « 2:41 ». */
const duree = (s: number) => {
  if (!Number.isFinite(s) || s <= 0) return "0:00"
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`
}

export function ChantAudio({ chantId, meta }: { chantId: number; meta: FichierMeta }) {
  const player = useAudioPlayer(null)
  const status = useAudioPlayerStatus(player)
  const [charge, setCharge] = useState(false)
  const [telechargement, setTelechargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const surLeTelephone = estSurLeTelephone(chantId, "audio", meta)
  const lireApresChargement = useRef(false)

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

  const pourcent = status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0
  const Icone = telechargement ? null : status.playing ? Pause : charge ? Play : Download

  return (
    <Card>
      <RowBetween>
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          <Pressable
            onPress={basculer}
            disabled={telechargement}
            accessibilityRole="button"
            accessibilityLabel={status.playing ? "Mettre en pause" : charge ? "Écouter l'audio" : "Télécharger et écouter l'audio"}
            hitSlop={6}
            className="h-10 w-10 items-center justify-center rounded-full bg-navy active:opacity-70"
          >
            {Icone ? (
              <Icone size={17} color={colors.goldSoft} fill={Icone === Play ? colors.goldSoft : "transparent"} />
            ) : (
              <ActivityIndicator size="small" color={colors.goldSoft} />
            )}
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="font-sans-bold text-[14px] text-ink">{status.playing ? "Lecture en cours" : "Écouter l'audio"}</Text>
            <Text numberOfLines={1} className="font-sans text-[11.5px] text-ink-light">
              {telechargement ? "Téléchargement…" : charge ? meta.nom : "Touchez pour télécharger (une fois), puis écouter"}
            </Text>
          </View>
        </View>
        <Text className="font-sans text-[12.5px] tabular-nums text-ink-light">
          {duree(status.currentTime)} / {duree(status.duration)}
        </Text>
      </RowBetween>
      <ProgressBar percent={pourcent} />
      {erreur ? <Text className="mt-1 font-sans text-[12px] text-danger">{erreur}</Text> : null}
    </Card>
  )
}
