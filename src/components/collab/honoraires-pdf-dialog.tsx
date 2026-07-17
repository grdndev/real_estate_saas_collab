"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface HonorairesPdfDialogProps {
  dossierId: string;
  /** Nom du vendeur pré-rempli (promoteur du programme si disponible). */
  defaultVendeurNom: string;
}

/**
 * Bouton + dialogue de génération du PDF « Honoraires de négociation ».
 * L'utilisateur saisit le montant HT (requis), le taux de TVA, un n° de
 * facture et le vendeur ; le PDF s'ouvre ensuite dans un nouvel onglet
 * via la route GET /collaborateur/dossiers/[id]/honoraires-pdf.
 */
export function HonorairesPdfDialog({
  dossierId,
  defaultVendeurNom,
}: HonorairesPdfDialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [open, setOpen] = React.useState(false);

  // Champs du formulaire (simples états contrôlés, pas de react-hook-form
  // nécessaire pour 5 champs).
  const [montantHT, setMontantHT] = React.useState("");
  const [tauxTva, setTauxTva] = React.useState("8.5");
  const [facture, setFacture] = React.useState("");
  const [vendeurNom, setVendeurNom] = React.useState(defaultVendeurNom);
  const [vendeurAdresse, setVendeurAdresse] = React.useState("");
  const [erreur, setErreur] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);

  function fermer() {
    setOpen(false);
    setErreur(null);
  }

  function genererPdf(e: React.FormEvent) {
    e.preventDefault();
    const montant = Number(montantHT.replace(",", "."));
    if (!Number.isFinite(montant) || montant <= 0) {
      setErreur("Le montant HT est requis et doit être positif.");
      return;
    }
    const taux = Number(tauxTva.replace(",", "."));
    if (!Number.isFinite(taux) || taux < 0 || taux > 50) {
      setErreur("Le taux de TVA doit être compris entre 0 et 50 %.");
      return;
    }

    // Construction de l'URL de la route GET (paramètres validés côté serveur).
    const params = new URLSearchParams({
      montantHT: String(montant),
      tauxTva: String(taux),
    });
    if (facture.trim()) params.set("facture", facture.trim());
    if (vendeurNom.trim()) params.set("vendeurNom", vendeurNom.trim());
    if (vendeurAdresse.trim()) {
      params.set("vendeurAdresse", vendeurAdresse.trim());
    }

    window.open(
      `/collaborateur/dossiers/${dossierId}/honoraires-pdf?${params}`,
      "_blank",
      "noopener",
    );
    fermer();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Générer honoraires (PDF)
      </Button>

      {open &&
        createPortal(
          <dialog
            ref={ref}
            onCancel={(e) => {
              e.preventDefault();
              fermer();
            }}
            onClick={(e) => {
              // Clic sur le fond = fermeture.
              if (e.target === ref.current) fermer();
            }}
            className={cn(
              "rounded-lg border border-slate-200 bg-white p-0 shadow-xl",
              "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-[90vw] max-w-md",
              "backdrop:bg-equatis-night-900/40 backdrop-blur-sm",
            )}
          >
            <form onSubmit={genererPdf}>
              <div className="space-y-4 px-6 py-5">
                <h2 className="text-equatis-night-800 text-lg font-semibold">
                  Honoraires de négociation
                </h2>
                {erreur && <p className="text-sm text-red-600">{erreur}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label="Montant HT (€)"
                    htmlFor="montantHT"
                    required
                  >
                    <Input
                      autoFocus
                      type="number"
                      step="0.01"
                      min="0"
                      value={montantHT}
                      onChange={(e) => setMontantHT(e.target.value)}
                    />
                  </FormField>
                  <FormField label="TVA (%)" htmlFor="tauxTva">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="50"
                      value={tauxTva}
                      onChange={(e) => setTauxTva(e.target.value)}
                    />
                  </FormField>
                </div>

                <FormField
                  label="N° de facture"
                  htmlFor="facture"
                  hint="Laissez vide pour utiliser la référence du dossier"
                >
                  <Input
                    value={facture}
                    onChange={(e) => setFacture(e.target.value)}
                  />
                </FormField>

                <FormField label="Vendeur (société)" htmlFor="vendeurNom">
                  <Input
                    value={vendeurNom}
                    onChange={(e) => setVendeurNom(e.target.value)}
                  />
                </FormField>

                <FormField label="Adresse du vendeur" htmlFor="vendeurAdresse">
                  <Input
                    value={vendeurAdresse}
                    onChange={(e) => setVendeurAdresse(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3">
                <Button variant="outline" type="button" onClick={fermer}>
                  Annuler
                </Button>
                <Button type="submit">Générer le PDF</Button>
              </div>
            </form>
          </dialog>,
          document.body,
        )}
    </>
  );
}
