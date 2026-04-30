import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { decodeAddress, decodePhone } from "@/lib/profile";
import { DeleteAccountSection } from "./delete-account";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const me = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: me.id },
  });

  const address = decodeAddress(user.addressEnc);
  const phone = decodePhone(user.phoneEnc);

  const initial = {
    firstName: user.firstName,
    lastName: user.lastName,
    phone,
    addressLine: address?.line ?? "",
    postalCode: address?.postalCode ?? "",
    city: address?.city ?? "",
    country: address?.country ?? "France",
  };

  const isClient = me.role === "CLIENT";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Mon profil
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Gérer vos coordonnées et la sécurité de votre compte.
        </p>
      </div>

      {isClient && (
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm initial={initial} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      {isClient && (
        <Card>
          <CardHeader>
            <CardTitle>Suppression du compte</CardTitle>
          </CardHeader>
          <CardContent>
            <DeleteAccountSection
              alreadyRequested={user.status === "DELETION_REQUESTED"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
