import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/crypto";

/**
 * Génère un token aléatoire URL-safe (base64url, 32 bytes ⇒ 256 bits d'entropie).
 * @returns `{ token, hash }` — `token` est envoyé à l'utilisateur, `hash` stocké en base.
 */
export function generateOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
