import type { Env } from "./types";
import { fail, timingSafeEqual } from "./http";

/** Returns a Response (401/503) when the request is NOT an authorized admin call, else null. */
export function requireAdmin(request: Request, env: Env): Response | null {
  if (!env.ADMIN_TOKEN) return fail(503, "no_admin_token", "ADMIN_TOKEN is not configured");
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !timingSafeEqual(token, env.ADMIN_TOKEN)) return fail(401, "unauthorized", "Bad admin token");
  return null;
}
