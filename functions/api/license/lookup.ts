import type { Ctx, LicenseRow } from "../../_lib/types";
import { json, fail, readJson } from "../../_lib/http";
import { normalizeKey, normalizeOrderId } from "../../_lib/ids";

/**
 * POST /api/license/lookup
 *   { orderId }  -> { licenses: [...] }   keys for that paid order
 *   { email }    -> { licenses: [...] }   keys for all paid orders under that email
 *   { key }      -> { license: {...} }    status of one key (no secrets revealed)
 */
export const onRequestPost = async ({ request, env }: Ctx) => {
  const body = await readJson<{ orderId?: string; email?: string; key?: string }>(request);
  if (!body) return fail(400, "bad_request", "Send JSON");

  const pick = (rows: LicenseRow[]) => rows.map(l => ({ key: l.key, product: l.product, orderId: l.order_id, status: l.status }));

  if (body.orderId) {
    const id = normalizeOrderId(body.orderId);
    if (!id) return fail(400, "bad_id", "That doesn't look like an order ID");
    const rows = await env.DB.prepare(
      "SELECT l.* FROM orders o JOIN licenses l ON l.id = o.license_id WHERE o.id = ? AND o.status = 'paid'"
    ).bind(id).all<LicenseRow>();
    return json({ ok: true, licenses: pick(rows.results) });
  }

  if (body.email) {
    const email = String(body.email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, "bad_email", "That email doesn't look right");
    const rows = await env.DB.prepare(
      "SELECT l.* FROM orders o JOIN licenses l ON l.id = o.license_id WHERE o.email = ? AND o.status = 'paid' ORDER BY o.paid_at DESC LIMIT 20"
    ).bind(email).all<LicenseRow>();
    return json({ ok: true, licenses: pick(rows.results) });
  }

  if (body.key) {
    const key = normalizeKey(body.key);
    if (!key) return fail(400, "invalid_key", "That key isn't in the right format");
    const lic = await env.DB.prepare("SELECT * FROM licenses WHERE key = ?").bind(key).first<LicenseRow>();
    if (!lic) return fail(404, "invalid_key", "Unknown license key");
    const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM activations WHERE license_id = ?").bind(lic.id).first<{ n: number }>();
    return json({ ok: true, license: { product: lic.product, status: lic.status, activations: Number(c?.n || 0), maxActivations: lic.max_activations } });
  }

  return fail(400, "bad_request", "Send orderId, email, or key");
};
