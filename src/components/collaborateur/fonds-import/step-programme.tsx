"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createTrackingProgrammeAction } from "@/lib/collaborateur/tracking-import-actions";

interface Props {
  programmes: Array<{ id: string; name: string; reference: string }>;
  onNext: (programmeId: string) => void;
  onBack?: () => void;
}

const NEW_VALUE = "__new__";

export function StepProgramme({ programmes, onNext, onBack }: Props) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(
    programmes.length > 0 ? programmes[0]!.id : NEW_VALUE,
  );
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const isNew = selected === NEW_VALUE;

  function handleSubmit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const input = isNew
        ? { mode: "new" as const, name, reference, city: city || undefined }
        : { mode: "existing" as const, programmeId: selected };

      const result = await createTrackingProgrammeAction(input);
      if (!result.ok) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      onNext(result.value.programmeId);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <FormField label="Programme" htmlFor="fp-programme">
        <Select
          id="fp-programme"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value={NEW_VALUE}>— Nouveau programme —</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.reference}
            </option>
          ))}
        </Select>
      </FormField>

      {isNew && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField
            label="Nom"
            htmlFor="fp-name"
            required
            error={fieldErrors.name?.[0]}
          >
            <Input
              id="fp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Résidence Les Jardins"
              required
            />
          </FormField>
          <FormField
            label="Référence"
            htmlFor="fp-ref"
            required
            error={fieldErrors.reference?.[0]}
          >
            <Input
              id="fp-ref"
              className="font-mono uppercase"
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              placeholder="LESJARDINS-2026"
              required
            />
          </FormField>
          <FormField label="Ville" htmlFor="fp-city">
            <Input
              id="fp-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Saint-Denis"
            />
          </FormField>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex justify-end gap-2">
        {onBack && (
          <Button
            variant="outline"
            onClick={onBack}
            disabled={pending}
            className="mr-auto"
          >
            ← Retour
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Enregistrement…" : "Suivant →"}
        </Button>
      </div>
    </div>
  );
}
