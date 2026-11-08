// Outils du répertoire : numéro automatique, lettre d'index et tri alphabétique des chants.

import type { Chant } from "../types"

/**
 * Numéro de chaque chant, dans l'ordre d'ajout au répertoire : « 001 », « 002 »…
 * Ordre = identifiant serveur croissant (le même sur tous les téléphones) ; les chants ajoutés
 * hors ligne, pas encore envoyés (identifiant provisoire négatif), prennent la suite.
 * Clé : identifiant local du chant (stable, même après l'envoi au serveur).
 */
export function numerosChants(chants: Chant[]): Map<string, string> {
  const envoyes = chants.filter((c) => c.id >= 0).sort((a, b) => a.id - b.id)
  // Provisoires : -1, -2, -3… dans l'ordre de création.
  const enAttente = chants.filter((c) => c.id < 0).sort((a, b) => b.id - a.id)
  const largeur = Math.max(3, String(chants.length).length)
  const numeros = new Map<string, string>()
  ;[...envoyes, ...enAttente].forEach((c, i) => numeros.set(cleChant(c), String(i + 1).padStart(largeur, "0")))
  return numeros
}

/** Clé stable d'un chant (favoris, numéros) : identifiant local, sinon identifiant affiché. */
export function cleChant(chant: Chant): string {
  return chant.localId ?? String(chant.id)
}

/** Texte sans accents ni casse, pour comparer et chercher (« À toi » → « a toi »). */
export function sansAccents(texte: string) {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** Lettre d'index d'un titre (A–Z) ; « # » pour un titre qui commence par un chiffre ou un signe. */
export function lettreDe(titre: string): string {
  const premiere = sansAccents(titre.trim()).charAt(0).toUpperCase()
  return premiere >= "A" && premiere <= "Z" ? premiere : "#"
}

/** Tri alphabétique à la française (accents et casse ignorés). */
export function trierParTitre(chants: Chant[]): Chant[] {
  return [...chants].sort((a, b) => a.titre.localeCompare(b.titre, "fr", { sensitivity: "base" }))
}

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
