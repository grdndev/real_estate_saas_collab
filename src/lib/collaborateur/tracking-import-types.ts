export interface ParsedTrackingLot {
  building: string | null;
  reference: string;
  floor: number | null;
  type: string;
  surface: number;
  priceHT: number;
  priceTTC: number;
  vatRate: number;
  lotStatus: "AVAILABLE" | "OPTIONED" | "RESERVED" | "SOLD" | "WITHDRAWN";
  lotNotes: string | null;

  annexSurface: number | null;
  /** Surface utile SUV, importée telle quelle (T6). */
  suv: number | null;
  garden: number | null;
  priceNetVendeur: number | null;
  priceNetVendeurWithParking: number | null;
  commissionAgence: number | null;
  commissionAgenceParking: number | null;
  priceLocation: number | null;
  creditImpot35: number | null;
  priceRevientCrdImp: number | null;
  additionalParking: boolean | null;

  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  observation: string | null;

  financingMode: string | null;
  optionDate: Date | null;
  reservationSignedAt: Date | null;
  notaryTransmittedAt: Date | null;
  guaranteeDepositAmount: number | null;
  guaranteeDepositReceivedAt: Date | null;
  loanFiled: boolean | Date | null;
  loanObtained: string | null;
  reservationEndDate: Date | null;
  actSignedAt: Date | null;

  kbisObtainedAt: Date | null;
  clientAtRsm: boolean | null;
  deposit200ReceivedAt: Date | null;
  rarSentByNotaryAt: Date | null;
  loanFiledAt: Date | null;
  loanObtainedAt: Date | null;

  /** Numéro de ligne dans la feuille Excel — pour signaler les corrections. */
  sourceRow: number;
  /**
   * Champs obligatoires absents ou invalides dans le fichier (T8).
   * La ligne est conservée avec une valeur neutre : elle doit être complétée
   * à l'étape de vérification avant import.
   */
  incompleteFields: string[];
}

export interface TrackingParseResult {
  rows: ParsedTrackingLot[];
  /** Erreurs bloquantes (fichier illisible, en-têtes introuvables…). */
  errors: string[];
  /**
   * Rapport d'import (T8) : aucune ligne possédant une référence n'est
   * ignorée ; celles dont une valeur obligatoire manque sont comptées à part.
   */
  stats: {
    /** Lignes possédant une référence de lot. */
    detected: number;
    /** Lignes conservées — toujours égal à `detected`. */
    kept: number;
    /** Lignes conservées mais à compléter avant import. */
    incomplete: number;
  };
}
