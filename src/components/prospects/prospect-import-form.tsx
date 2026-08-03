"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { importProspectsAction } from "@/lib/prospect/actions";

interface Props {
  programmes: { id: string; name: string }[];
}

export function ProspectImportForm({ programmes }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [programmeId, setProgrammeId] = useState("");
  const [source, setSource] = useState("google_forms");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Sélectionnez un fichier CSV.");
      return;
    }
    const csv = await file.text();
    startTransition(async () => {
      const result = await importProspectsAction({
        csv,
        programmeId: programmeId || null,
        source,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setInfo(
        `Import : ${result.value.imported} ajouté(s), ${result.value.skipped} doublon(s) ignoré(s).`,
      );
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <FormField label="Fichier CSV" htmlFor="csv-file" required>
        <Input id="csv-file" type="file" accept=".csv,text/csv" ref={fileRef} />
      </FormField>
      <FormField label="Programme cible" htmlFor="csv-prog">
        <Select
          id="csv-prog"
          value={programmeId}
          onChange={(e) => setProgrammeId(e.target.value)}
        >
          <option value="">— Non assigné —</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Source" htmlFor="csv-source">
        <Input
          id="csv-source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </FormField>

      {error && (
        <div className="sm:col-span-3">
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        </div>
      )}
      {info && (
        <div className="sm:col-span-3">
          <Alert variant="success" role="status">
            {info}
          </Alert>
        </div>
      )}

      <div className="sm:col-span-3">
        <Button type="submit" disabled={pending}>
          <Upload className="size-4" aria-hidden />
          {pending ? "Import…" : "Importer le CSV"}
        </Button>
        <p className="mt-2 text-xs text-slate-500">
          Colonnes attendues : <code>Prénom</code>, <code>Nom</code>,{" "}
          <code>Email</code> et <code>Téléphone</code> (optionnel). Séparateur
          virgule ou point-virgule. Les autres colonnes du fichier sont ignorées
          — la commune se saisit ensuite sur la fiche du prospect.
        </p>
      </div>
    </form>
  );
}
