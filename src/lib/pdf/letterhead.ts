import type { jsPDF } from "jspdf";

/**
 * Papier à en-tête Équatis partagé par les documents PDF
 * (honoraires de négociation, courrier d'appel de fonds…).
 *
 * ⚠️ TODO : remplacer les valeurs placeholder ci-dessous par les vraies
 * mentions légales de la société avant mise en production.
 */
export const SOCIETE = {
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

/** Couleurs de la charte (voir globals.css). */
export const COULEURS = {
  turquoise: [15, 184, 169] as const, // --color-equatis-turquoise
  night: [15, 23, 42] as const, // texte principal
  gris: [71, 85, 105] as const, // texte secondaire
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
 * Dessine l'en-tête Équatis. Si un logo est fourni (data URL PNG/JPEG),
 * il remplace le wordmark texte ; sinon, wordmark texte + filet.
 * Retourne la position Y sous l'en-tête, à partir de laquelle écrire la suite.
 */
export function drawEnTete(doc: jsPDF, logoDataUrl?: string | null): number {
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
  doc.text(SOCIETE.nom.toUpperCase(), MARGES.gauche, 22);

  // Filet sous le wordmark.
  doc.setDrawColor(...COULEURS.turquoise);
  doc.setLineWidth(0.6);
  doc.line(MARGES.gauche, 26, MARGES.gauche + 42, 26);

  return 36;
}

const LARGEUR_TEXTE = 210 - MARGES.gauche - MARGES.droite;

/**
 * Dessine le pied de page société (mentions légales) centré en bas de page.
 */
export function drawPiedDePage(doc: jsPDF): void {
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
  const lignes = doc.splitTextToSize(
    `${SOCIETE.nom} - ${SOCIETE.formeJuridique} - ${SOCIETE.siret} - ${SOCIETE.cpi}`,
    LARGEUR_TEXTE,
  ) as string[];
  doc.text(lignes, centreX, hauteur - 17, { align: "center" });
  doc.text(`${SOCIETE.telephone} - ${SOCIETE.email}`, centreX, hauteur - 11, {
    align: "center",
  });
}
