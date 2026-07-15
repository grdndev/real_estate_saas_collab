"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload, CheckCircle2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { importProgrammeAction } from "@/lib/promoter/actions";

const ACCEPTED = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

/** Lit un fichier en base64 (sans le préfixe data:). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

export function ProgrammeImportForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdProgrammeId, setCreatedProgrammeId] = useState<string | null>(
    null,
  );
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [city, setCity] = useState("");
  const [vatRate, setVatRate] = useState("8.5");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((f: File | undefined) => {
    if (!f) return;
    const isXlsx = ACCEPTED.includes(f.type) || /\.xlsx?$/i.test(f.name);
    if (!isXlsx) {
      setError("Format non supporté. Déposez un fichier Excel (.xlsx).");
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setWarnings([]);
    setSuccess(null);
    setCreatedProgrammeId(null);
    if (!file) {
      setError("Déposez le fichier Excel des lots.");
      return;
    }
    startTransition(async () => {
      let fileB64: string;
      try {
        fileB64 = await fileToBase64(file);
      } catch {
        setError("Lecture du fichier impossible.");
        return;
      }
      const parsedVat = Number(vatRate.replace(",", "."));
      const result = await importProgrammeAction({
        name,
        reference,
        city,
        vatRate: Number.isFinite(parsedVat) ? parsedVat : 8.5,
        fileB64,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      // Avec des avertissements, on reste sur la page pour qu'ils soient lus ;
      // une redirection immédiate les rendrait invisibles.
      if (result.value.warnings.length === 0) {
        router.push(`/promoteur/${result.value.programmeId}`);
        return;
      }
      setSuccess(
        `Programme importé : ${result.value.lotsCreated} lot(s) créé(s).`,
      );
      setWarnings(result.value.warnings);
      setCreatedProgrammeId(result.value.programmeId);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <FormField label="Nom du programme" htmlFor="prog-name" required>
          <Input
            id="prog-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Résidence Les Jardins"
            required
          />
        </FormField>
        <FormField label="Référence" htmlFor="prog-ref" required>
          <Input
            id="prog-ref"
            className="font-mono uppercase"
            value={reference}
            onChange={(e) => setReference(e.target.value.toUpperCase())}
            placeholder="LESJARDINS-2026"
            required
          />
        </FormField>
        <FormField label="Ville" htmlFor="prog-city">
          <Input
            id="prog-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Saint-Denis"
          />
        </FormField>
        <FormField label="TVA par défaut (%)" htmlFor="prog-vat">
          <Input
            id="prog-vat"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            placeholder="8.5"
          />
        </FormField>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          acceptFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition",
          dragging
            ? "border-equatis-turquoise-500 bg-equatis-turquoise-50"
            : "hover:border-equatis-turquoise-400 border-slate-300 hover:bg-slate-50",
        )}
      >
        {file ? (
          <>
            <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
            <p className="text-equatis-night-800 text-sm font-medium">
              {file.name}
            </p>
            <p className="text-xs text-slate-500">
              Cliquez ou déposez pour remplacer le fichier.
            </p>
          </>
        ) : (
          <>
            <FileSpreadsheet
              className="text-equatis-turquoise-600 size-8"
              aria-hidden
            />
            <p className="text-equatis-night-800 text-sm font-medium">
              Glissez-déposez le fichier Excel des lots ici
            </p>
            <p className="text-xs text-slate-500">
              ou cliquez pour parcourir — format .xlsx
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => acceptFile(e.target.files?.[0])}
        />
      </div>

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" role="status">
          {success}
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert variant="warning" role="status">
          <p className="font-medium">
            Import terminé avec {warnings.length} avertissement(s) :
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {warnings.slice(0, 8).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {warnings.length > 8 && (
              <li>… et {warnings.length - 8} autre(s).</li>
            )}
          </ul>
        </Alert>
      )}
      {createdProgrammeId && (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/promoteur/${createdProgrammeId}`)}
          >
            Voir le programme
          </Button>
        </div>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          <Upload className="size-4" aria-hidden />
          {pending ? "Import en cours…" : "Importer le programme"}
        </Button>
        <p className="mt-2 text-xs text-slate-500">
          Colonnes attendues dans le fichier : <code>Référence</code> (ou{" "}
          <code>Appartements</code>), <code>Surface</code>, <code>Étage</code>,{" "}
          <code>Type</code>, <code>Prix HT</code> ou <code>Prix TTC</code>{" "}
          (FAI), <code>TVA</code>, <code>Statut</code>. Si seul le TTC est
          fourni, le HT est déduit avec la TVA par défaut ci-dessus. La première
          ligne sert d&apos;en-tête ; tous les lots sont listés automatiquement.
        </p>
      </div>
    </form>
  );
}
