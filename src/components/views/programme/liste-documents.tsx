"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgrammeDocumentUploadZone } from "@/components/promoteur/programme-document-upload-zone";
import {
  deleteProgrammeDocumentAction,
  getProgrammeDocumentDownloadUrlAction,
} from "@/lib/promoter/actions";
import type { ProgrammeDocumentCategory } from "@/generated/prisma/enums";

const CATEGORY_LABEL: Record<ProgrammeDocumentCategory, string> = {
  PLAN: "Plan",
  PERMIS: "Permis",
  NOTICE: "Notice",
  BUDGET: "Budget",
  ACTE: "Acte",
};

interface DocumentRow {
  id: string;
  fileName: string;
  category: ProgrammeDocumentCategory;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

interface Props {
  id: string;
  documents: DocumentRow[];
}

export default function ListeDocuments({ id, documents }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents du programme</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {documents.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <DocumentItem key={doc.id} doc={doc} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Aucun document pour l&apos;instant.
          </p>
        )}

        <div className="border-t border-slate-100 pt-4">
          <p className="text-equatis-night-800 mb-3 text-sm font-medium">
            Ajouter un document
          </p>
          <ProgrammeDocumentUploadZone programmeId={id} />
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentItem({ doc }: { doc: DocumentRow }) {
  const router = useRouter();
  const [pendingDownload, startDownload] = useTransition();
  const [pendingDelete, startDelete] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function download() {
    setError(null);
    startDownload(async () => {
      const result = await getProgrammeDocumentDownloadUrlAction(doc.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.open(result.value.url, "_blank", "noopener,noreferrer");
    });
  }

  function remove() {
    startDelete(async () => {
      const result = await deleteProgrammeDocumentAction(doc.id);
      if (!result.ok) {
        setError(result.error);
        setConfirmOpen(false);
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        {CATEGORY_LABEL[doc.category]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">
          {doc.fileName}
        </p>
        <p className="text-xs text-slate-500">
          {(doc.sizeBytes / 1024).toFixed(0)} Ko
          {" · "}
          {doc.createdAt.toLocaleDateString("fr-FR")}
        </p>
      </div>
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={download}
          disabled={pendingDownload}
          aria-label="Télécharger"
          title="Télécharger"
        >
          <Download className="size-4" aria-hidden />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmOpen(true)}
          disabled={pendingDelete}
          aria-label="Supprimer"
          className="text-red-700 hover:bg-red-50"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer ce document ?"
        description="Le fichier sera supprimé du stockage et ne pourra plus être téléchargé."
        destructive
        confirmLabel="Supprimer"
        pending={pendingDelete}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </li>
  );
}
