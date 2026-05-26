import { z } from "zod";

export const createAppointmentSchema = z.object({
  dossierId: z.string().min(1),
  // Date/heure ISO (datetime-local côté formulaire).
  scheduledAt: z.string().min(1, "Date du rendez-vous requise"),
  location: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
