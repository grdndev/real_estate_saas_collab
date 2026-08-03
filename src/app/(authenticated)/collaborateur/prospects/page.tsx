import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/guards";
import { loadProspects, loadProspectProgrammes } from "@/lib/prospect/access";
import { ProspectsView } from "@/components/views/prospects/prospects-view";

export const metadata: Metadata = { title: "Prospects" };

export default async function CollabProspectsPage() {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const scope = { programmeIds: null };
  const [prospects, programmes] = await Promise.all([
    loadProspects(scope),
    loadProspectProgrammes(scope),
  ]);

  return (
    <ProspectsView
      prospects={prospects}
      programmes={programmes}
      currentUserId={me.id}
      canDelete
      subtitle="Gérez les leads entrants et importez vos contacts Google Forms."
      sectioned
      dossierBasePath="/collaborateur/dossiers"
    />
  );
}
