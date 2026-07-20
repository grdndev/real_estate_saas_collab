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
  suv: number | null;
  garden: boolean | null;
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
}

export interface TrackingParseResult {
  rows: ParsedTrackingLot[];
  errors: string[];
}
