import { z } from "zod";

export const addNoteSchema = z
  .object({
    scope: z.enum(["PROSPECT", "DOSSIER"]),
    prospectId: z.string().optional().nullable(),
    dossierId: z.string().optional().nullable(),
    body: z.string().trim().min(1, "Note vide").max(2000, "Note trop longue"),
  })
  .refine(
    (d) =>
      (d.scope === "PROSPECT" && !!d.prospectId) ||
      (d.scope === "DOSSIER" && !!d.dossierId),
    { message: "Cible de la note manquante." },
  );
export type AddNoteInput = z.infer<typeof addNoteSchema>;
