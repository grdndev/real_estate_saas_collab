"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

interface HonorairesPdfDialogProps {
  facture: string;
  montantHt: string;
  tauxTva: string;
  montantTtc: string;
  dossierId: string;
  vendeurNom: string;
  vendeurAdresse: string;
}

/**
 * Bouton + dialogue de génération du PDF « Honoraires de négociation ».
 * L'utilisateur saisit le montant HT (requis), le taux de TVA, un n° de
 * facture (requis) et le vendeur ; le PDF s'ouvre ensuite dans un nouvel onglet
 * via la route GET /collaborateur/dossiers/[id]/honoraires-pdf.
 */
export function HonorairesPdfDialog({
  facture,
  montantHt,
  tauxTva,
  montantTtc,
  dossierId,
  vendeurNom,
  vendeurAdresse,
}: HonorairesPdfDialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [open, setOpen] = React.useState(false);
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
    if (!facture.trim()) {
      setErreur("Le numéro de facture est requis.");
      return;
    }
    const montant = Number(montantHt.replace(",", "."));
    if (!Number.isFinite(montant) || montant <= 0) {
      setErreur("Le montant HT est requis et doit être positif.");
      return;
    }
    const taux = Number(tauxTva.replace(",", "."));
    if (!Number.isFinite(taux) || taux < 0 || taux > 50) {
      setErreur("Le taux de TVA doit être compris entre 0 et 50 %.");
      return;
    }
    const calc = Number(montantTtc.replace(",", "."));
    if (!Number.isFinite(calc) || calc <= 0) {
      setErreur("Le montant TTC est requis et doit être positif.");
      return;
    }

    // Construction de l'URL de la route GET (paramètres validés côté serveur).
    const params = new URLSearchParams({
      montantHT: String(montant),
      tauxTva: String(taux),
      montantTTC: String(calc),
    });
    params.set("facture", facture.trim());
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
      <Button variant="outline" size="sm" onClick={genererPdf}>
        Générer honoraires (PDF)
      </Button>
    </>
  );
}
