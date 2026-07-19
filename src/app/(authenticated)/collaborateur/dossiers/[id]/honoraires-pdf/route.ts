import { notFound } from "next/navigation";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { findDossierForUser } from "@/lib/dossier/access";
import {
  generateHonorairesPdf,
  type HonorairesPdfData,
} from "@/lib/pdf/pdf-honoraires";
import { formatAdresseProgramme, formatEur } from "@/lib/pdf/letterhead";
import { prisma } from "@/lib/prisma";
import { decodeAddress } from "@/lib/profile";
import { slugify } from "@/lib/utils";
import { getRequestContext } from "@/lib/request-context";
import { getCompanyLogo } from "@/lib/settings";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Paramètres saisis par l'utilisateur dans le dialogue de génération.
// (Aucune donnée sensible : montants et références uniquement.)
const querySchema = z.object({
  montantHT: z.coerce.number().positive().max(99_999_999),
  tauxTva: z.coerce.number().min(0).max(50).default(8.5),
  montantTTC: z.coerce.number().positive().max(99_999_999),
  facture: z.string().trim().min(1).max(40),
  vendeurNom: z.string().max(120).optional(),
  vendeurAdresse: z.string().max(200).optional(),
});

/** Réponse d'erreur lisible (affichée dans l'onglet ouvert). */
function erreur(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request, ctx: RouteContext) {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const { id } = await ctx.params;

  // Contrôle d'accès identique aux autres écrans dossier.
  const allowed = await findDossierForUser(id, me.id, me.role);
  if (!allowed) notFound();

  // Validation des paramètres utilisateur.
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return erreur(JSON.stringify(parsed.error.flatten()), 400);
  }
  const params = parsed.data;

  // Chargement des données du dossier nécessaires au document.
  const dossier = await prisma.dossier.findUnique({
    where: { id },
    include: {
      programme: {
        select: { name: true, address: true, zipcode: true, city: true },
      },
      lots: {
        orderBy: { reference: "asc" },
        select: { reference: true, type: true, floor: true },
      },
      client: { select: { firstName: true, lastName: true } },
      participants: {
        where: { role: "NOTARY" },
        include: {
          user: {
            select: { firstName: true, lastName: true, addressEnc: true },
          },
        },
      },
    },
  });
  if (!dossier) notFound();

  if (!dossier.client) {
    return erreur("Ce dossier n'a pas de client (acquéreur).", 400);
  }
  if (dossier.lots.length === 0) {
    return erreur("Ce dossier n'a aucun lot.", 400);
  }

  // Notaire : participant NOTARY du dossier (adresse déchiffrée côté serveur).
  const notaire = dossier.participants[0]?.user ?? null;
  const adresseNotaire = notaire ? decodeAddress(notaire.addressEnc) : null;

  const numeroFacture = params.facture;

  const data: HonorairesPdfData = {
    numeroFacture,
    vendeurNom: params.vendeurNom?.trim() || "—",
    vendeurAdresse: params.vendeurAdresse?.trim() || null,
    acquereur: `${dossier.client.firstName} ${dossier.client.lastName}`,
    lots: dossier.lots,
    programmeName: dossier.programme.name,
    programmeAddress: formatAdresseProgramme(dossier.programme),
    notaireNom: notaire
      ? `${notaire.firstName} ${notaire.lastName.toUpperCase()}`
      : null,
    notaireAdresse: adresseNotaire
      ? [
          adresseNotaire.line,
          [adresseNotaire.postalCode, adresseNotaire.city]
            .filter(Boolean)
            .join(" "),
        ]
          .filter(Boolean)
          .join(", ") || null
      : null,
    montantHT: params.montantHT,
    tauxTva: params.tauxTva,
    montantTTC: params.montantTTC,
    logoDataUrl: await getCompanyLogo(),
  };

  const pdf = generateHonorairesPdf(data);

  // Trace d'audit après génération réussie uniquement.
  const reqCtx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "DOCUMENT_GENERATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: reqCtx.ip,
    userAgent: reqCtx.userAgent,
    metadata: `PDF honoraires de négociation généré (facture ${numeroFacture}, montant HT ${formatEur(params.montantHT)})`,
  });

  const filename = `equatis_honoraires_${slugify(`${dossier.client.firstName} ${dossier.client.lastName}`)}_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
    },
  });
}
