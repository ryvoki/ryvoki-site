import type { Ctx } from "../../_lib/types";
import { json } from "../../_lib/http";
import { requireAdmin } from "../../_lib/admin";

/** GET /api/admin/orders   Authorization: Bearer <ADMIN_TOKEN>   -> last 100 orders with keys */
export const onRequestGet = async ({ request, env }: Ctx) => {
  const denied = requireAdmin(request, env); if (denied) return denied;
  const rows = await env.DB.prepare(
    "SELECT o.id, o.product, o.email, o.price_usd, o.status, o.pay_currency, o.actually_paid, o.created_at, o.paid_at, l.key FROM orders o LEFT JOIN licenses l ON l.id = o.license_id ORDER BY o.created_at DESC LIMIT 100"
  ).all();
  return json({ ok: true, orders: rows.results });
};
