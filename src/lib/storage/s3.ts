import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type Readable } from "node:stream";
import { env } from "@/lib/env";

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (
    !env.S3_ENDPOINT ||
    !env.S3_REGION ||
    !env.S3_ACCESS_KEY_ID ||
    !env.S3_SECRET_ACCESS_KEY
  ) {
    throw new Error(
      "Stockage S3 non configuré. Renseignez S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY dans .env.",
    );
  }
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      // OVH Object Storage et MinIO requièrent path-style.
      forcePathStyle: true,
    });
  }
  return s3Client;
}

function getBucket(): string {
  if (!env.S3_BUCKET) {
    throw new Error("S3_BUCKET non défini.");
  }
  return env.S3_BUCKET;
}

const UPLOAD_TTL_SECONDS = 15 * 60; // CDC §11.2 — URLs signées 15 min
const DOWNLOAD_TTL_SECONDS = 15 * 60;

/** URL signée pour PUT direct depuis le navigateur. */
export async function presignUploadUrl(
  storageKey: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(getClient(), command, { expiresIn: UPLOAD_TTL_SECONDS });
}

/** URL signée pour GET — utilisée pour le téléchargement par les rôles autorisés. */
export async function presignDownloadUrl(
  storageKey: string,
  fileName: string,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  });
  return getSignedUrl(getClient(), command, {
    expiresIn: DOWNLOAD_TTL_SECONDS,
  });
}

export async function deleteObject(storageKey: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: storageKey }),
  );
}

/** Lit l'objet en mémoire (utilisé par le worker antivirus pour scan). */
export async function readObject(storageKey: string): Promise<Buffer> {
  const response = await getClient().send(
    new GetObjectCommand({ Bucket: getBucket(), Key: storageKey }),
  );
  if (!response.Body) {
    throw new Error(`Objet S3 vide ou inaccessible : ${storageKey}`);
  }
  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function isStorageConfigured(): boolean {
  return Boolean(
    env.S3_ENDPOINT &&
    env.S3_REGION &&
    env.S3_BUCKET &&
    env.S3_ACCESS_KEY_ID &&
    env.S3_SECRET_ACCESS_KEY,
  );
}

export function buildDocumentKey(
  dossierId: string,
  documentId: string,
): string {
  return `dossiers/${dossierId}/${documentId}`;
}
