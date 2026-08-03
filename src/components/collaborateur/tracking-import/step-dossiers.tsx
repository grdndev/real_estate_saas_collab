"use client";

import { useState, useEffect, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  upsertTrackingDossierAction,
  lookupClientByEmailAction,
} from "@/lib/collaborateur/tracking-import-actions";
import { createClientOnlyAction } from "@/lib/dossier/actions";
import type { ParsedTrackingLot } from "@/lib/collaborateur/tracking-import-types";

interface Props {
  rows: ParsedTrackingLot[];
  programmeId: string;
  lotIds: Record<string, string>;
  onDone: () => void;
}

// Chaque ligne donne lieu à un dossier : A = client existant,
// B = nouvel acquéreur à créer, C = dossier sans client.
type RowCase = "A" | "B" | "C";

interface RowMeta {
  row: ParsedTrackingLot;
  case: RowCase;
  existingUserId: string | null;
  hasDossier: boolean;
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
    kbisObtainedAt: isoOrNull(row.kbisObtainedAt),
    clientAtRsm: row.clientAtRsm,
    deposit200ReceivedAt: isoOrNull(row.deposit200ReceivedAt),
    rarSentByNotaryAt: isoOrNull(row.rarSentByNotaryAt),
    loanFiledAt: isoOrNull(row.loanFiledAt),
    loanObtainedAt: isoOrNull(row.loanObtainedAt),
  };
}

export function StepDossiers({ rows, programmeId, lotIds, onDone }: Props) {
  const [metas, setMetas] = useState<RowMeta[] | null>(null);
  const [autoProcessDone, setAutoProcessDone] = useState(false);
  const [currentCaseB, setCurrentCaseB] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [autoErrorsAcknowledged, setAutoErrorsAcknowledged] = useState(false);
  const [pending, startTransition] = useTransition();

  // Phase 1: classify all rows
  useEffect(() => {
    let cancelled = false;
    async function classify() {
      const result: RowMeta[] = [];
      for (const row of rows) {
        if (cancelled) return;
        if (!row.buyerEmail) {
          // Un dossier est créé pour CHAQUE lot importé, même sans acquéreur
          // ni date de process (T8) : il démarre en NEW_LEAD, sans client.
          result.push({
            row,
            case: "C",
            existingUserId: null,
            hasDossier: false,
          });
          continue;
        }
        const lookup = await lookupClientByEmailAction(row.buyerEmail);
        if (lookup.ok && lookup.value.userId) {
          result.push({
            row,
            case: "A",
            existingUserId: lookup.value.userId,
            hasDossier: lookup.value.hasDossier,
          });
        } else {
          result.push({
            row,
            case: "B",
            existingUserId: null,
            hasDossier: false,
          });
        }
      }
      if (!cancelled) setMetas(result);
    }
    classify();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  // Phase 2: auto-process A and C cases once metas are ready
  useEffect(() => {
    if (!metas) return;
    let cancelled = false;
    const safeMetas = metas;

    async function processAuto() {
      const autoCases = safeMetas.filter(
        (m) => m.case === "A" || m.case === "C",
      );
      const caseBRows = safeMetas.filter((m) => m.case === "B");
      const errs: string[] = [];

      for (const meta of autoCases) {
        if (cancelled) return;
        const lotId = lotIds[meta.row.reference];
        if (!lotId) {
          errs.push(`Lot introuvable pour ${meta.row.reference} — ignoré.`);
          if (!cancelled) setProcessed((p) => p + 1);
          continue;
        }
        const result = await upsertTrackingDossierAction({
          programmeId,
          lotId,
          lotFinalStatus: meta.row.lotStatus,
          processData: toProcessData(meta.row),
          client: meta.existingUserId
            ? { existingUserId: meta.existingUserId }
            : null,
        });
        if (!cancelled) {
          if (!result.ok) errs.push(`${meta.row.reference}: ${result.error}`);
          setProcessed((p) => p + 1);
        }
      }

      if (!cancelled) {
        setErrors((e) => [...e, ...errs]);
        setAutoProcessDone(true);
        if (caseBRows.length === 0) setDone(true);
      }
    }

    processAuto();
    return () => {
      cancelled = true;
    };
    // `lotIds` et `programmeId` sont figés par le parent avant le montage de
    // cette étape ; les ajouter relancerait inutilement le traitement auto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metas]);

  const caseBRows = metas?.filter((m) => m.case === "B") ?? [];
  // Chaque ligne importée donne un dossier : le compteur porte sur toutes.
  const total = metas ? metas.length : rows.length;

  if (!metas) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm text-slate-500">
        <span>Classification des acquéreurs…</span>
      </div>
    );
  }

  if (!autoProcessDone) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm text-slate-500">
        <span>
          Traitement automatique en cours… {processed} / {total}
        </span>
      </div>
    );
  }

  if (
    autoProcessDone &&
    !done &&
    errors.length > 0 &&
    caseBRows.length > 0 &&
    !autoErrorsAcknowledged
  ) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="warning">
          <p className="mb-2 font-medium">
            {errors.length} erreur(s) lors du traitement automatique :
          </p>
          <ul className="space-y-0.5 text-xs">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Alert>
        <p className="text-sm text-slate-600">
          {caseBRows.length} dossier(s) nécessitent une action manuelle.
        </p>
        <div className="flex justify-end">
          <Button onClick={() => setAutoErrorsAcknowledged(true)}>
            Continuer →
          </Button>
        </div>
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
        key={currentCaseB}
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
    hasDossier: boolean;
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
  const { row, hasDossier } = meta;
  const nameParts = (row.buyerName ?? "").trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts.slice(1).join(" "));
  const [lastName, setLastName] = useState(nameParts[0] ?? "");
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

      const clientResult = await createClientOnlyAction({
        email,
        firstName,
        lastName,
        phone: phone || undefined,
      });
      if (!clientResult.ok) {
        setFormError(clientResult.error);
        return;
      }

      const trackResult = await upsertTrackingDossierAction({
        programmeId,
        lotId,
        lotFinalStatus: row.lotStatus,
        processData: toProcessData(row),
        client: { existingUserId: clientResult.value.userId },
      });
      if (!trackResult.ok) {
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
      const result = await upsertTrackingDossierAction({
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

      {hasDossier ? (
        <>
          <Alert variant="info">
            Ce client a déjà un dossier. L&apos;import mettra à jour ses
            données.
          </Alert>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setFormError(null);
                startTransition(async () => {
                  const lookup = await lookupClientByEmailAction(email);
                  if (!lookup.ok || !lookup.value.userId) {
                    setFormError("Aucun compte client trouvé pour cet email.");
                    return;
                  }
                  const lotId = lotIds[row.reference];
                  if (!lotId) {
                    setFormError(`Lot introuvable pour ${row.reference}.`);
                    return;
                  }
                  const result = await upsertTrackingDossierAction({
                    programmeId,
                    lotId,
                    lotFinalStatus: row.lotStatus,
                    processData: toProcessData(row),
                    client: { existingUserId: lookup.value.userId },
                  });
                  if (!result.ok) {
                    setFormError(result.error);
                    return;
                  }
                  onCreated();
                });
              }}
              disabled={pending}
            >
              {pending ? "Mise à jour…" : "Associer et mettre à jour"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Aucun compte client trouvé pour{" "}
            <span className="font-mono">{row.buyerEmail}</span>. Créez le client
            ou importez sans associer.
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
            <Button
              variant="outline"
              disabled={pending || !email}
              onClick={() => {
                setFormError(null);
                startTransition(async () => {
                  const lookup = await lookupClientByEmailAction(email);
                  if (!lookup.ok || !lookup.value.userId) {
                    setFormError("Aucun compte client trouvé pour cet email.");
                    return;
                  }
                  const lotId = lotIds[row.reference];
                  if (!lotId) {
                    setFormError(`Lot introuvable pour ${row.reference}.`);
                    return;
                  }
                  const result = await upsertTrackingDossierAction({
                    programmeId,
                    lotId,
                    lotFinalStatus: row.lotStatus,
                    processData: toProcessData(row),
                    client: { existingUserId: lookup.value.userId },
                  });
                  if (!result.ok) {
                    setFormError(result.error);
                    return;
                  }
                  onCreated();
                });
              }}
            >
              {pending ? "Association…" : "Associer le client existant"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
