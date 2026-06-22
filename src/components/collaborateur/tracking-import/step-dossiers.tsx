"use client";

import { useState, useEffect, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  createTrackingDossierAction,
  lookupClientByEmailAction,
} from "@/lib/collaborateur/tracking-import-actions";
import { createClientAndDossierAction } from "@/lib/dossier/actions";
import type { ParsedTrackingLot } from "@/lib/collaborateur/tracking-import";

interface Props {
  rows: ParsedTrackingLot[];
  programmeId: string;
  lotIds: Record<string, string>;
  onDone: () => void;
}

type RowCase = "A" | "B" | "C";

interface RowMeta {
  row: ParsedTrackingLot;
  case: RowCase;
  existingUserId: string | null;
}

function toProcessData(row: ParsedTrackingLot) {
  function isoOrNull(d: Date | null | undefined): string | null {
    return d ? d.toISOString() : null;
  }
  return {
    optionDate: isoOrNull(row.optionDate),
    reservationSignedAt: isoOrNull(row.reservationSignedAt),
    notaryTransmittedAt: isoOrNull(row.notaryTransmittedAt),
    guaranteeDepositAmount: row.guaranteeDepositAmount,
    guaranteeDepositReceivedAt: isoOrNull(row.guaranteeDepositReceivedAt),
    loanFiled:
      row.loanFiled instanceof Date
        ? row.loanFiled.toISOString()
        : row.loanFiled,
    loanObtained: row.loanObtained,
    reservationEndDate: isoOrNull(row.reservationEndDate),
    actSignedAt: isoOrNull(row.actSignedAt),
    financingMode: row.financingMode,
    observation: row.observation,
  };
}

export function StepDossiers({ rows, programmeId, lotIds, onDone }: Props) {
  const [metas, setMetas] = useState<RowMeta[] | null>(null);
  const [currentCaseB, setCurrentCaseB] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  // Phase 1: classify all rows
  useEffect(() => {
    async function classify() {
      const result: RowMeta[] = [];
      for (const row of rows) {
        if (!row.buyerEmail) {
          result.push({ row, case: "C", existingUserId: null });
          continue;
        }
        const lookup = await lookupClientByEmailAction(row.buyerEmail);
        if (lookup.ok && lookup.value.userId) {
          result.push({ row, case: "A", existingUserId: lookup.value.userId });
        } else {
          result.push({ row, case: "B", existingUserId: null });
        }
      }
      setMetas(result);
    }
    classify();
  }, [rows]);

  // Phase 2: auto-process A and C cases once metas are ready
  useEffect(() => {
    if (!metas) return;
    const autoCases = metas.filter((m) => m.case === "A" || m.case === "C");
    if (autoCases.length === 0) return;

    async function processAuto() {
      let count = 0;
      const errs: string[] = [];
      for (const meta of autoCases) {
        const lotId = lotIds[meta.row.reference];
        if (!lotId) {
          errs.push(`Lot introuvable pour ${meta.row.reference} — ignoré.`);
          count++;
          continue;
        }
        const result = await createTrackingDossierAction({
          programmeId,
          lotId,
          lotFinalStatus: meta.row.lotStatus,
          processData: toProcessData(meta.row),
          client: meta.existingUserId
            ? { existingUserId: meta.existingUserId }
            : null,
        });
        if (!result.ok) {
          errs.push(`${meta.row.reference}: ${result.error}`);
        }
        count++;
      }
      setProcessed((p) => p + count);
      setErrors((e) => [...e, ...errs]);

      const caseBRows = metas!.filter((m) => m.case === "B");
      if (caseBRows.length === 0) setDone(true);
    }
    processAuto();
  }, [metas]);

  const caseBRows = metas?.filter((m) => m.case === "B") ?? [];
  const total = rows.length;

  if (!metas) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm text-slate-500">
        <span>Classification des acquéreurs…</span>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">
          Import terminé. {processed} dossier(s) traité(s) sur {total}.
        </Alert>
        {errors.length > 0 && (
          <Alert variant="warning">
            <ul className="space-y-0.5 text-xs">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Alert>
        )}
        <div className="flex justify-end">
          <Button onClick={onDone}>Terminer</Button>
        </div>
      </div>
    );
  }

  if (caseBRows.length > 0 && currentCaseB < caseBRows.length) {
    return (
      <CaseBForm
        meta={caseBRows[currentCaseB]!}
        programmeId={programmeId}
        lotIds={lotIds}
        total={total}
        processed={processed}
        errors={errors}
        pending={pending}
        onCreated={() => {
          setProcessed((p) => p + 1);
          const next = currentCaseB + 1;
          setCurrentCaseB(next);
          if (next >= caseBRows.length) setDone(true);
        }}
        onError={(msg) => {
          setErrors((e) => [...e, msg]);
          setProcessed((p) => p + 1);
          const next = currentCaseB + 1;
          setCurrentCaseB(next);
          if (next >= caseBRows.length) setDone(true);
        }}
        startTransition={startTransition}
        toProcessData={toProcessData}
      />
    );
  }

  return (
    <div className="py-8 text-center text-sm text-slate-500">
      Traitement en cours…
    </div>
  );
}

interface CaseBFormProps {
  meta: {
    row: ParsedTrackingLot;
    case: RowCase;
    existingUserId: string | null;
  };
  programmeId: string;
  lotIds: Record<string, string>;
  total: number;
  processed: number;
  errors: string[];
  pending: boolean;
  onCreated: () => void;
  onError: (msg: string) => void;
  startTransition: ReturnType<typeof useTransition>[1];
  toProcessData: (row: ParsedTrackingLot) => ReturnType<typeof toProcessData>;
}

function CaseBForm({
  meta,
  programmeId,
  lotIds,
  total,
  processed,
  errors,
  pending,
  onCreated,
  onError,
  startTransition,
  toProcessData,
}: CaseBFormProps) {
  const { row } = meta;
  const nameParts = (row.buyerName ?? "").trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts[0] ?? "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" "));
  const [email, setEmail] = useState(row.buyerEmail ?? "");
  const [phone, setPhone] = useState(row.buyerPhone ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  function handleCreateWithClient() {
    setFormError(null);
    startTransition(async () => {
      const lotId = lotIds[row.reference];
      if (!lotId) {
        onError(`Lot introuvable pour ${row.reference}.`);
        return;
      }

      // Create client + base dossier
      const clientResult = await createClientAndDossierAction({
        email,
        firstName,
        lastName,
        phone: phone || undefined,
        programmeId,
        lotId,
      });
      if (!clientResult.ok) {
        setFormError(clientResult.error);
        return;
      }

      // Apply tracking data on top
      const trackResult = await createTrackingDossierAction({
        programmeId,
        lotId,
        lotFinalStatus: row.lotStatus,
        processData: toProcessData(row),
        client: { existingUserId: clientResult.value.userId },
      });
      if (
        !trackResult.ok &&
        trackResult.error !== "Ce client a déjà un dossier."
      ) {
        setFormError(trackResult.error);
        return;
      }

      onCreated();
    });
  }

  function handleWithoutClient() {
    startTransition(async () => {
      const lotId = lotIds[row.reference];
      if (!lotId) {
        onError(`Lot introuvable pour ${row.reference}.`);
        return;
      }
      const result = await createTrackingDossierAction({
        programmeId,
        lotId,
        lotFinalStatus: row.lotStatus,
        processData: toProcessData(row),
        client: null,
      });
      if (!result.ok) {
        onError(`${row.reference}: ${result.error}`);
      } else {
        onCreated();
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-equatis-night-800 font-semibold">
          Lot {row.reference}
          {row.buyerName ? ` — ${row.buyerName}` : ""}
        </h3>
        <span className="text-xs text-slate-500">
          {processed} / {total} traités
        </span>
      </div>

      <p className="text-sm text-slate-600">
        Aucun compte client trouvé pour{" "}
        <span className="font-mono">{row.buyerEmail}</span>. Créez le client ou
        importez sans associer.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Prénom" htmlFor="cb-fn" required>
          <Input
            id="cb-fn"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </FormField>
        <FormField label="Nom" htmlFor="cb-ln" required>
          <Input
            id="cb-ln"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </FormField>
        <FormField label="Email" htmlFor="cb-email" required>
          <Input
            id="cb-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField label="Téléphone" htmlFor="cb-phone">
          <Input
            id="cb-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </FormField>
      </div>

      {formError && <Alert variant="danger">{formError}</Alert>}
      {errors.length > 0 && (
        <Alert variant="warning" className="text-xs">
          {errors.length} erreur(s) précédente(s).
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleWithoutClient}
          disabled={pending}
        >
          Créer sans client
        </Button>
        <Button
          onClick={handleCreateWithClient}
          disabled={pending || !firstName || !lastName || !email}
        >
          {pending ? "Création…" : "Créer & inviter →"}
        </Button>
      </div>
    </div>
  );
}
