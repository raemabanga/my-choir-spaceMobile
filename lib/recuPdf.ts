// Reçu de paiement en PDF (jsPDF), petit coupon 19 × 8 cm, même mise en page que le portail web
// (my-choir-space-FrontOffice, src/lib/pdf.ts). Le fichier est écrit dans le cache du téléphone,
// puis proposé au partage : « Enregistrer dans Fichiers », WhatsApp, e-mail…
// Fonctionne hors connexion : tout est généré sur le téléphone.

import { Directory, File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"
import type { jsPDF as JsPDF } from "jspdf"
import type { Recu } from "../types"

/* ------------------------------------------------------------ Charte ------------------------------------------------------------ */

export type Rgb = [number, number, number]
export const C = {
  navy: [2, 56, 89] as Rgb,
  turquoise: [84, 172, 191] as Rgb,
  pale: [235, 245, 247] as Rgb,
  ink: [15, 27, 45] as Rgb,
  soft: [95, 110, 130] as Rgb,
  ligne: [228, 233, 239] as Rgb,
  alerte: [168, 105, 26] as Rgb,
  succes: [47, 143, 107] as Rgb,
  danger: [176, 58, 46] as Rgb,
  blanc: [255, 255, 255] as Rgb,
  clair: [200, 225, 235] as Rgb,
}

/**
 * Les polices standard du PDF (WinAnsi) n'ont pas les espaces fines insécables
 * de toLocaleString("fr-FR") ni le signe moins typographique : remplacés.
 */
export const t = (s: string) => s.replace(/[   ]/g, " ").replace(/−/g, "-")

export const montantPdf = (n: number) => t(`${Math.abs(n).toLocaleString("fr-FR")} FCFA`)

/* ------------------------------------------------------------ Montant en lettres ------------------------------------------------------------ */

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
]
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"]

function moinsDeCent(n: number): string {
  if (n < 20) return UNITES[n]
  if (n < 70) {
    const d = Math.floor(n / 10)
    const u = n % 10
    if (u === 0) return DIZAINES[d]
    return DIZAINES[d] + (u === 1 ? "-et-un" : "-" + UNITES[u])
  }
  if (n < 80) return n === 71 ? "soixante-et-onze" : "soixante-" + UNITES[n - 60]
  if (n === 80) return "quatre-vingts"
  return "quatre-vingt-" + UNITES[n - 80]
}

function moinsDeMille(n: number): string {
  const c = Math.floor(n / 100)
  const r = n % 100
  if (c === 0) return moinsDeCent(r)
  const centaines = c === 1 ? "cent" : UNITES[c] + "-cent" + (r === 0 ? "s" : "")
  return r === 0 ? centaines : centaines + "-" + moinsDeCent(r)
}

/** Entier en toutes lettres (orthographe rectifiée), comme sur le reçu du web. */
export function enLettres(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return UNITES[0]
  const parts: string[] = []
  const millions = Math.floor(n / 1_000_000)
  const milliers = Math.floor((n % 1_000_000) / 1000)
  const reste = n % 1000
  if (millions) parts.push(moinsDeMille(millions) + (millions > 1 ? "-millions" : "-million"))
  if (milliers) parts.push(milliers === 1 ? "mille" : moinsDeMille(milliers).replace(/(cent|vingt)s$/, "$1") + "-mille")
  if (reste) parts.push(moinsDeMille(reste))
  return parts.join("-")
}

/* ------------------------------------------------------------ Reçu ------------------------------------------------------------ */

export interface RecuPdf {
  choraleNom: string
  /** Numéro du reçu ; null tant que le paiement n'est pas envoyé au serveur. */
  numero: string | null
  choriste: string
  montant: number
  designation: string
  categorie: string
  /** Jour du paiement, déjà formaté (« 20/11/2026 »). */
  datePaiement: string
  mode?: string | null
  auteur: string
}

/** Format d'un reçu : un coupon de 190 × 80 mm, comme sur le portail web. */
const RECU_L = 190
const RECU_H = 80

/** Un reçu seul, sur une petite page à sa taille. */
async function genererPdf(r: RecuPdf): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf")
  const m = 8
  const doc = new jsPDF({ unit: "mm", format: [RECU_L + 2 * m, RECU_H + 2 * m], orientation: "landscape" })
  doc.setProperties({ title: `Reçu ${r.numero ?? "provisoire"}`, subject: "Reçu de paiement", author: r.choraleNom })
  dessinerRecu(doc, r, m, m)
  return doc
}

/**
 * Plusieurs reçus dans un seul PDF : trois par page A4, séparés par des pointillés de découpe
 * (comme le portail web).
 */
export async function genererRecusPdf(recus: RecuPdf[], nom: string): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  doc.setProperties({ title: `Reçus — ${nom}`, subject: "Reçus de paiement", author: recus[0]?.choraleNom ?? "" })
  const largeur = doc.internal.pageSize.getWidth()
  const hauteur = doc.internal.pageSize.getHeight()
  const parPage = 3
  const pages = Math.ceil(recus.length / parPage)
  const x = (largeur - RECU_L) / 2
  const ecart = (hauteur - 2 * 10 - parPage * RECU_H) / (parPage - 1)
  recus.forEach((r, i) => {
    const rang = i % parPage
    if (i > 0 && rang === 0) doc.addPage()
    const y = 10 + rang * (RECU_H + ecart)
    dessinerRecu(doc, r, x, y)
    // Pointillés de découpe sous le coupon (sauf le dernier de la page).
    if (rang < parPage - 1 && i < recus.length - 1) {
      const yc = y + RECU_H + ecart / 2
      doc.setDrawColor(...C.soft)
      doc.setLineWidth(0.2)
      doc.setLineDashPattern([1.5, 1.5], 0)
      doc.line(6, yc, largeur - 6, yc)
      doc.setLineDashPattern([], 0)
    }
    if (rang === parPage - 1 || i === recus.length - 1) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      doc.setTextColor(...C.soft)
      doc.text(t(`${nom} · ${recus.length} reçu${recus.length > 1 ? "s" : ""}`), x, hauteur - 4)
      doc.text(`Page ${Math.floor(i / parPage) + 1} / ${pages}`, x + RECU_L, hauteur - 4, { align: "right" })
    }
  })
  return doc
}

/** Dessine un reçu en coupon, coin supérieur gauche en (x, y). */
function dessinerRecu(doc: JsPDF, r: RecuPdf, x: number, y: number) {
  const W = RECU_L
  const H = RECU_H
  const p = 6 // marge intérieure
  const lettres = enLettres(r.montant)

  // Cadre et bandeau.
  doc.setDrawColor(...C.ligne)
  doc.setLineWidth(0.3)
  doc.setFillColor(...C.blanc)
  doc.roundedRect(x, y, W, H, 2.5, 2.5, "FD")
  doc.setFillColor(...C.navy)
  doc.roundedRect(x, y, W, 14, 2.5, 2.5, "F")
  doc.rect(x, y + 10, W, 4, "F")
  doc.setFillColor(...C.turquoise)
  doc.rect(x, y + 14, W, 0.8, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10.5)
  doc.setTextColor(...C.blanc)
  doc.text(t(r.choraleNom), x + p, y + 6.2)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(...C.clair)
  doc.text("TRÉSORERIE DE LA CHORALE", x + p, y + 10.6)
  doc.text(r.numero ? "REÇU DE PAIEMENT" : "REÇU PROVISOIRE", x + W - p, y + 5.6, { align: "right" })
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...C.blanc)
  doc.text(t(r.numero ? `N° ${r.numero}` : "N° en attente"), x + W - p, y + 10.6, { align: "right" })

  // Colonne de droite : montant et signature.
  const xd = x + W - p - 60
  const yc = y + 20
  doc.setFillColor(...C.pale)
  doc.setDrawColor(...C.turquoise)
  doc.setLineWidth(0.3)
  doc.roundedRect(xd, yc, 60, 22, 1.8, 1.8, "FD")
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(...C.soft)
  doc.text("MONTANT VERSÉ", xd + 4, yc + 5.5)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.setTextColor(...C.navy)
  doc.text(montantPdf(r.montant), xd + 4, yc + 13)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.8)
  doc.setTextColor(...C.soft)
  doc.text(t(r.categorie), xd + 4, yc + 18.5)

  doc.setFontSize(6.5)
  doc.text("LE TRÉSORIER", xd + 30, yc + 30, { align: "center" })
  doc.setDrawColor(...C.soft)
  doc.setLineWidth(0.2)
  doc.setLineDashPattern([0.8, 0.8], 0)
  doc.line(xd + 4, yc + 43, xd + 56, yc + 43)
  doc.setLineDashPattern([], 0)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(...C.ink)
  doc.text(t(r.auteur), xd + 30, yc + 47, { align: "center", maxWidth: 56 })

  // Colonne de gauche : qui, combien en lettres, détails.
  const xg = x + p
  const lg = xd - xg - 6
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(...C.soft)
  doc.text("REÇU DE", xg, yc + 3.5)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...C.ink)
  doc.text(t(r.choriste), xg, yc + 9, { maxWidth: lg })
  doc.setFont("helvetica", "italic")
  doc.setFontSize(7.5)
  doc.setTextColor(...C.soft)
  const enToutesLettres = doc.splitTextToSize(t(`La somme de ${lettres} francs CFA.`), lg) as string[]
  doc.text(enToutesLettres.slice(0, 2), xg, yc + 14)

  const lignes: [string, string][] = [
    ["Motif", r.designation],
    ["Payé le", r.datePaiement],
    ["Mode", r.mode ?? "Non renseigné"],
  ]
  let yl = yc + 25
  for (const [label, valeur] of lignes) {
    doc.setDrawColor(...C.ligne)
    doc.setLineWidth(0.2)
    doc.line(xg, yl - 3.6, xg + lg, yl - 3.6)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...C.soft)
    doc.text(label, xg, yl)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...C.ink)
    const v = doc.splitTextToSize(t(valeur), lg - 24) as string[]
    doc.text(v[0] + (v.length > 1 ? "…" : ""), xg + 24, yl)
    yl += 6
  }

  // Pied du coupon.
  doc.setFontSize(6)
  if (r.numero) {
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...C.soft)
    doc.text("Reçu généré automatiquement — à conserver", xg, y + H - 4)
  } else {
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...C.alerte)
    doc.text("REÇU PROVISOIRE — le numéro sera attribué à l'envoi du paiement au serveur.", xg, y + H - 4)
  }
}


/** Nom de fichier sans accents ni caractères spéciaux. */
export const nomFichier = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

/**
 * Génère le reçu, l'écrit dans le cache du téléphone et ouvre le partage
 * (enregistrer dans Fichiers / Téléchargements, envoyer par WhatsApp ou e-mail…).
 */
/**
 * Écrit le PDF dans le cache du téléphone puis ouvre le partage (enregistrer dans Fichiers /
 * Téléchargements, envoyer par WhatsApp ou e-mail…).
 */
export async function partagerPdf(doc: JsPDF, nom: string, titre: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.")
  const dossier = new Directory(Paths.cache, "pdf")
  if (!dossier.exists) dossier.create({ intermediates: true, idempotent: true })
  const fichier = new File(dossier, `${nomFichier(nom)}.pdf`)
  if (fichier.exists) fichier.delete()
  fichier.create()
  await fichier.write(new Uint8Array(doc.output("arraybuffer")))
  await Sharing.shareAsync(fichier.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: titre })
}

/** Génère le reçu et ouvre le partage. */
export async function telechargerRecuPdf(r: RecuPdf) {
  const doc = await genererPdf(r)
  await partagerPdf(doc, `recu-${r.numero ?? `provisoire-${Date.now()}`}`, `Reçu ${r.numero ?? "provisoire"}`)
}

/** Plusieurs reçus en un PDF (trois par page A4), puis le partage. Un seul : petite page à sa taille. */
export async function telechargerRecusPdf(recus: RecuPdf[], nom: string) {
  if (recus.length === 0) return
  if (recus.length === 1) return telechargerRecuPdf(recus[0])
  const doc = await genererRecusPdf(recus, nom)
  await partagerPdf(doc, `recus-${nom}`, `Reçus — ${nom}`)
}

/** Reçu affiché dans l'app → reçu PDF. */
export function recuPdfDepuis(
  r: Recu,
  contexte: { choraleNom: string; choriste: string; libelleMode: (code: string) => string }
): RecuPdf {
  return {
    choraleNom: contexte.choraleNom,
    numero: r.id === "En attente" ? null : r.id,
    choriste: contexte.choriste,
    montant: r.montant,
    designation: r.label,
    categorie: r.type === "Statutaire" ? "Cotisation statutaire" : "Cotisation événementielle",
    datePaiement: r.date,
    mode: r.mode ? contexte.libelleMode(r.mode) : null,
    auteur: r.enregistrePar,
  }
}
