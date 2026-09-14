// Unambiguous alphabet (no 0/O/1/I). 32 symbols, so a random byte mod 32 is unbiased.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomChars(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % 32];
  return s;
}

export const makeOrderId = () => "ORD-" + randomChars(8);
export const makeLicenseKey = () => "RYV-" + [5, 5, 5, 5].map(randomChars).join("-");

/** Accepts sloppy input ("ryv k7m2p q9xw3 ...") and returns the canonical RYV-XXXXX-XXXXX-XXXXX-XXXXX form, or null. */
export function normalizeKey(input: string): string | null {
  const s = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s.startsWith("RYV") || s.length !== 23) return null;
  const body = s.slice(3);
  for (const ch of body) if (!ALPHABET.includes(ch)) return null;
  return "RYV-" + body.match(/.{5}/g)!.join("-");
}

export function normalizeOrderId(input: string): string | null {
  const s = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s.startsWith("ORD") || s.length !== 11) return null;
  return "ORD-" + s.slice(3);
}
