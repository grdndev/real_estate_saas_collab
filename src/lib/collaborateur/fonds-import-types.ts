export interface ParsedFondsAppel {
  numero: number;
  label: string;
  datePrevue: string | null;
  pourcentage: number;
  montant: number;
}

export interface ParsedFondsLot {
  lotReference: string;
  nomAcquereur: string | null;
  dateSignatureActe: Date | null;
  commission: number | null;
  fraisMainLevee: number | null;
  rbstEdd: number | null;
  soldeVendeur: number | null;
  dateEnvoiLr: Date | null;
  dateReceptionLr: Date | null;
  dateReceptionVirement: Date | null;
  notes: string | null;
  appelsFonds: ParsedFondsAppel[];
}

export interface ParsedFondsAppelType {
  numero: number;
  label: string;
  mois: string;
  annee: number;
  pourcentage: number;
}

export interface FondsParseResult {
  rows: ParsedFondsLot[];
  appelTypes: ParsedFondsAppelType[];
  errors: string[];
}
