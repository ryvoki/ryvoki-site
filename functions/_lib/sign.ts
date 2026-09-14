import type { Env } from "./types";

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Signs a message with the ECDSA P-256 private key in LICENSE_SIGNING_KEY (JWK JSON).
 * The desktop app verifies with the matching public key and caches the token for offline use.
 * Signature is raw r||s (64 bytes), base64url, which is what .NET's ECDsa.VerifyData expects by default.
 */
export async function signToken(env: Env, message: string): Promise<string | null> {
  if (!env.LICENSE_SIGNING_KEY) return null;
  const jwk = JSON.parse(env.LICENSE_SIGNING_KEY);
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(message));
  return b64url(sig);
}
