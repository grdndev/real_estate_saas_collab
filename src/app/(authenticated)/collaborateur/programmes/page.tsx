import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/guards";
import { loadProgrammesList } from "@/lib/programme/access";
import { ProgrammesListView } from "@/components/views/programmes/programmes-list-view";

export const metadata: Metadata = { title: "Programmes" };

export default async function CollabProgrammesPage() {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const programmes = await loadProgrammesList();

  return (
    <ProgrammesListView
      programmes={programmes}
      basePath="/collaborateur/programmes"
      canCreate
    />
  );
}
