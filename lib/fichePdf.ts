// Fiche d'un choriste en PDF (jsPDF + jspdf-autotable) : identité, fiche d'inscription et dettes.
// Même mise en page que le portail web (my-choir-space-FrontOffice, src/lib/pdf.ts). Générée sur le
// téléphone (marche hors ligne), puis proposée au partage.
import type { jsPDF as JsPDF } from "jspdf"
import type { UserOptions } from "jspdf-autotable"
import { C, montantPdf, partagerPdf, t } from "./recuPdf"

export interface FicheChoristePdf {
  choraleNom: string
  nom: string
  /** Coordonnées, rôles, statut… (libellé, valeur). */
  identite: [string, string][]
  /** Lignes renseignées de la fiche d'inscription. */
  fiche: [string, string][]
  /** null : cotisations non visibles pour ce rôle (la section l'indique). */
  dettes: { libelle: string; detail: string; montant: number }[] | null
}

const MARGE = 14

export async function genererFichePdf(f: FicheChoristePdf): Promise<JsPDF> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
  const at = autoTable as (doc: JsPDF, options: UserOptions) => void
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const largeur = doc.internal.pageSize.getWidth()
  const hauteur = doc.internal.pageSize.getHeight()
  const genereLe = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
  doc.setProperties({ title: `Fiche — ${f.nom}`, subject: "Fiche du choriste", author: f.choraleNom })

  // Bandeau.
  doc.setFillColor(...C.navy)
  doc.rect(0, 0, largeur, 32, "F")
  doc.setFillColor(...C.turquoise)
  doc.rect(0, 32, largeur, 1.2, "F")
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...C.clair)
  doc.text(t(f.choraleNom.toUpperCase()), MARGE, 11)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(17)
  doc.setTextColor(...C.blanc)
  doc.text(t(f.nom), MARGE, 20, { maxWidth: largeur - 2 * MARGE - 50 })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...C.clair)
  doc.text("FICHE DU CHORISTE", largeur - MARGE, 11, { align: "right" })
  doc.text(t(`Éditée le ${genereLe}`), largeur - MARGE, 20, { align: "right" })

  let y = 44
  const fin = () => ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 9

  const titre = (texte: string) => {
    if (y > hauteur - 40) {
      doc.addPage()
      y = 20
    }
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(...C.navy)
    doc.text(t(texte), MARGE, y)
    doc.setDrawColor(...C.turquoise)
    doc.setLineWidth(0.5)
    doc.line(MARGE, y + 1.8, MARGE + 14, y + 1.8)
    y += 5
  }

  const tableauCleValeur = (lignes: [string, string][]) => {
    at(doc, {
      theme: "plain",
      startY: y,
      margin: { left: MARGE, right: MARGE, bottom: 18 },
      styles: { font: "helvetica", fontSize: 9.5, textColor: C.ink, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } },
      columnStyles: { 0: { cellWidth: 52, textColor: C.soft }, 1: { fontStyle: "bold" } },
      alternateRowStyles: { fillColor: C.pale },
      body: lignes.map(([l, v]) => [t(l), t(v)]),
    })
    y = fin()
  }

  titre("Identité")
  tableauCleValeur(f.identite)

  titre("Fiche d'inscription")
  if (f.fiche.length) tableauCleValeur(f.fiche)
  else {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(9.5)
    doc.setTextColor(...C.soft)
    doc.text("Fiche non renseignée.", MARGE, y + 3)
    y += 12
  }

  // Dettes d'un seul tenant quand elles tiennent sur une page : sinon la section commence page suivante.
  const hauteurDettes = 12 + (f.dettes?.length ? 22 + 8.2 * (f.dettes.length + 2) : 14)
  if (y + hauteurDettes > hauteur - 20 && hauteurDettes < hauteur - 40) {
    doc.addPage()
    y = 20
  }
  titre("Dettes")
  if (f.dettes === null) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(9.5)
    doc.setTextColor(...C.soft)
    doc.text("Cotisations non consultables avec ce rôle.", MARGE, y + 3)
    y += 12
  } else if (f.dettes.length === 0) {
    doc.setFillColor(232, 245, 239)
    doc.setDrawColor(...C.succes)
    doc.setLineWidth(0.3)
    doc.roundedRect(MARGE, y, largeur - 2 * MARGE, 12, 2, 2, "FD")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(...C.succes)
    doc.text("Aucune dette : ce choriste est à jour de ses cotisations.", MARGE + 5, y + 7.6)
    y += 20
  } else {
    const total = f.dettes.reduce((s, d) => s + d.montant, 0)
    // Total mis en avant.
    doc.setFillColor(251, 236, 236)
    doc.setDrawColor(...C.danger)
    doc.setLineWidth(0.3)
    doc.roundedRect(MARGE, y, largeur - 2 * MARGE, 16, 2, 2, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...C.soft)
    doc.text(t(`TOTAL DÛ · ${f.dettes.length} ÉCHÉANCE${f.dettes.length > 1 ? "S" : ""} EN RETARD`), MARGE + 5, y + 6)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(...C.danger)
    doc.text(montantPdf(total), MARGE + 5, y + 12.8)
    y += 22
    at(doc, {
      theme: "grid",
      startY: y,
      margin: { left: MARGE, right: MARGE, bottom: 18 },
      styles: { font: "helvetica", fontSize: 9, textColor: C.ink, lineColor: C.ligne, lineWidth: 0.2, cellPadding: 2.2 },
      headStyles: { fillColor: C.navy, textColor: C.blanc, fontStyle: "bold", fontSize: 8.5 },
      footStyles: { fillColor: C.pale, textColor: C.ink, fontStyle: "bold" },
      head: [["Échéance", "Détail", { content: "Montant dû", styles: { halign: "right" } }]],
      body: f.dettes.map((d) => [t(d.libelle), t(d.detail), { content: montantPdf(d.montant), styles: { halign: "right", textColor: C.danger } }]),
      foot: [[{ content: "Total", colSpan: 2 }, { content: montantPdf(total), styles: { halign: "right" } }]],
      showFoot: "lastPage",
      columnStyles: { 2: { cellWidth: 36 } },
    })
    y = fin()
  }

  // Pied de page sur chaque page.
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...C.ligne)
    doc.setLineWidth(0.3)
    doc.line(MARGE, hauteur - 13, largeur - MARGE, hauteur - 13)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...C.soft)
    doc.text(t(`${f.choraleNom} · Fiche de ${f.nom} · document confidentiel`), MARGE, hauteur - 8)
    doc.text(`Page ${i} / ${pages}`, largeur - MARGE, hauteur - 8, { align: "right" })
  }
  return doc
}

/** Génère la fiche et ouvre le partage. */
export async function telechargerFichePdf(f: FicheChoristePdf) {
  const doc = await genererFichePdf(f)
  await partagerPdf(doc, `fiche-${f.nom}`, `Fiche de ${f.nom}`)
}
