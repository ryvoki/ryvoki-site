import type { Ctx, OrderRow } from "../../_lib/types";
import { json, fail, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/admin";
import { fulfilOrder } from "../../_lib/fulfil";
import { normalizeOrderId } from "../../_lib/ids";

/**
 * POST /api/admin/mark-paid   Authorization: Bearer <ADMIN_TOKEN>   { orderId }
 * Manually completes an order (someone paid you directly, or you're testing locally).
 */
export const onRequestPost = async ({ request, env }: Ctx) => {
  const denied = requireAdmin(request, env); if (denied) return denied;
  const body = await readJson<{ orderId?: string }>(request);
  const id = normalizeOrderId(String(body?.orderId || ""));
  if (!id) return fail(400, "bad_id", "orderId required");
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!order) return fail(404, "not_found", "No such order");
  const lic = await fulfilOrder(env, request, order, { paymentId: "manual" });
  return json({ ok: true, orderId: id, key: lic.key });
};
