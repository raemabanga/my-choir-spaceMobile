// Document (partition) et audio d'un chant, ajoutés depuis le portail web.
//
// Téléchargés à la demande avec le jeton (la route l'exige), puis gardés sur le téléphone : une
// fois écouté ou ouvert, le fichier reste disponible hors connexion. Le nom du fichier local
// contient la taille : un fichier remplacé sur le web (autre taille) est retéléchargé.

import { Directory, File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"
import { fichierChantSource } from "./api"
import type { FichierMeta } from "../types"

export type GenreFichierChant = "document" | "audio"

function dossier() {
  const d = new Directory(Paths.cache, "chants")
  if (!d.exists) d.create({ intermediates: true, idempotent: true })
  return d
}

/** Extension du fichier d'origine (« .mp3 », « .pdf »…), utile aux lecteurs du téléphone. */
function extension(nom: string) {
  const i = nom.lastIndexOf(".")
  return i > 0 ? nom.slice(i).replace(/[^.\w]/g, "").slice(0, 8) : ""
}

function fichierLocal(chantId: number, genre: GenreFichierChant, meta: FichierMeta) {
  return new File(dossier(), `${chantId}-${genre}-${meta.taille}${extension(meta.nom)}`)
}

/** Vrai si le fichier est déjà sur le téléphone (utilisable hors connexion). */
export function estSurLeTelephone(chantId: number, genre: GenreFichierChant, meta: FichierMeta) {
  try {
    return fichierLocal(chantId, genre, meta).exists
  } catch {
    return false
  }
}

/** Adresse locale du fichier, téléchargé d'abord s'il n'est pas encore sur le téléphone. */
export async function fichierChantLocal(chantId: number, genre: GenreFichierChant, meta: FichierMeta): Promise<string> {
  const cible = fichierLocal(chantId, genre, meta)
  if (cible.exists) return cible.uri

  // Anciennes versions de ce fichier (remplacé sur le web) : effacées.
  for (const element of dossier().list()) {
    if (element instanceof File && element.name.startsWith(`${chantId}-${genre}-`)) element.delete()
  }

  const source = await fichierChantSource(chantId, genre)
  let telecharge: File
  try {
    telecharge = await File.downloadFileAsync(source.uri, cible, { headers: source.headers ?? {}, idempotent: true })
  } catch {
    throw new Error("Téléchargement impossible : vérifiez votre connexion internet.")
  }
  // Réponse d'erreur enregistrée à la place du fichier (taille différente) : on n'en garde rien.
  if (!telecharge.exists || telecharge.size !== meta.taille) {
    if (telecharge.exists) telecharge.delete()
    throw new Error("Le fichier n'a pas pu être récupéré. Réessayez plus tard.")
  }
  return telecharge.uri
}

/** Ouvre le document (PDF, image, Word) avec une application du téléphone. */
export async function ouvrirDocumentChant(chantId: number, meta: FichierMeta) {
  const uri = await fichierChantLocal(chantId, "document", meta)
  if (!(await Sharing.isAvailableAsync())) throw new Error("L'ouverture de fichiers n'est pas disponible sur cet appareil.")
  await Sharing.shareAsync(uri, { mimeType: meta.type, dialogTitle: meta.nom })
}
