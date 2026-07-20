export interface ParsedFondsAppel {
  numero: number;
  label: string;
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
  notes: string | null;
  appelsFonds: ParsedFondsAppel[];
}

export interface ParsedFondsAppelType {
  numero: number;
  label: string;
  datePrevue: string;
  pourcentage: number;
}

export interface FondsParseResult {
  rows: ParsedFondsLot[];
  appelTypes: ParsedFondsAppelType[];
  errors: string[];
}
