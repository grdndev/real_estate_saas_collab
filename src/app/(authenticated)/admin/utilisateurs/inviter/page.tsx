import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteUserForm } from "./invite-form";

export const metadata: Metadata = { title: "Inviter un utilisateur" };

export default function InviteUserPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/utilisateurs"
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour à la liste
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          Inviter un utilisateur
        </h1>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Nouveau compte</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteUserForm />
        </CardContent>
      </Card>
    </div>
  );
}
