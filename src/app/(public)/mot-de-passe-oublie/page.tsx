import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Saisissez votre adresse email pour recevoir un lien de réinitialisation."
      footer={
        <Link
          href="/connexion"
          className="text-equatis-turquoise-700 hover:underline"
        >
          Retour à la connexion
        </Link>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}
