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
}

export interface TrackingParseResult {
  rows: ParsedTrackingLot[];
  errors: string[];
}
