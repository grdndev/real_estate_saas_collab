import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { Alert } from "@/components/ui/alert";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Réinitialisation",
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ReinitialisationPage({
  searchParams,
}: PageProps) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <AuthCard
        title="Lien invalide"
        description="Aucun token reçu dans le lien."
      >
        <Alert variant="danger">
          Le lien de réinitialisation est manquant ou invalide.
        </Alert>
        <Link
          href="/mot-de-passe-oublie"
          className="text-equatis-turquoise-700 mt-4 inline-block text-sm hover:underline"
        >
          Demander un nouveau lien
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Choisir un nouveau mot de passe"
      description="Le lien est valable 2 heures à partir de la demande."
    >
      <ResetForm token={token} />
    </AuthCard>
  );
}
