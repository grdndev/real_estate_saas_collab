import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Vérifie complexité minimale exigée par CDC §3.1 :
 *  >= 8 chars, 1 majuscule, 1 chiffre.
 */
export function isPasswordCompliant(plain: string): boolean {
  return /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(plain);
}
