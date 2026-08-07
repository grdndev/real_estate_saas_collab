import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProspectCreateForm } from "@/components/prospects/prospect-create-form";
import { ProspectImportForm } from "@/components/prospects/prospect-import-form";
import {
  ProspectsTable,
  type ProspectRow,
} from "@/components/prospects/prospects-table";
import type { ProspectProgramme } from "@/lib/prospect/access";

/**
 * Vue « prospects » — implémentation unique partagée par les espaces
 * collaborateur, admin et promoteur (T15).
 *
 * Le périmètre des prospects visibles est résolu par la route ; la vue ne
 * décide d'aucun filtrage de sécurité.
 */
interface Props {
  prospects: ProspectRow[];
  programmes: ProspectProgramme[];
  currentUserId: string;
  canDelete: boolean;
  /** Texte d'introduction, propre à l'espace appelant. */
  subtitle: string;
  /**
   * Sépare les réservataires et les qualifiés dans leurs propres sections.
   * L'équipe interne pilote la conversion ; le promoteur voit une liste simple.
   */
  sectioned: boolean;
  /** Racine « lots » de l'espace appelant ; `null` si l'espace n'y donne pas accès. */
  lotBasePath: string | null;
}

export function ProspectsView({
  prospects,
  programmes,
  currentUserId,
  canDelete,
  subtitle,
  sectioned,
  lotBasePath,
}: Props) {
  // Les listes dérivées conservent l'ordre d'entrée (createdAt desc, id desc).
  const optioned = prospects.filter((p) => p.status === "OPTIONED");
  const qualified = prospects.filter((p) => p.status === "QUALIFIED");
  const others = sectioned
    ? prospects.filter(
        (p) => p.status !== "QUALIFIED" && p.status !== "OPTIONED",
      )
    : prospects;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Prospects
        </h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Importer depuis Google Forms (CSV)</CardTitle>
        </CardHeader>
        <CardContent>
          <ProspectImportForm programmes={programmes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter un prospect</CardTitle>
        </CardHeader>
        <CardContent>
          <ProspectCreateForm programmes={programmes} />
        </CardContent>
      </Card>

      {sectioned && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Prospects réservataires ({optioned.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-slate-600">
                Prospects ayant réservé, prêts à être convertis en client.
              </p>
              <ProspectsTable
                prospects={optioned}
                programmes={programmes}
                canDelete={canDelete}
                currentUserId={currentUserId}
                lotBasePath={lotBasePath}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prospects qualifiés ({qualified.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-slate-600">
                Prospects passés au statut « Qualifié ». Ils basculent
                automatiquement ici dès qu&apos;une collaboratrice les qualifie.
              </p>
              <ProspectsTable
                prospects={qualified}
                programmes={programmes}
                canDelete={canDelete}
                currentUserId={currentUserId}
                lotBasePath={lotBasePath}
              />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Liste des prospects ({others.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ProspectsTable
            prospects={others}
            programmes={programmes}
            canDelete={canDelete}
            currentUserId={currentUserId}
            lotBasePath={lotBasePath}
          />
        </CardContent>
      </Card>
    </div>
  );
}
