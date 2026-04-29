import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion",
};

interface PageProps {
  searchParams: Promise<{ from?: string; reason?: string }>;
}

export default async function ConnexionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const from =
    typeof params.from === "string" && params.from.startsWith("/")
      ? params.from
      : undefined;

  return (
    <AuthCard
      title="Connexion"
      description="Espace privé Équatis. Saisissez vos identifiants pour accéder à votre tableau de bord."
      footer={
        <span>
          Pas encore de compte ?{" "}
          <Link
            href="/inscription"
            className="text-equatis-turquoise-700 hover:underline"
          >
            Créer un compte client
          </Link>
        </span>
      }
    >
      {params.reason === "inactivity" && (
        <Alert variant="warning" className="mb-4" role="status">
          Vous avez été déconnecté(e) après 30 minutes d&apos;inactivité.
        </Alert>
      )}
      {params.reason === "logged_out" && (
        <Alert variant="info" className="mb-4" role="status">
          Vous avez été déconnecté(e). À bientôt.
        </Alert>
      )}
      <LoginForm from={from} />
    </AuthCard>
  );
}
