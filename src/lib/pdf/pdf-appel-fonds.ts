import { jsPDF } from "jspdf";

import {
  BANDEAU_HAUTEUR,
  COULEURS,
  MARGES,
  SOCIETE_PROMOTEUR,
  drawBandeauPromoteur,
  drawEnTete,
  formatDateFr,
  formatEur,
} from "./letterhead";
import { montantEnLettres } from "./montant-en-lettres";

export interface AppelFondsPdfData {
  clientNom: string;
  clientAdresse: string[];
  /** Emails des acquéreurs, affichés sous l'adresse comme sur le modèle. */
  clientEmails: string[];
  programmeName: string;
  programmeAdresse: string;
  lotReference: string;
  appelLabel: string;
  appelPourcentage: number;
  appelMontant: number;
  logoDataUrl: string | null;
}

const LIGNE = 5;
const LARGEUR_TEXTE = 210 - MARGES.gauche - MARGES.droite;
/** Colonne du bloc destinataire et de la signature. */
const COLONNE_DROITE = 115;
/** Le logo du promoteur est plus haut que celui de l'agence (cf. modèle). */
const LOGO_HAUTEUR_PROMOTEUR = 26;

/** Capitale initiale seule : « TRENTE MILLE… » → « Trente mille… ». */
function casserLesCapitales(texte: string): string {
  const minuscules = texte.toLocaleLowerCase("fr-FR");
  return minuscules.charAt(0).toLocaleUpperCase("fr-FR") + minuscules.slice(1);
}

function drawBlocDestinataire(
  doc: jsPDF,
  y: number,
  data: AppelFondsPdfData,
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);

  doc.text(data.clientNom, COLONNE_DROITE, y);
  y += LIGNE;
  for (const ligne of data.clientAdresse) {
    doc.text(ligne, COLONNE_DROITE, y);
    y += LIGNE;
  }
  for (const email of data.clientEmails) {
    doc.text(email, COLONNE_DROITE, y);
    y += LIGNE;
  }

  // Lieu et date, détachés du bloc adresse comme sur le courrier de référence.
  y += 10;
  const lieu = SOCIETE_PROMOTEUR.commune ?? "";
  doc.text(`${lieu}, le ${formatDateFr(new Date())}`, COLONNE_DROITE, y);
  return y + 16;
}

/** Paragraphe justifié sur la largeur utile. */
function drawParagraphe(doc: jsPDF, y: number, texte: string): number {
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);
  const lignes = doc.splitTextToSize(texte, LARGEUR_TEXTE) as string[];
  doc.text(lignes, MARGES.gauche, y, {
    maxWidth: LARGEUR_TEXTE,
    align: "justify",
  });
  return y + lignes.length * LIGNE + 6;
}

/** « Objet » en gras souligné, suivi du libellé en normal. */
function drawObjet(doc: jsPDF, y: number, texte: string): number {
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);
  doc.setFont("helvetica", "bold");

  const etiquette = "Objet";
  doc.text(etiquette, MARGES.gauche, y);
  const largeurEtiquette = doc.getTextWidth(etiquette);
  doc.setLineWidth(0.3);
  doc.setDrawColor(...COULEURS.night);
  doc.line(MARGES.gauche, y + 1, MARGES.gauche + largeurEtiquette, y + 1);

  doc.setFont("helvetica", "normal");
  const suite = ` : ${texte}`;
  // La première ligne démarre après l'étiquette, les suivantes en pleine largeur.
  const lignes = doc.splitTextToSize(suite, LARGEUR_TEXTE) as string[];
  const [premiere, ...reste] = doc.splitTextToSize(
    suite,
    LARGEUR_TEXTE - largeurEtiquette,
  ) as string[];
  doc.text(premiere ?? "", MARGES.gauche + largeurEtiquette, y);
  if (reste.length > 0) {
    doc.text(reste, MARGES.gauche, y + LIGNE);
  }
  return y + Math.max(lignes.length, reste.length + 1) * LIGNE + 8;
}

export function generateAppelFondsPdf(data: AppelFondsPdfData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pourcentage = String(data.appelPourcentage).replace(".", ",");

  let y = drawEnTete(
    doc,
    data.logoDataUrl,
    SOCIETE_PROMOTEUR,
    LOGO_HAUTEUR_PROMOTEUR,
  );
  y = drawBlocDestinataire(doc, y, data);

  y = drawObjet(
    doc,
    y,
    `Appel de fonds ${pourcentage}% - ${data.appelLabel} - lot N°${data.lotReference}   Résidence ${data.programmeName}.`,
  );

  y = drawParagraphe(doc, y, "Madame, Monsieur,");

  y = drawParagraphe(
    doc,
    y,
    `A ce jour, nous avons atteint le stade d'avancement suivant: ${data.appelLabel}, ` +
      `correspondant à ${pourcentage}% d'appel de fonds au montant de ` +
      `${formatEur(data.appelMontant)} (${casserLesCapitales(montantEnLettres(data.appelMontant))}).`,
  );

  y = drawParagraphe(
    doc,
    y,
    `Je vous prie de trouver ci-joint l'attestation transmise par le Maître d'oeuvre: ` +
      `Charles MORIN, gérant de la société I2C (en charge du projet ${data.programmeName}, situé au ${data.programmeAdresse}).`,
  );

  y = drawParagraphe(
    doc,
    y,
    `Je vous prie de trouver ci-joint, le RIB du compte promotion "${data.programmeName}" de la société ` +
      "Domaine de la Réunion sur lequel vous devrez réaliser votre prochain versement.",
  );

  y = drawParagraphe(
    doc,
    y,
    "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations les meilleures.",
  );

  // Signature sur deux lignes, calée à droite au-dessus du bandeau.
  y += 8;
  const basSignature = doc.internal.pageSize.getHeight() - BANDEAU_HAUTEUR - 20;
  y = Math.min(y, basSignature);
  doc.setFont("helvetica", "normal");
  doc.text("Christian VIRAPATRIN", COLONNE_DROITE + 15, y);
  doc.text("Gérant", COLONNE_DROITE + 23, y + LIGNE);

  drawBandeauPromoteur(doc, SOCIETE_PROMOTEUR);

  return Buffer.from(doc.output("arraybuffer"));
}
