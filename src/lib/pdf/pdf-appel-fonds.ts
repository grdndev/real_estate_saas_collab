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

export interface AppelFondsPdfData {
  clientNom: string;
  clientAdresse: string[];
  programmeName: string;
  programmeAdresse: string;
  lotReference: string;
  appelLabel: string;
  appelPourcentage: number;
  appelMontant: number;
  logoDataUrl: string | null;
}

const LIGNE = 6;
const LARGEUR_TEXTE = 210 - MARGES.gauche - MARGES.droite;

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

function drawParagraphe(doc: jsPDF, y: number, texte: string) {
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);
  const lignes = doc.splitTextToSize(texte, LARGEUR_TEXTE) as string[];
  doc.text(lignes, MARGES.gauche, y);
  return y + lignes.length * LIGNE + 4;
}

export function generateAppelFondsPdf(data: AppelFondsPdfData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pourcentage = String(data.appelPourcentage).replace(".", ",");

  let y = drawEnTete(doc, data.logoDataUrl);
  y = drawAdresseClient(doc, y, data);

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

  y = drawParagraphe(
    doc,
    y,
    `A ce jour, nous avons atteint le stade d'avancement suivant: ${data.appelLabel}, ` +
      `correspondant à ${pourcentage}% d'appel de fonds au montant de ` +
      `${formatEur(data.appelMontant)} (${montantEnLettres(data.appelMontant)}).`,
  );

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

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Christian VIRAPATRIN, Gérant`, 130, y);

  drawPiedDePage(doc);

  return Buffer.from(doc.output("arraybuffer"));
}
