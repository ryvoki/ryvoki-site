import type { Ctx, OrderRow } from "../../_lib/types";
import { json, fail } from "../../_lib/http";
import { normalizeOrderId } from "../../_lib/ids";

/** GET /api/order/:id -> public order status (+ key once paid). */
export const onRequestGet = async ({ params, env }: Ctx<{ id: string }>) => {
  const id = normalizeOrderId(params.id);
  if (!id) return fail(400, "bad_id", "That doesn't look like an order ID");

  const row = await env.DB.prepare(
    "SELECT o.*, l.key AS license_key FROM orders o LEFT JOIN licenses l ON l.id = o.license_id WHERE o.id = ?"
  ).bind(id).first<OrderRow & { license_key: string | null }>();
  if (!row) return fail(404, "not_found", "No order with that ID");

  return json({
    ok: true,
    order: {
      id: row.id,
      product: row.product,
      status: row.status,
      priceUsd: row.price_usd,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      emailHint: !!row.email,
      key: row.status === "paid" ? row.license_key : undefined,
    },
  });
};
