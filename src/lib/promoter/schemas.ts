import { z } from "zod";

export const treasuryEntrySchema = z.object({
  programmeId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Format YYYY-MM"),
  income: z.number().min(0).max(999_999_999),
  expense: z.number().min(0).max(999_999_999),
});
export type TreasuryEntryInput = z.infer<typeof treasuryEntrySchema>;
