import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/guards";
import { programmesForPromoter } from "@/lib/promoter/access";
import { loadProspects, loadProspectProgrammes } from "@/lib/prospect/access";
import { ProspectsView } from "@/components/views/prospects/prospects-view";

export const metadata: Metadata = { title: "Prospects" };

export default async function PromoteurProspectsPage() {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);

  // Périmètre résolu ici : le promoteur ne voit que ses programmes.
  const scope = {
    programmeIds:
      me.role === "PROMOTER" ? await programmesForPromoter(me.id) : null,
  };
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
      subtitle="Leads de vos programmes — visibilité limitée aux programmes auxquels vous êtes assigné."
      sectioned={false}
      // Le promoteur n'accède pas au détail des dossiers.
      dossierBasePath="/promoteur"
    />
  );
}
