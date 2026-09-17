import type { jsPDF } from "jspdf";

/**
 * Papier à en-tête Équatis partagé par les documents PDF
 * (honoraires de négociation, courrier d'appel de fonds…).
 *
 * ⚠️ TODO : remplacer les valeurs placeholder ci-dessous par les vraies
 * mentions légales de la société avant mise en production.
 */
/** Mentions légales portées par le pied de page d'un document. */
export interface MentionsSociete {
  nom: string;
  formeJuridique: string;
  /** Adresse du siège, sur une ligne. Omise si l'entité n'en affiche pas. */
  adresse?: string;
  /** Code postal + commune, seconde ligne d'adresse du bandeau promoteur. */
  ville?: string;
  /** Commune seule, pour la mention de lieu en tête de courrier. */
  commune?: string;
  siret: string;
  /** TVA intracommunautaire, si le document doit la porter. */
  tva?: string;
  /** Code APE, affiché à droite du bandeau promoteur. */
  ape?: string;
  /** Carte professionnelle : agents immobiliers uniquement. */
  cpi?: string;
  telephone?: string;
  email?: string;
}

/** Équatis — agence. Documents d'honoraires de négociation. */
export const SOCIETE: MentionsSociete = {
  nom: "Équatis",
  // Forme juridique et capital - PLACEHOLDER
  formeJuridique: "Société par actions simplifiée au capital de 1 000 €",
  // Siret - PLACEHOLDER
  siret: "Siret 832 040 19000015",
  // Carte professionnelle immobilier - PLACEHOLDER
  cpi:
    "Carte professionnelle n° CPI 9741 2018 000 024 274 délivrée par la Chambre de Commerce de Saint-Denis " +
    "La Réunion portant les mentions : Transaction sur immeubles et fonds de commerce",
  // Coordonnées - PLACEHOLDER
  telephone: "Tél. 02 62 23 62 01 / 06 92 45 22 10",
  email: "equatisimmo@gmail.com",
};

/**
 * Domaine de la Réunion — promoteur. Courriers d'appel de fonds.
 * Valeurs relevées sur le courrier de référence fourni par le client
 * (APE 6810 Z, qui diffère du 41.10A enregistré à l'INSEE).
 */
export const SOCIETE_PROMOTEUR: MentionsSociete = {
  nom: "Domaine de la Réunion",
  formeJuridique: "SARL",
  adresse: "76 Avenue Pierre Mendès France",
  ville: "97441 Sainte-Suzanne",
  commune: "Sainte-Suzanne",
  siret: "444 841 241 00029",
  ape: "6810 Z",
  telephone: "0262 23 62 01",
  email: "domainedelareunion@orange.fr",
};

/** Couleurs de la charte (voir globals.css). */
export const COULEURS = {
  turquoise: [15, 184, 169] as const, // --color-equatis-turquoise
  night: [15, 23, 42] as const, // texte principal
  gris: [71, 85, 105] as const, // texte secondaire
  // Bandeau de pied de page du promoteur (charte Domaine de la Réunion).
  bandeau: [16, 33, 67] as const, // bleu nuit du fond
  bandeauTexte: [255, 255, 255] as const,
  bandeauPuce: [232, 196, 122] as const, // pastilles dorées
};

/** Marges par défaut des documents (en mm). */
export const MARGES = { gauche: 20, droite: 20 };

// Format monétaire fr-FR avec centimes (ex : "14 250,50 €").
const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/** Formate un montant en euros (espaces insécables remplacées pour jsPDF). */
export function formatEur(value: number): string {
  return eur.format(value).replace(/[\u202f\u00a0]/gu, " ");
}

/**
 * Compose l'adresse postale d'un programme ("adresse, CP ville") en
 * n'affichant que les champs renseignés. Retourne null si tout est vide.
 */
export function formatAdresseProgramme(programme: {
  address: string | null;
  zipcode: string | null;
  city: string | null;
}): string | null {
  const localite = [programme.zipcode, programme.city]
    .filter(Boolean)
    .join(" ");
  const parties = [programme.address, localite].filter(Boolean);
  return parties.length > 0 ? parties.join(", ") : null;
}

/** Formate une date en français long (ex : "16 juillet 2026"). */
export function formatDateFr(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Hauteur du logo société dans l'en-tête (en mm).
const LOGO_HAUTEUR = 14;

/**
 * Dessine l'en-tête. Si un logo est fourni (data URL PNG/JPEG), il remplace le
 * wordmark texte ; sinon, wordmark texte + filet au nom de `societe`.
 * Retourne la position Y sous l'en-tête, à partir de laquelle écrire la suite.
 */
export function drawEnTete(
  doc: jsPDF,
  logoDataUrl?: string | null,
  societe: MentionsSociete = SOCIETE,
): number {
  if (logoDataUrl) {
    // Un data URL corrompu ne doit pas casser la génération : fallback texte.
    try {
      const props = doc.getImageProperties(logoDataUrl);
      const largeur = (props.width / props.height) * LOGO_HAUTEUR;
      const format = logoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(
        logoDataUrl,
        format,
        MARGES.gauche,
        14,
        largeur,
        LOGO_HAUTEUR,
      );
      return 36;
    } catch {
      // Ignoré : on dessine l'en-tête texte ci-dessous.
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COULEURS.turquoise);
  doc.text(societe.nom.toUpperCase(), MARGES.gauche, 22);

  // Filet sous le wordmark.
  doc.setDrawColor(...COULEURS.turquoise);
  doc.setLineWidth(0.6);
  doc.line(MARGES.gauche, 26, MARGES.gauche + 42, 26);

  return 36;
}

const LARGEUR_TEXTE = 210 - MARGES.gauche - MARGES.droite;

/**
 * Dessine le pied de page (mentions légales) centré en bas de page.
 * `societe` par défaut : Équatis. Les champs absents sont simplement omis.
 */
export function drawPiedDePage(
  doc: jsPDF,
  societe: MentionsSociete = SOCIETE,
): void {
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const centreX = largeur / 2;

  // Filet au-dessus des mentions.
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(MARGES.gauche, hauteur - 22, largeur - MARGES.droite, hauteur - 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COULEURS.gris);

  const mentions = [
    societe.nom,
    societe.formeJuridique,
    societe.adresse,
    societe.siret,
    societe.tva,
    societe.cpi,
  ]
    .filter(Boolean)
    .join(" - ");
  const lignes = doc.splitTextToSize(mentions, LARGEUR_TEXTE) as string[];
  doc.text(lignes, centreX, hauteur - 17, { align: "center" });

  const contact = [societe.telephone, societe.email]
    .filter(Boolean)
    .join(" - ");
  if (contact) {
    doc.text(contact, centreX, hauteur - 11, { align: "center" });
  }
}

/** Hauteur du bandeau de pied de page du promoteur (en mm). */
export const BANDEAU_HAUTEUR = 30;

/**
 * Pied de page du promoteur : bandeau plein pleine largeur, coordonnées à
 * gauche précédées d'une pastille, identifiants légaux à droite.
 * Reproduit le courrier de référence fourni par le client.
 */
export function drawBandeauPromoteur(
  doc: jsPDF,
  societe: MentionsSociete,
): void {
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const hautBandeau = hauteur - BANDEAU_HAUTEUR;

  doc.setFillColor(...COULEURS.bandeau);
  doc.rect(0, hautBandeau, largeur, BANDEAU_HAUTEUR, "F");

  const xPuce = MARGES.gauche;
  const xTexte = xPuce + 5;
  doc.setTextColor(...COULEURS.bandeauTexte);

  // Bloc adresse : deux lignes serrées, en gras comme sur le modèle.
  let y = hautBandeau + 8;
  doc.setFillColor(...COULEURS.bandeauPuce);
  doc.circle(xPuce, y - 1.2, 1.4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  if (societe.adresse) doc.text(societe.adresse, xTexte, y);
  if (societe.ville) doc.text(societe.ville, xTexte, y + 3.2);

  doc.setFont("helvetica", "normal");
  if (societe.telephone) {
    y += 10;
    doc.setFillColor(...COULEURS.bandeauPuce);
    doc.circle(xPuce, y - 1.2, 1.4, "F");
    doc.text(societe.telephone, xTexte, y);
  }
  if (societe.email) {
    y += 7;
    doc.setFillColor(...COULEURS.bandeauPuce);
    doc.circle(xPuce, y - 1.2, 1.4, "F");
    doc.text(societe.email, xTexte, y);
  }

  // Identifiants légaux, alignés à droite sur la dernière ligne de contact.
  const identifiants = [
    societe.siret ? `Siret : ${societe.siret}` : null,
    societe.ape ? `Ape : ${societe.ape}` : null,
  ]
    .filter(Boolean)
    .join(" - ");
  if (identifiants) {
    doc.setFontSize(7.5);
    doc.text(identifiants, largeur - MARGES.droite, y, { align: "right" });
  }
}
