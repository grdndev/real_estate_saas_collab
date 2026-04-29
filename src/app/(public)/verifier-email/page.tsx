import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { verifyEmailAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Confirmation email",
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthCard
        title="Lien invalide"
        description="Aucun token reçu dans le lien."
      >
        <Alert variant="danger">Lien d&apos;activation manquant.</Alert>
      </AuthCard>
    );
  }

  const result = await verifyEmailAction(token);

  return (
    <AuthCard
      title={result.ok ? "Compte activé" : "Activation impossible"}
      description={
        result.ok
          ? "Votre adresse email est confirmée."
          : "Le lien d'activation n'a pas pu être validé."
      }
    >
      {result.ok ? (
        <div className="space-y-4">
          <Alert variant="success">
            Votre compte est maintenant en attente d&apos;association à un
            dossier par votre collaborateur référent.
          </Alert>
          <Link href="/connexion" className="block">
            <Button block>Se connecter</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert variant="danger">{result.error}</Alert>
          <Link href="/connexion" className="block">
            <Button block variant="outline">
              Retour à la connexion
            </Button>
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
