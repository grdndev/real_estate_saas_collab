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
  signers?: Array<{ id: string }>;
}

interface YousignDocumentCreated {
  id: string;
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
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Yousign ${response.status} ${path} — ${body.slice(0, 500)}`,
    );
  }
  return response;
}

async function yousignJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await yousignFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return (await response.json()) as T;
}

/**
 * Crée une procédure Yousign en mode SES (Simple Electronic Signature)
 * avec un signataire unique. La procédure est créée en statut `draft`
 * — il faut ensuite uploader un PDF puis l'activer.
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
  return yousignJson<YousignProcedureCreated>("/signature_requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Upload un document PDF (multipart) à une procédure Yousign existante.
 * Renvoie l'ID du document tel que stocké côté Yousign.
 */
export async function uploadDocument(
  procedureId: string,
  fileName: string,
  pdfBuffer: Buffer,
): Promise<YousignDocumentCreated> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([pdfBuffer.buffer as ArrayBuffer], { type: "application/pdf" }),
    fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
  );
  form.append("nature", "signable_document");
  form.append("parse_anchors", "false");

  // Ne pas passer Content-Type — fetch le construit avec le boundary pour multipart.
  const response = await yousignFetch(
    `/signature_requests/${procedureId}/documents`,
    { method: "POST", body: form },
  );
  return (await response.json()) as YousignDocumentCreated;
}

/**
 * Ajoute un champ "signature" au document — placement automatique
 * en bas à droite de la dernière page. Yousign v3 requiert au moins
 * un champ par signataire pour activer la procédure SES.
 */
export async function addSignatureField(
  procedureId: string,
  documentId: string,
  signerId: string,
): Promise<void> {
  await yousignJson(
    `/signature_requests/${procedureId}/documents/${documentId}/fields`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "signature",
        signer_id: signerId,
        page: 1, // page 1 par défaut — Yousign placera sur la dernière page si <= 0
        x: 350,
        y: 700,
        height: 50,
        width: 200,
      }),
    },
  );
}

/** Active la procédure : Yousign envoie l'email de signature au signataire. */
export async function activateSignatureRequest(
  procedureId: string,
): Promise<void> {
  await yousignFetch(`/signature_requests/${procedureId}/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

/** Liste les documents d'une procédure de signature. */
export async function listProcedureDocuments(
  procedureId: string,
): Promise<{ id: string }[]> {
  const response = await yousignFetch(
    `/signature_requests/${procedureId}/documents`,
    { method: "GET" },
  );
  const json = (await response.json()) as unknown;
  if (Array.isArray(json)) return json as { id: string }[];
  if (
    json &&
    typeof json === "object" &&
    "data" in json &&
    Array.isArray((json as { data: unknown }).data)
  ) {
    return (json as { data: { id: string }[] }).data;
  }
  return [];
}

/** Télécharge le PDF signé final depuis Yousign (après statut SIGNED). */
export async function downloadSignedDocument(
  procedureId: string,
  documentId: string,
): Promise<Buffer> {
  const response = await yousignFetch(
    `/signature_requests/${procedureId}/documents/${documentId}/download`,
    { method: "GET" },
  );
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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
