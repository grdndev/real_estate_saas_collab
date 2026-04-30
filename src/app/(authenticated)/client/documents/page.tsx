import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Mes documents" };

export default async function ClientDocumentsPage() {
  const me = await requireRole(["CLIENT", "SUPER_ADMIN"]);

  const dossier = await prisma.dossier.findUnique({
    where: { clientId: me.id },
    include: {
      documentRequests: {
        orderBy: [{ required: "desc" }, { createdAt: "asc" }],
        include: {
          documents: {
            where: { deletedAt: null },
            select: {
              id: true,
              fileName: true,
              scanStatus: true,
              createdAt: true,
            },
          },
        },
      },
      documents: {
        where: {
          deletedAt: null,
          source: "COLLABORATOR_UPLOAD",
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!dossier) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Aucun dossier associé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Vos documents apparaîtront ici dès qu&apos;un dossier vous sera
              associé.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Mes documents
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Documents transmis par votre collaborateur et pièces à déposer.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pièces à déposer</CardTitle>
        </CardHeader>
        {dossier.documentRequests.length === 0 ? (
          <EmptyState
            title="Aucune pièce demandée"
            description="Votre collaborateur n'a pas encore configuré de pièces à déposer."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Pièce demandée</Th>
                <Th>Statut</Th>
                <Th className="text-right">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {dossier.documentRequests.map((req) => {
                const fulfilled = req.fulfilled || req.documents.length > 0;
                return (
                  <Tr key={req.id}>
                    <Td className="font-medium">
                      {req.label}
                      {req.required && (
                        <span
                          aria-label="Pièce obligatoire"
                          className="ml-1 text-red-600"
                        >
                          *
                        </span>
                      )}
                    </Td>
                    <Td>
                      {fulfilled ? (
                        <Badge variant="success">✓ Déposée</Badge>
                      ) : (
                        <Badge variant="warning">En attente</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Button size="sm" variant="outline" disabled>
                        {fulfilled ? "Voir / Remplacer" : "Déposer"}
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
        <CardContent className="border-t border-slate-100">
          <Alert variant="info">
            L&apos;upload de fichiers sera disponible en Phase 2.3 (intégration
            stockage OVH + scan antivirus).
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents reçus</CardTitle>
        </CardHeader>
        {dossier.documents.length === 0 ? (
          <EmptyState
            title="Aucun document reçu"
            description="Les documents transmis par votre collaborateur apparaîtront ici."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Nom</Th>
                <Th>Type</Th>
                <Th>Reçu le</Th>
              </Tr>
            </THead>
            <TBody>
              {dossier.documents.map((doc) => (
                <Tr key={doc.id}>
                  <Td className="font-medium">{doc.fileName}</Td>
                  <Td className="text-xs text-slate-500">{doc.mimeType}</Td>
                  <Td className="text-xs text-slate-500">
                    {doc.createdAt.toLocaleDateString("fr-FR")}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
