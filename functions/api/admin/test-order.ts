import type { Ctx } from "../../_lib/types";
import { json, fail, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/admin";
import { findProduct } from "../../_lib/products";
import { makeOrderId } from "../../_lib/ids";

/**
 * POST /api/admin/test-order   Authorization: Bearer <ADMIN_TOKEN>   { product }
 * Creates a pending order WITHOUT calling the payment provider, so the whole
 * order -> mark-paid -> key flow can be tested locally with no crypto.
 */
export const onRequestPost = async ({ request, env }: Ctx) => {
  const denied = requireAdmin(request, env); if (denied) return denied;
  const body = await readJson<{ product?: string; email?: string }>(request);
  const product = await findProduct(env, request, String(body?.product || ""));
  if (!product) return fail(404, "not_found", "Unknown project slug");
  const orderId = makeOrderId();
  await env.DB.prepare(
    "INSERT INTO orders (id, product, email, price_usd, status, provider, invoice_id) VALUES (?, ?, ?, ?, 'pending', 'test', 'test')"
  ).bind(orderId, product.slug, body?.email ?? null, product.priceUsd).run();
  return json({ ok: true, orderId, statusUrl: `/order/?id=${orderId}` });
};
