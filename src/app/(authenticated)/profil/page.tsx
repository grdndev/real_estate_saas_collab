import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { decodeAddress, decodePhone } from "@/lib/profile";
import { DeleteAccountSection } from "./delete-account";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mon profil" };

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COLLABORATOR: "Collaborateur",
  PROMOTER: "Promoteur",
  NOTARY: "Notaire",
  CLIENT: "Client",
};

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" }
> = {
  ACTIVE: { label: "Actif", variant: "success" },
  PENDING_EMAIL: { label: "Email à confirmer", variant: "warning" },
  PENDING_ASSOCIATION: {
    label: "En attente d'association",
    variant: "warning",
  },
  SUSPENDED: { label: "Suspendu", variant: "danger" },
  DELETION_REQUESTED: { label: "Suppression demandée", variant: "danger" },
};

export default async function ProfilePage() {
  const me = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: me.id },
    include: {
      clientProfile: true,
    },
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
    birthName: user.clientProfile?.birthName ?? "",
    birthDate: user.clientProfile?.birthDate?.toISOString().slice(0, 10) ?? "",
    birthPlace: user.clientProfile?.birthPlace ?? "",
    profession: user.clientProfile?.profession ?? "",
    nationality: user.clientProfile?.nationality ?? "",
    familyStatus: user.clientProfile?.familyStatus ?? "",
    marriageDate:
      user.clientProfile?.marriageDate?.toISOString().slice(0, 10) ?? "",
    marriagePlace: user.clientProfile?.marriagePlace ?? "",
    marriageContract: user.clientProfile?.marriageContract ?? "",
  };

  const isClient = me.role === "CLIENT";
  const initials =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const status = STATUS_LABEL[user.status] ?? {
    label: user.status,
    variant: "neutral" as const,
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Mon profil
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Gérer vos coordonnées et la sécurité de votre compte.
        </p>
      </div>

      {/* En-tête profil */}
      <Card className="mt-5">
        <CardContent className="flex flex-col items-center gap-4 py-6 sm:flex-row sm:items-center">
          <span
            className="bg-equatis-turquoise-600 flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
            aria-hidden
          >
            {initials}
          </span>
          <div className="text-center sm:text-left">
            <p className="text-equatis-night-800 text-lg font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-slate-500">{user.email}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge variant="primary">
                {ROLE_LABEL[user.role] ?? user.role}
              </Badge>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Détails du compte */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Informations du compte</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Field label="Prénom" value={user.firstName} />
          <Field label="Nom" value={user.lastName} />
          <Field label="Adresse email" value={user.email} full />
          <Field label="Rôle" value={ROLE_LABEL[user.role] ?? user.role} />
          <Field
            label="Membre depuis"
            value={user.createdAt.toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          />
          <Field
            label="Dernière connexion"
            value={
              user.lastLoginAt ? user.lastLoginAt.toLocaleString("fr-FR") : "—"
            }
          />
          {!isClient && phone && <Field label="Téléphone" value={phone} />}
        </CardContent>
      </Card>

      {isClient && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm initial={initial} />
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Sécurité — mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      {isClient && (
        <Card className="mt-6">
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

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-equatis-night-800 mt-0.5 font-medium">{value}</p>
    </div>
  );
}
