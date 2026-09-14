import type { Ctx, LicenseRow } from "../../_lib/types";
import { json, fail, readJson } from "../../_lib/http";
import { normalizeKey } from "../../_lib/ids";
import { createSessionCookie } from "../../_lib/session";
import { COURSE_PRODUCT } from "../../_lib/course-access";

const ATTEMPTS = 12;
const WINDOW_SECONDS = 900;

/** POST /api/course/login { key } — the license key is the login. Sets a signed HttpOnly cookie for 30 days. */
export const onRequestPost = async ({ request, env }: Ctx) => {
  const body = await readJson<{ key?: string }>(request);
  const key = normalizeKey(String(body?.key || ""));
  if (!key) return fail(400, "invalid_key", "That key isn't in the right format. It looks like RYV-XXXXX-XXXXX-XXXXX-XXXXX.");

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rlKey = `rl:learn:${ip}`;
  if (env.BLOBS) {
    const used = Number((await env.BLOBS.get(rlKey)) || 0);
    if (used >= ATTEMPTS) return fail(429, "rate_limited", "Too many attempts. Wait 15 minutes and try again.");
    await env.BLOBS.put(rlKey, String(used + 1), { expirationTtl: WINDOW_SECONDS });
  }

  const license = await env.DB.prepare("SELECT * FROM licenses WHERE key = ?").bind(key).first<LicenseRow>();
  if (!license) return fail(404, "invalid_key", "Unknown key. Check it on the license page, or open a ticket in the Discord.");
  if (license.product !== COURSE_PRODUCT) return fail(403, "wrong_product", "That key is for a different product. The course key starts the same but is issued when you buy the course.");
  if (license.status !== "active") return fail(403, "revoked", "This key has been revoked. Open a ticket in the Discord if that's a mistake.");

  const cookie = await createSessionCookie(env, license.id, request);
  return json({ ok: true }, 200, { "set-cookie": cookie });
};
