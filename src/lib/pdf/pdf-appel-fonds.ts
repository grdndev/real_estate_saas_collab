import { jsPDF } from "jspdf";

import {
  COULEURS,
  MARGES,
  SOCIETE,
  drawEnTete,
  drawPiedDePage,
  formatDateFr,
  formatEur,
} from "./letterhead";
import { montantEnLettres } from "./montant-en-lettres";

/** Données nécessaires au courrier « Appel de fonds ». */
export interface AppelFondsPdfData {
  /** Nom complet du client destinataire. */
  clientNom: string;
  /** Adresse postale du client (déjà déchiffrée), ligne par ligne. */
  clientAdresse: string[];
  programmeName: string;
  programmeAdresse: string;
  /** Référence du lot concerné. */
  lotReference: string;
  /** Libellé de l'appel de fonds (ex : "Achèvement des fondations"). */
  appelLabel: string;
  /** Pourcentage du prix appelé (ex : 35). */
  appelPourcentage: number;
  /** Montant appelé en euros. */
  appelMontant: number;
  /** Logo société (data URL) affiché en en-tête à la place du texte, si défini. */
  logoDataUrl: string | null;
}

// Interligne du courrier (en mm).
const LIGNE = 6;
// Largeur utile du texte.
const LARGEUR_TEXTE = 210 - MARGES.gauche - MARGES.droite;

/** Bloc adresse du client, aligné à droite comme sur un courrier papier. */
function drawAdresseClient(doc: jsPDF, y: number, data: AppelFondsPdfData) {
  const x = 120;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);
  doc.text(data.clientNom, x, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  for (const ligne of data.clientAdresse) {
    doc.text(ligne, x, y);
    y += 5;
  }

  y += 6;
  doc.text(`Le ${formatDateFr(new Date())}`, x, y);
  return y + 14;
}

/** Écrit un paragraphe justifié à gauche et retourne le Y suivant. */
function drawParagraphe(doc: jsPDF, y: number, texte: string) {
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);
  const lignes = doc.splitTextToSize(texte, LARGEUR_TEXTE) as string[];
  doc.text(lignes, MARGES.gauche, y);
  return y + lignes.length * LIGNE + 4;
}

/**
 * Génère le courrier « Appel de fonds » (A4 portrait), destiné au client du lot.
 */
export function generateAppelFondsPdf(data: AppelFondsPdfData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pourcentage = String(data.appelPourcentage).replace(".", ",");

  let y = drawEnTete(doc, data.logoDataUrl);
  y = drawAdresseClient(doc, y, data);

  // Objet du courrier.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);
  y = drawParagraphe(
    doc,
    y,
    `Objet : Appel de fonds ${pourcentage} - ${data.appelLabel} - Lot ${data.lotReference} ${data.programmeName}`,
  );

  doc.setFont("helvetica", "normal");
  y += 4;

  y = drawParagraphe(doc, y, "Madame, Monsieur,");

  // Corps du courrier : lot, appel, pourcentage.
  y = drawParagraphe(
    doc,
    y,
    `A ce jour, nous avons atteint le stade d'avancement suivant: ${data.appelLabel}, ` +
      `correspondant à ${pourcentage}% d'appel de fonds au montant de ` +
      `${formatEur(data.appelMontant)} (${montantEnLettres(data.appelMontant)}).`,
  );

  // Montant en chiffres ET en toutes lettres.
  y = drawParagraphe(
    doc,
    y,
    `Je vous prie de trouver ci-joint l'attesation transmise par le Maître d'oeuvre: ` +
      `Charles MORIN, gérant de la société I2C (en charge du projet ${data.programmeName}, situé au ${data.programmeAdresse}).`,
  );

  y = drawParagraphe(
    doc,
    y,
    `Je vous prie de trouver ci-joint, le RIB du compte promotion "${data.programmeName}" de la société` +
      "Domaine de la Réunion sur lequel vous devrez réaliser votre prochain versement.",
  );

  y = drawParagraphe(
    doc,
    y,
    "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations les meilleures.",
  );

  // Signature.
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Christian VIRAPATRIN, Gérant`, 130, y);

  drawPiedDePage(doc);

  return Buffer.from(doc.output("arraybuffer"));
}
