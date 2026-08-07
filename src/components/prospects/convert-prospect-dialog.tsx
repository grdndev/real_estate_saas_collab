"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { convertProspectAction } from "@/lib/prospect/actions";

export interface ProgrammeLotOption {
  id: string;
  name: string;
  lots: { id: string; reference: string; type: string }[];
}

export function ConvertProspectDialog({
  open,
  prospect,
  programmes,
  defaultProgrammeId,
  onClose,
}: {
  open: boolean;
  prospect: { id: string; firstName: string; lastName: string };
  programmes: ProgrammeLotOption[];
  defaultProgrammeId?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [programmeId, setProgrammeId] = useState(
    defaultProgrammeId && programmes.some((p) => p.id === defaultProgrammeId)
      ? defaultProgrammeId
      : "",
  );
  const [lotId, setLotId] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const programme = programmes.find((p) => p.id === programmeId);

  function confirm() {
    setServerError(null);
    startTransition(async () => {
      const r = await convertProspectAction({
        prospectId: prospect.id,
        programmeId,
        lotId,
      });
      if (!r.ok) {
        setServerError(r.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      open={open}
      title="Convertir en client"
      confirmLabel="Convertir"
      pending={pending}
      // Le dossier créé porte un lot : programme ET lot sont obligatoires.
      error={
        !programmeId
          ? "Sélectionnez un programme."
          : !lotId
            ? "Sélectionnez le lot acheté."
            : undefined
      }
      onConfirm={confirm}
      onCancel={onClose}
      description={
        <div className="space-y-3">
          <p>
            Un compte client sera créé pour{" "}
            <strong>
              {prospect.firstName} {prospect.lastName}
            </strong>{" "}
            et le dossier du lot choisi, puis un email d&apos;invitation lui
            sera envoyé.
          </p>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <FormField label="Programme" htmlFor="convert-programme" required>
            <Select
              value={programmeId}
              onChange={(e) => {
                setProgrammeId(e.target.value);
                setLotId("");
              }}
              disabled={pending}
            >
              <option value="">Sélectionner un programme…</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Lot"
            htmlFor="convert-lot"
            required
            hint="Le dossier matérialise l'achat de ce lot"
          >
            <Select
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
              disabled={pending || !programme || programme.lots.length === 0}
            >
              <option value="">— Sélectionnez un lot libre —</option>
              {programme?.lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.reference} ({lot.type})
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      }
    />
  );
}
