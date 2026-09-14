import type { Env } from "./types";

/** Signed, HttpOnly cookie sessions for the course portal. The HMAC key is derived from secrets that already exist. */
const COOKIE = "ryvoki_learn";
const TTL_SECONDS = 30 * 24 * 60 * 60;

const enc = (s: string) => new TextEncoder().encode(s);
const b64url = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + ((4 - (s.length % 4)) % 4), "=")), c => c.charCodeAt(0));

function secretFor(env: Env): string | null {
  return env.LICENSE_SIGNING_KEY || env.ADMIN_TOKEN || null;
}

async function hmac(env: Env, message: string): Promise<string> {
  const secret = secretFor(env);
  if (!secret) throw new Error("no session secret configured");
  const key = await crypto.subtle.importKey("raw", enc("ryvoki-learn|" + secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc(message)));
}

export interface Session { licenseId: number; exp: number }

export async function createSessionCookie(env: Env, licenseId: number, request: Request): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${licenseId}.${exp}`;
  const sig = await hmac(env, payload);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_SECONDS}${secure}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function readSession(env: Env, request: Request): Promise<Session | null> {
  const raw = request.headers.get("cookie") || "";
  const match = raw.split(/;\s*/).find(part => part.startsWith(COOKIE + "="));
  if (!match) return null;
  const [id, exp, sig] = match.slice(COOKIE.length + 1).split(".");
  if (!id || !exp || !sig) return null;
  const expected = await hmac(env, `${id}.${exp}`).catch(() => null);
  if (!expected || !timingSafeEqualStr(expected, sig)) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return { licenseId: Number(id), exp: Number(exp) };
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ea = fromB64url(a), eb = fromB64url(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}
