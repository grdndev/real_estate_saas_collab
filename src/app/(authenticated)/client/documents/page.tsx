import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
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
import { DocumentDropZone } from "@/components/storage/document-drop-zone";
import { DocumentRowActions } from "@/components/storage/document-row-actions";
import { ScanStatusBadge } from "@/components/storage/scan-status-badge";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured } from "@/lib/storage/s3";

export const metadata: Metadata = { title: "Mes documents" };

export default async function ClientDocumentsPage() {
  const me = await requireRole(["CLIENT", "SUPER_ADMIN"]);
  const storageReady = isStorageConfigured();

  const dossier = await prisma.dossier.findUnique({
    where: { clientId: me.id },
    include: {
      documentRequests: {
        orderBy: [{ required: "desc" }, { createdAt: "asc" }],
        include: {
          documents: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              fileName: true,
              scanStatus: true,
              createdAt: true,
              uploadedById: true,
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
          scanStatus: true,
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

      {!storageReady && (
        <Alert variant="warning">
          Le stockage S3 n&apos;est pas encore configuré sur ce serveur. Le
          dépôt de pièces sera disponible dès que les variables S3_* seront
          renseignées dans <code>.env</code>.
        </Alert>
      )}

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
          <CardContent className="space-y-4">
            {dossier.documentRequests.map((req) => {
              const fulfilled = req.fulfilled || req.documents.length > 0;
              return (
                <div
                  key={req.id}
                  className="rounded-md border border-slate-200 p-4"
                >
                  <p className="text-equatis-night-800 font-medium">
                    {req.label}
                    {req.required && (
                      <span
                        aria-label="Pièce obligatoire"
                        className="ml-1 text-red-600"
                      >
                        *
                      </span>
                    )}
                  </p>

                  {req.documents.length > 0 && (
                    <ul className="mt-3 divide-y divide-slate-100 text-sm">
                      {req.documents.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between gap-3 py-2"
                        >
                          <span className="font-mono text-xs">
                            {doc.fileName}
                          </span>
                          <div className="flex items-center gap-2">
                            <ScanStatusBadge status={doc.scanStatus} />
                            <DocumentRowActions
                              documentId={doc.id}
                              scanStatus={doc.scanStatus}
                              canDelete={doc.uploadedById === me.id}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {storageReady && (
                    <div className="mt-3">
                      <DocumentDropZone
                        dossierId={dossier.id}
                        documentRequestId={req.id}
                        source="CLIENT_UPLOAD"
                        compact
                        label={fulfilled ? "Remplacer le fichier" : undefined}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        )}
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
                <Th>Statut</Th>
                <Th>Reçu le</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {dossier.documents.map((doc) => (
                <Tr key={doc.id}>
                  <Td className="font-medium">{doc.fileName}</Td>
                  <Td className="text-xs text-slate-500">{doc.mimeType}</Td>
                  <Td>
                    <ScanStatusBadge status={doc.scanStatus} />
                  </Td>
                  <Td className="text-xs text-slate-500">
                    {doc.createdAt.toLocaleDateString("fr-FR")}
                  </Td>
                  <Td className="text-right">
                    <DocumentRowActions
                      documentId={doc.id}
                      scanStatus={doc.scanStatus}
                      canDelete={false}
                    />
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
