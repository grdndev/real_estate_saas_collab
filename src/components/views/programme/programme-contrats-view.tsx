import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/table";
import {
  CONTRACT_STATUS_BADGE,
  CONTRACT_STATUS_LABEL,
} from "@/lib/dossier/labels";
import type { ProgrammeContractRow } from "@/lib/programme/access";

/**
 * Vue « suivi des contrats d'un programme » — implémentation unique partagée
 * par l'espace promoteur et l'espace admin (T3/T15).
 *
 * `showClientIdentity` est un contrôle explicite fourni par la route : le
 * promoteur ne voit aucune identité client (T1), l'admin la conserve.
 */
interface Props {
  programme: { name: string };
  dossiers: ProgrammeContractRow[];
  showClientIdentity: boolean;
  /** Lien vers la fiche dossier, ou `null` si l'espace n'en propose pas. */
  lotBasePath: string | null;
}

export function ProgrammeContratsView({
  programme,
  dossiers,
  showClientIdentity,
  lotBasePath,
}: Props) {
  const withContract = dossiers.filter((d) => d.contractStatus != null);
  const signedCount = dossiers.filter((d) => d.hasSignature).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Suivi des contrats
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {programme.name} — avancement contractuel des dossiers du programme.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Dossiers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {dossiers.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contrats signés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {signedCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>En cours contractuel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {withContract.length}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            {showClientIdentity ? "Contrats par client" : "Contrats par lot"}
          </CardTitle>
        </CardHeader>
        {dossiers.length === 0 ? (
          <EmptyState
            title="Aucun dossier"
            description="Aucun dossier n'a encore été créé sur ce programme."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                {showClientIdentity && <Th>Client</Th>}
                <Th>Lot</Th>
                <Th>Statut contractuel</Th>
                <Th>Signature</Th>
                <Th>Prochain RDV notaire</Th>
                {lotBasePath && <Th />}
              </Tr>
            </THead>
            <TBody>
              {dossiers.map((d) => (
                <Tr key={d.id}>
                  {showClientIdentity && (
                    <Td className="font-medium">
                      {d.clientName ?? "— Client non associé"}
                    </Td>
                  )}
                  <Td>{`${d.lot.reference} · ${d.lot.type}`}</Td>
                  <Td>
                    {d.contractStatus ? (
                      <Badge variant={CONTRACT_STATUS_BADGE[d.contractStatus]}>
                        {CONTRACT_STATUS_LABEL[d.contractStatus]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Pas encore en phase contrat
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs">
                    {d.signedAt ? (
                      <span className="text-emerald-700">
                        Signé le {d.signedAt.toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="text-slate-400">Non signé</span>
                    )}
                  </Td>
                  <Td className="text-xs">
                    {d.nextAppointmentAt ? (
                      d.nextAppointmentAt.toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  {lotBasePath && (
                    <Td className="text-right">
                      <Link
                        href={`${lotBasePath}/${d.lotId}`}
                        className="text-equatis-turquoise-700 text-sm hover:underline"
                      >
                        Ouvrir →
                      </Link>
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
