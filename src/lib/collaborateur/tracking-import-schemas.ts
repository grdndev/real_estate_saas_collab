import { z } from "zod";

export const parseTrackingFileSchema = z.object({
  fileB64: z.string().min(1).max(10_000_000),
});

export const createTrackingProgrammeSchema = z
  .object({
    mode: z.enum(["new", "existing"]),
    programmeId: z.string().optional(),
    name: z.string().min(2).max(120).optional(),
    zipcode: z.string().max(10).optional(),
    city: z.string().max(80).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "existing" && !data.programmeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "programmeId requis pour le mode existant",
        path: ["programmeId"],
      });
    }
    if (data.mode === "new" && !data.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le nom est requis",
        path: ["name"],
      });
    }
  });

export const importTrackingLotsSchema = z.object({
  programmeId: z.string(),
  lots: z.array(
    z.object({
      building: z.string().nullable(),
      reference: z.string(),
      floor: z.number().nullable(),
      type: z.string(),
      surface: z.number().positive(),
      priceHT: z.number().positive(),
      priceTTC: z.number().positive(),
      vatRate: z.number().default(8.5),
      notes: z.string().nullable(),
      annexSurface: z.number().nullable(),
      suv: z.number().nullable(),
      garden: z.boolean().nullable(),
      priceNetVendeur: z.number().nullable(),
      priceNetVendeurWithParking: z.number().nullable(),
      commissionAgence: z.number().nullable(),
      commissionAgenceParking: z.number().nullable(),
      priceLocation: z.number().nullable(),
      creditImpot35: z.number().nullable(),
      priceRevientCrdImp: z.number().nullable(),
      additionalParking: z.boolean().nullable(),
    }),
  ),
});

export const createTrackingDossierSchema = z.object({
  programmeId: z.string(),
  lotId: z.string(),
  lotFinalStatus: z.enum([
    "AVAILABLE",
    "OPTIONED",
    "RESERVED",
    "SOLD",
    "WITHDRAWN",
  ]),
  processData: z.object({
    optionDate: z.string().nullable(),
    reservationSignedAt: z.string().nullable(),
    notaryTransmittedAt: z.string().nullable(),
    guaranteeDepositAmount: z.number().nullable(),
    guaranteeDepositReceivedAt: z.string().nullable(),
    loanFiled: z.union([z.boolean(), z.string()]).nullable(),
    loanObtained: z.string().nullable(),
    reservationEndDate: z.string().nullable(),
    actSignedAt: z.string().nullable(),
    financingMode: z.string().nullable(),
    observation: z.string().nullable(),
    kbisObtainedAt: z.string().nullable(),
    clientAtRsm: z.boolean().nullable(),
    deposit200ReceivedAt: z.string().nullable(),
    rarSentByNotaryAt: z.string().nullable(),
    loanFiledAt: z.string().nullable(),
    loanObtainedAt: z.string().nullable(),
  }),
  client: z
    .object({
      existingUserId: z.string().optional(),
    })
    .nullable(),
});

export type CreateTrackingProgrammeInput = z.infer<
  typeof createTrackingProgrammeSchema
>;
export type ImportTrackingLotsInput = z.infer<typeof importTrackingLotsSchema>;
export type CreateTrackingDossierInput = z.infer<
  typeof createTrackingDossierSchema
>;
