import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
} from "node:crypto";
import { env } from "@/lib/env";

// AES-256-GCM. Format de stockage : "v1:iv_b64:tag_b64:ciphertext_b64".
// IV = 12 bytes (recommandé GCM), Tag = 16 bytes.
const ALGO = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  // DATA_ENCRYPTION_KEY est validé en hex 64 chars (32 bytes) par env.ts.
  return Buffer.from(env.DATA_ENCRYPTION_KEY, "hex");
}

/**
 * Chiffre une chaîne en clair.
 * @returns chaîne au format `v1:iv:tag:ciphertext` (base64).
 */
export function encrypt(plaintext: string): string {
  if (plaintext === "") return "";
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Déchiffre une chaîne `v1:iv:tag:ciphertext`.
 * Lance une erreur si le tag GCM ne correspond pas (intégrité compromise).
 */
export function decrypt(payload: string): string {
  if (payload === "") return "";
  const parts = payload.split(":");
  if (parts.length !== 4) {
    throw new Error("Format de chiffrement invalide");
  }
  const [version, ivB64, tagB64, ctB64] = parts;
  if (version !== VERSION) {
    throw new Error(`Version de chiffrement non supportée : ${version}`);
  }
  const iv = Buffer.from(ivB64!, "base64");
  const tag = Buffer.from(tagB64!, "base64");
  const ciphertext = Buffer.from(ctB64!, "base64");
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error("IV ou tag de longueur incorrecte");
  }
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/**
 * Hash déterministe d'un token (refresh, reset, verification) pour stockage en base.
 * On utilise scrypt avec sel constant dérivé d'AUTH_SECRET — but : empêcher
 * l'utilisation directe d'un dump base sans connaître le secret applicatif.
 * Pour les mots de passe, on utilise bcrypt (voir lib/auth/password.ts).
 */
export function hashToken(token: string): string {
  // Sel applicatif fixe : pas un sel aléatoire ; objectif = lookup déterministe.
  const salt = scryptSync(env.AUTH_SECRET, "equatis.token.v1", 16);
  const hash = scryptSync(token, salt, 32);
  return hash.toString("base64");
}
