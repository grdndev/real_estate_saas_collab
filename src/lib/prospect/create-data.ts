import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/guards";
import type { CreateProspectInput } from "@/lib/prospect/schemas";

export function buildProspectCreateData(
  data: CreateProspectInput,
  actor: Pick<SessionUser, "id" | "role">,
): Prisma.ProspectUncheckedCreateInput {
  const note = data.notes?.trim();
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email || null,
    phone: data.phone || null,
    city: data.city || null,
    programmeId: data.programmeId || null,
    source: data.source || "manual",
    ownerId: actor.role === "COLLABORATOR" ? actor.id : null,
    sharedNotes: note
      ? { create: { scope: "PROSPECT", authorId: actor.id, body: note } }
      : undefined,
  };
}
