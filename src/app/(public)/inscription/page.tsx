import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Inscription client",
};

export default function InscriptionPage() {
  return (
    <AuthCard
      title="Créer un compte client"
      description="Réservé aux acquéreurs Équatis. Les comptes Collaborateur, Promoteur et Notaire sont créés par l'administrateur."
      footer={
        <span>
          Vous avez déjà un compte ?{" "}
          <Link
            href="/connexion"
            className="text-equatis-turquoise-700 hover:underline"
          >
            Se connecter
          </Link>
        </span>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
