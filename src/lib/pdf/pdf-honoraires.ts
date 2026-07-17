import { jsPDF } from "jspdf";

import {
  COULEURS,
  MARGES,
  drawEnTete,
  drawPiedDePage,
  formatDateFr,
  formatEur,
} from "./letterhead";
import { montantEnLettres } from "./montant-en-lettres";

/** Un lot vendu, tel qu'affiché sur la facture. */
export interface HonorairesLot {
  reference: string;
  type: string;
  floor: number | null;
}

/** Données nécessaires au document « Honoraires de négociation ». */
export interface HonorairesPdfData {
  /** N° de facture affiché en haut à droite (ex : "2026-042"). */
  numeroFacture: string;
  /** Nom du vendeur (société), affiché en destinataire et ligne VENDEURS. */
  vendeurNom: string;
  /** Adresse postale du vendeur (optionnelle, sous le nom). */
  vendeurAdresse: string | null;
  /** Nom complet de l'acquéreur (client du dossier). */
  acquereur: string;
  /** Lot(s) du dossier. */
  lots: HonorairesLot[];
  programmeName: string;
  /** Adresse du programme ("Sis : …"), si renseignée. */
  programmeAddress: string | null;
  /** Nom du notaire en charge du contrat de réservation. */
  notaireNom: string | null;
  /** Adresse du notaire, si renseignée. */
  notaireAdresse: string | null;
  /** Montant HT saisi par l'utilisateur. */
  montantHT: number;
  /** Taux de TVA en % (8,5 par défaut côté formulaire). */
  tauxTva: number;
  /** Logo société (data URL) affiché en en-tête à la place du texte, si défini. */
  logoDataUrl: string | null;
}

// Interligne standard du document (en mm).
const LIGNE = 6;

/** Écrit une ligne "LIBELLÉ : valeur" et retourne le Y suivant. */
function drawLigne(doc: jsPDF, y: number, libelle: string, valeur: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);
  doc.text(`${libelle} :`, MARGES.gauche, y);

  // La valeur est décalée à droite du libellé, sur la même ligne.
  const largeurLibelle = doc.getTextWidth(`${libelle} : `);
  doc.setFont("helvetica", "normal");
  doc.text(valeur, MARGES.gauche + largeurLibelle + 2, y);
  return y + LIGNE;
}

/** Écrit une ligne de complément indentée (sous une ligne principale). */
function drawComplement(doc: jsPDF, y: number, texte: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);
  doc.text(texte, MARGES.gauche + 8, y);
  return y + LIGNE;
}

/** Bloc destinataire (vendeur) aligné à droite. */
function drawDestinataire(doc: jsPDF, y: number, data: HonorairesPdfData) {
  const x = 120; // colonne du bloc adresse, comme sur un courrier papier
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);
  doc.text(data.vendeurNom, x, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  if (data.vendeurAdresse) {
    // splitTextToSize gère les adresses sur plusieurs lignes.
    const lignes = doc.splitTextToSize(data.vendeurAdresse, 70) as string[];
    doc.text(lignes, x, y);
    y += lignes.length * 5;
  }

  y += 6;
  doc.text(`Le ${formatDateFr(new Date())}`, x, y);
  return y + 14;
}

/** Titre du document dans un cadre centré. */
function drawTitreEncadre(doc: jsPDF, y: number) {
  const largeurPage = doc.internal.pageSize.getWidth();
  const largeurCadre = 110;
  const x = (largeurPage - largeurCadre) / 2;

  doc.setDrawColor(...COULEURS.night);
  doc.setLineWidth(0.4);
  doc.rect(x, y, largeurCadre, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COULEURS.night);
  doc.text("HONORAIRES DE NEGOCIATION", largeurPage / 2, y + 8, {
    align: "center",
  });
  return y + 24;
}

/** Décrit un lot : "T3 au R+2 – Lot A102". */
function libelleLot(lot: HonorairesLot): string {
  const etage = lot.floor != null ? ` au R+${lot.floor}` : "";
  return `${lot.type}${etage} – Lot ${lot.reference}`;
}

/** Bloc des montants : HT, TVA, TTC alignés à droite. */
function drawMontants(doc: jsPDF, y: number, data: HonorairesPdfData) {
  const montantTva = (data.montantHT * data.tauxTva) / 100;
  const montantTtc = data.montantHT + montantTva;
  const xValeur = 150; // colonne des montants, alignés à droite

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);
  doc.text("MONTANT DES HONORAIRES DUS :", MARGES.gauche, y);
  y += LIGNE + 1;

  const lignes: Array<[string, number, boolean]> = [
    ["MONTANT HT", data.montantHT, false],
    [`TVA ${String(data.tauxTva).replace(".", ",")} %`, montantTva, false],
    ["TOTAL TTC", montantTtc, true],
  ];
  for (const [libelle, montant, gras] of lignes) {
    doc.setFont("helvetica", gras ? "bold" : "normal");
    doc.text(libelle, MARGES.gauche + 8, y);
    doc.text(formatEur(montant), xValeur, y, { align: "right" });
    y += LIGNE;
  }

  // Montant TTC en toutes lettres.
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text("Arrêté la présente facture à la somme de :", MARGES.gauche, y);
  y += LIGNE;
  doc.setFont("helvetica", "bolditalic");
  const enLettres = doc.splitTextToSize(
    montantEnLettres(montantTtc),
    doc.internal.pageSize.getWidth() - MARGES.gauche - MARGES.droite,
  ) as string[];
  doc.text(enLettres, MARGES.gauche, y);
  return y + enLettres.length * LIGNE;
}

/**
 * Génère le PDF « Honoraires de négociation » (A4 portrait),
 * destiné au notaire dans le cadre d'un dossier.
 */
export function generateHonorairesPdf(data: HonorairesPdfData): Buffer {
  const [premierLot, ...autresLots] = data.lots;
  if (!premierLot) {
    throw new Error("Au moins un lot est requis pour générer la facture.");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  let y = drawEnTete(doc, data.logoDataUrl);

  // Référence de facture en haut à droite.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COULEURS.night);
  doc.text(`F/ N° : ${data.numeroFacture}`, MARGES.gauche, y);

  y = drawDestinataire(doc, y, data);
  y = drawTitreEncadre(doc, y);

  y = drawLigne(doc, y, "VENDEURS", data.vendeurNom);
  y += 2;
  y = drawLigne(doc, y, "ACQUEREUR(S)", data.acquereur);
  y += 2;

  // Bien(s) vendu(s) : une ligne par lot + programme + adresse.
  y = drawLigne(doc, y, "TYPE DE BIEN VENDU", libelleLot(premierLot));
  for (const lot of autresLots) {
    y = drawComplement(doc, y, libelleLot(lot));
  }
  y = drawComplement(doc, y, `Programme « ${data.programmeName} »`);
  if (data.programmeAddress) {
    y = drawComplement(doc, y, `Sis : ${data.programmeAddress}`);
  }
  y += 2;

  y = drawLigne(
    doc,
    y,
    "CONTRAT DE RESERVATION",
    data.notaireNom ? `Chez Maître ${data.notaireNom}` : "—",
  );
  if (data.notaireAdresse) {
    y = drawComplement(doc, y, data.notaireAdresse);
  }
  y += 4;

  drawMontants(doc, y, data);

  drawPiedDePage(doc);

  return Buffer.from(doc.output("arraybuffer"));
}
