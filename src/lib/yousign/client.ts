import { env } from "@/lib/env";

interface YousignSignatureRequestPayload {
  name: string;
  delivery_mode: "email";
  signers: Array<{
    info: {
      first_name: string;
      last_name: string;
      email: string;
      locale: string;
    };
    signature_level: "electronic_signature";
    signature_authentication_mode: "no_otp";
  }>;
}

export interface YousignProcedureCreated {
  id: string;
  status: string;
}

export function isYousignConfigured(): boolean {
  return Boolean(env.YOUSIGN_API_KEY && env.YOUSIGN_API_URL);
}

async function yousignFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!env.YOUSIGN_API_KEY || !env.YOUSIGN_API_URL) {
    throw new Error("Yousign non configuré (YOUSIGN_API_KEY/URL manquant).");
  }
  const url = `${env.YOUSIGN_API_URL.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.YOUSIGN_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Yousign ${response.status} ${path} — ${body.slice(0, 300)}`,
    );
  }
  return response;
}

/**
 * Crée une procédure Yousign en mode SES (Simple Electronic Signature).
 *
 * Workflow Yousign v3 (simplifié) :
 *   1. Créer la signature_request → renvoie procedureId
 *   2. Uploader le document PDF (multipart) — non implémenté ici car
 *      nécessite l'objet S3 streamé ; voir TODO Phase 4.3 v2.
 *   3. Activer la procedure
 *
 * Pour Phase 4.3 MVP, la création de procédure et le tracking webhook
 * sont implémentés ; l'upload PDF reste à câbler avec un fetch S3 + buffer.
 */
export async function createSignatureRequest(
  name: string,
  signer: { firstName: string; lastName: string; email: string },
): Promise<YousignProcedureCreated> {
  const payload: YousignSignatureRequestPayload = {
    name,
    delivery_mode: "email",
    signers: [
      {
        info: {
          first_name: signer.firstName,
          last_name: signer.lastName,
          email: signer.email,
          locale: "fr",
        },
        signature_level: "electronic_signature",
        signature_authentication_mode: "no_otp",
      },
    ],
  };
  const response = await yousignFetch("/signature_requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as YousignProcedureCreated;
  return body;
}

export async function activateSignatureRequest(procedureId: string) {
  await yousignFetch(`/signature_requests/${procedureId}/activate`, {
    method: "POST",
  });
}

/** Mappe les events webhook Yousign vers nos statuts internes. */
export function mapYousignEvent(eventName: string): string | null {
  switch (eventName) {
    case "signature_request.activated":
    case "signer.notified":
      return "SENT";
    case "signer.link.opened":
      return "OPENED";
    case "signer.signed":
    case "signature_request.done":
      return "SIGNED";
    case "signer.declined":
    case "signature_request.declined":
      return "REFUSED";
    case "signature_request.expired":
      return "EXPIRED";
    default:
      return null;
  }
}
