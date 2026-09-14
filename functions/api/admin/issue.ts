import type { Ctx } from "../../_lib/types";
import { json, fail, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/admin";
import { issueLicense } from "../../_lib/fulfil";
import { findProduct } from "../../_lib/products";

/**
 * POST /api/admin/issue   Authorization: Bearer <ADMIN_TOKEN>
 * { product, count?, maxActivations?, note? }  ->  { keys: [...] }
 * For giveaways, refunds, or people who paid you directly.
 */
export const onRequestPost = async ({ request, env }: Ctx) => {
  const denied = requireAdmin(request, env); if (denied) return denied;
  const body = await readJson<{ product?: string; count?: number; maxActivations?: number; note?: string }>(request);
  if (!body?.product) return fail(400, "bad_request", "product is required");
  const product = await findProduct(env, request, body.product);
  if (!product) return fail(404, "not_found", "Unknown project slug");
  const count = Math.min(50, Math.max(1, Number(body.count) || 1));
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const lic = await issueLicense(env, product.slug, { maxActivations: body.maxActivations ?? product.maxActivations ?? 3, note: body.note ?? "manual" });
    keys.push(lic.key);
  }
  return json({ ok: true, product: product.slug, keys });
};
