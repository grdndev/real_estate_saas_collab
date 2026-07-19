import { notFound } from "next/navigation";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import {
  generateAppelFondsPdf,
  type AppelFondsPdfData,
} from "@/lib/pdf/pdf-appel-fonds";
import { formatAdresseProgramme } from "@/lib/pdf/letterhead";
import { prisma } from "@/lib/prisma";
import { decodeAddress } from "@/lib/profile";
import { getRequestContext } from "@/lib/request-context";
import { getCompanyLogo } from "@/lib/settings";

interface RouteContext {
  params: Promise<{ lotId: string }>;
}

// Seul le numéro d'appel transite en query param (aucune donnée sensible).
const querySchema = z.object({
  numero: z.coerce.number().int().min(1).max(100),
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
  const { lotId } = await ctx.params;

  // Validation du paramètre utilisateur.
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return erreur("Paramètre « numero » invalide.", 400);
  }
  const { numero } = parsed.data;

  // Chargement du lot, de son suivi de fonds et du client du dossier.
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      programme: {
        select: { name: true, address: true, zipcode: true, city: true },
      },
      dossier: {
        include: {
          client: {
            select: { firstName: true, lastName: true, addressEnc: true },
          },
        },
      },
      fondsSuivi: {
        include: {
          fondsAppeles: {
            where: { appelFonds: { numero } },
            include: { appelFonds: true },
          },
        },
      },
    },
  });
  if (!lot) notFound();

  // Erreurs métier explicites avant génération.
  const client = lot.dossier?.client ?? null;
  if (!client) {
    return erreur("Ce lot n'a pas de dossier client.", 400);
  }
  // L'adresse est déchiffrée UNIQUEMENT côté serveur, jamais en query param.
  const adresse = decodeAddress(client.addressEnc);
  if (!adresse) {
    return erreur("Le client n'a pas d'adresse postale renseignée.", 400);
  }
  const fondsAppele = lot.fondsSuivi?.fondsAppeles[0] ?? null;
  if (!fondsAppele) {
    return erreur(`Appel de fonds n° ${numero} introuvable pour ce lot.`, 404);
  }
  const appel = fondsAppele.appelFonds;
  // On ne génère pas de courrier pour un appel non encore débloqué.
  if (appel.datePrevue > new Date()) {
    return erreur(
      `L'appel de fonds n° ${numero} n'est pas encore débloqué.`,
      400,
    );
  }

  const data: AppelFondsPdfData = {
    clientNom: `${client.firstName} ${client.lastName}`.trim(),
    clientAdresse: [
      adresse.line,
      `${adresse.postalCode} ${adresse.city}`.trim(),
      ...(adresse.country ? [adresse.country] : []),
    ].filter(Boolean),
    programmeName: lot.programme.name,
    programmeAdresse:
      formatAdresseProgramme(lot.programme) ??
      "Adresse du programme non renseignée",
    lotReference: lot.reference,
    appelLabel: appel.label,
    appelPourcentage: Number(appel.pourcentage),
    appelMontant: Number(fondsAppele.montant),
    logoDataUrl: await getCompanyLogo(),
  };

  const pdf = generateAppelFondsPdf(data);

  // Trace d'audit après génération réussie uniquement.
  const reqCtx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "DOCUMENT_GENERATED",
    resourceType: "Lot",
    resourceId: lot.id,
    ip: reqCtx.ip,
    userAgent: reqCtx.userAgent,
    metadata: `PDF appel de fonds généré (appel n° ${appel.numero} « ${appel.label} », lot ${lot.reference})`,
  });

  const filename = `equatis_appel_fonds_${lot.reference}_appel${appel.numero}_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
    },
  });
}
