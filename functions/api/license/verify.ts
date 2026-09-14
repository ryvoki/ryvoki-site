import type { Ctx, LicenseRow } from "../../_lib/types";
import { json, fail, readJson } from "../../_lib/http";
import { normalizeKey } from "../../_lib/ids";
import { signToken } from "../../_lib/sign";

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // the app may run offline for a week between checks

/**
 * POST /api/license/verify  { key, product, machineId, appVersion? }
 * -> { ok, product, exp, sig, activations, maxActivations }
 * The desktop app calls this on first run and then at most once a day.
 * sig = ECDSA-P256(SHA-256) over `${key}|${machineId}|${product}|${exp}`, base64url raw r||s.
 */
export const onRequestPost = async ({ request, env }: Ctx) => {
  const body = await readJson<{ key?: string; product?: string; machineId?: string; appVersion?: string }>(request);
  const key = normalizeKey(String(body?.key || ""));
  const product = String(body?.product || "").trim();
  const machineId = String(body?.machineId || "").trim();
  const appVersion = String(body?.appVersion || "").trim().slice(0, 40) || null;

  if (!key) return fail(400, "invalid_key", "That key isn't in the right format");
  if (!product) return fail(400, "bad_request", "product is required");
  if (machineId.length < 8 || machineId.length > 128) return fail(400, "bad_request", "machineId is required");

  const lic = await env.DB.prepare("SELECT * FROM licenses WHERE key = ?").bind(key).first<LicenseRow>();
  if (!lic) return fail(404, "invalid_key", "Unknown license key");
  if (lic.status !== "active") return fail(403, "revoked", "This key has been revoked");
  if (lic.product !== product) return fail(403, "wrong_product", `This key is for ${lic.product}, not ${product}`);

  const existing = await env.DB.prepare("SELECT id FROM activations WHERE license_id = ? AND machine_id = ?").bind(lic.id, machineId).first<{ id: number }>();
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS n FROM activations WHERE license_id = ?").bind(lic.id).first<{ n: number }>();
  let activations = Number(countRow?.n || 0);

  if (existing) {
    await env.DB.prepare("UPDATE activations SET last_seen = strftime('%Y-%m-%dT%H:%M:%fZ','now'), app_version = COALESCE(?, app_version) WHERE id = ?").bind(appVersion, existing.id).run();
  } else {
    if (activations >= lic.max_activations) return fail(403, "activation_limit", `This key is already active on ${lic.max_activations} PCs`);
    await env.DB.prepare("INSERT INTO activations (license_id, machine_id, app_version) VALUES (?, ?, ?)").bind(lic.id, machineId, appVersion).run();
    activations += 1;
  }

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const sig = await signToken(env, `${key}|${machineId}|${product}|${exp}`);
  return json({ ok: true, product, exp, sig, activations, maxActivations: lic.max_activations });
};
