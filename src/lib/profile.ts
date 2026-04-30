import { decrypt } from "@/lib/crypto";

interface AddressJson {
  line: string;
  postalCode: string;
  city: string;
  country: string;
}

export function decodeAddress(addressEnc: string | null): AddressJson | null {
  if (!addressEnc) return null;
  try {
    const raw = decrypt(addressEnc);
    if (!raw) return null;
    return JSON.parse(raw) as AddressJson;
  } catch {
    return null;
  }
}

export function decodePhone(phoneEnc: string | null): string {
  if (!phoneEnc) return "";
  try {
    return decrypt(phoneEnc);
  } catch {
    return "";
  }
}
