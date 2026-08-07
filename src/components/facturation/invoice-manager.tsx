"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Send, Upload } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createInvoiceAction,
  sendInvoiceToNotaryAction,
} from "@/lib/invoice/actions";
import { HonorairesPdfDialog } from "../collab/honoraires-pdf-dialog";
import { prisma } from "@/lib/prisma";

export interface InvoiceItem {
  id: string;
  number: string;
  amountHT: number;
  amountTTC: number;
  status: "DRAFT" | "SENT_TO_NOTARY" | "PAID";
  hasFile: boolean;
  sentToNotaryAt: string | null;
}

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Lecture impossible."));
    reader.readAsDataURL(file);
  });
}

interface Props {
  dossierId: string;
  /** Lot du dossier — cible de la génération du PDF d'honoraires. */
  lotId: string;
  hasNotary: boolean;
  invoices: InvoiceItem[];
}

export function InvoiceManager({
  dossierId,
  lotId,
  hasNotary,
  invoices,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [number, setNumber] = useState("");
  const [amountHT, setAmountHT] = useState("");
  const [vatRate, setVatRate] = useState("8.5");
  const [amountTTC, setAmountTTC] = useState("");
  const [vendeurNom, setVendeurNom] = useState("");
  const [vendeurAdresse, setVendeurAdresse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function deposit() {
    setError(null);
    if (!number || !amountHT || !amountTTC) {
      setError("Renseignez le numéro et les montants.");
      return;
    }
    startTransition(async () => {
      let fileB64 = "";
      let fileName = "";
      const file = fileRef.current?.files?.[0];
      if (file) {
        try {
          fileB64 = await fileToBase64(file);
          fileName = file.name;
        } catch {
          setError("Lecture du fichier impossible.");
          return;
        }
      }
      const result = await createInvoiceAction({
        dossierId,
        number,
        amountHT: Number(amountHT),
        vatRate: Number(vatRate.replace(",", ".")),
        amountTTC: Number(amountTTC),
        fileB64,
        fileName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNumber("");
      setAmountHT("");
      setAmountTTC("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  function sendToNotary(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await sendInvoiceToNotaryAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {invoices.length > 0 && (
        <ul className="flex flex-col gap-2">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3 text-sm"
            >
              <div>
                <p className="flex items-center gap-1.5 font-medium">
                  <Receipt className="size-4" aria-hidden />
                  Facture {inv.number}
                </p>
                <p className="text-xs text-slate-500">
                  {eur.format(inv.amountTTC)} TTC · {eur.format(inv.amountHT)}{" "}
                  HT
                  {inv.hasFile && " · PDF joint"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {inv.status === "SENT_TO_NOTARY" ? (
                  <Badge variant="success">Transmise au notaire</Badge>
                ) : inv.status === "PAID" ? (
                  <Badge variant="info">Payée</Badge>
                ) : (
                  <Badge variant="warning">Brouillon</Badge>
                )}
                {inv.hasFile && (
                  <a
                    href={`/collaborateur/facturation/${inv.id}/download`}
                    className="text-equatis-turquoise-700 text-xs hover:underline"
                  >
                    Télécharger
                  </a>
                )}
                {inv.status === "DRAFT" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => sendToNotary(inv.id)}
                    disabled={pending || !hasNotary}
                  >
                    <Send className="size-3.5" aria-hidden />
                    Envoyer au notaire
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      {!hasNotary && (
        <p className="text-xs text-amber-700">
          Aucun notaire assigné — la facture pourra être déposée mais pas encore
          transmise.
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">
            N° de facture
          </span>
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="HON-2026-001"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">
            Montant HT (€)
          </span>
          <Input
            type="number"
            step="0.01"
            value={amountHT}
            onChange={(e) => setAmountHT(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">TVA (%)</span>
          <Input
            type="number"
            step="0.01"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">
            Montant TTC (€)
          </span>
          <Input
            type="number"
            step="0.01"
            value={amountTTC}
            onChange={(e) => setAmountTTC(e.target.value)}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs text-slate-500">
            Nom du vendeur
          </span>
          <Input
            value={vendeurNom}
            onChange={(e) => setVendeurNom(e.target.value)}
            placeholder="Nom du vendeur"
          />
        </label>
        <label className="text-sm sm:col-span-4">
          <span className="mb-1 block text-xs text-slate-500">
            Adresse du vendeur
          </span>
          <Input
            value={vendeurAdresse}
            onChange={(e) => setVendeurAdresse(e.target.value)}
            placeholder="Adresse du vendeur"
          />
        </label>
        <label className="text-sm sm:col-span-4">
          <div className="border-t border-slate-100 pt-3">
            <HonorairesPdfDialog
              lotId={lotId}
              facture={number}
              montantHt={amountHT}
              tauxTva={vatRate}
              montantTtc={amountTTC}
              vendeurNom={vendeurNom}
              vendeurAdresse={vendeurAdresse}
            />
          </div>
        </label>
        <label className="text-sm sm:col-span-4">
          <span className="mb-1 block text-xs text-slate-500">
            PDF de la facture (optionnel)
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="inline-block cursor-pointer rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 file:mr-3 file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-sm file:text-slate-700 hover:bg-slate-200 hover:file:bg-slate-300"
          />
        </label>
        <div className="sm:col-span-4">
          <Button type="button" size="sm" onClick={deposit} disabled={pending}>
            <Upload className="size-4" aria-hidden />
            {pending ? "Dépôt…" : "Déposer la facture d'honoraires"}
          </Button>
        </div>
      </div>
    </div>
  );
}
