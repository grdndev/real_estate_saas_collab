import { prisma } from "@/lib/prisma";
import { decodeAddress, decodePhone } from "@/lib/profile";
import { displayableEmail } from "@/lib/user/no-account";

/**
 * Lecture des « clients associés » sans compte (T7).
 *
 * Module séparé de `actions.ts` : celui-ci est marqué `"use server"` et ne peut
 * exporter que des server actions.
 */

export interface AssociatedClientRow {
  id: string;
  firstName: string;
  lastName: string;
  /** `null` quand la fiche n'a qu'une adresse technique. */
  email: string | null;
  phone: string;
  createdAt: Date;
  /** Dossiers en cours — bloquent la suppression tant qu'ils existent. */
  activeDossiers: number;
  archivedDossiers: number;
  /** Lot du dossier actif le plus récent, pour le lien « ouvrir ». */
  activeLot: { id: string; reference: string; programmeName: string } | null;
}

export async function loadAssociatedClients(): Promise<AssociatedClientRow[]> {
  const clients = await prisma.user.findMany({
    where: { role: "CLIENT", status: "NO_ACCOUNT", deletedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneEnc: true,
      createdAt: true,
      clientDossiers: {
        select: {
          archivedAt: true,
          lot: {
            select: {
              id: true,
              reference: true,
              programme: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return clients.map((c) => {
    const active = c.clientDossiers.filter((d) => d.archivedAt === null);
    const first = active[0] ?? null;
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: displayableEmail(c.email),
      phone: decodePhone(c.phoneEnc),
      createdAt: c.createdAt,
      activeDossiers: active.length,
      archivedDossiers: c.clientDossiers.length - active.length,
      activeLot: first
        ? {
            id: first.lot.id,
            reference: first.lot.reference,
            programmeName: first.lot.programme.name,
          }
        : null,
    };
  });
}

export interface AssociatedClientDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
}

/** Fiche d'un client associé, `null` s'il n'existe pas ou a un compte. */
export async function loadAssociatedClient(
  clientId: string,
): Promise<AssociatedClientDetail | null> {
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      role: true,
      status: true,
      deletedAt: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneEnc: true,
      addressEnc: true,
    },
  });
  if (
    !client ||
    client.role !== "CLIENT" ||
    client.status !== "NO_ACCOUNT" ||
    client.deletedAt
  ) {
    return null;
  }

  const address = decodeAddress(client.addressEnc);
  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    // L'adresse technique n'est jamais présentée comme une saisie de l'équipe.
    email: displayableEmail(client.email) ?? "",
    phone: decodePhone(client.phoneEnc),
    addressLine: address?.line ?? "",
    postalCode: address?.postalCode ?? "",
    city: address?.city ?? "",
    country: address?.country ?? "",
  };
}
