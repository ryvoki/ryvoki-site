import type { Ctx, OrderRow } from "../_lib/types";
import { verifyIpnSignature, type IpnPayload } from "../_lib/nowpayments";
import { fulfilOrder } from "../_lib/fulfil";

/**
 * POST /api/ipn  (NOWPayments webhook)
 * Verifies x-nowpayments-sig, logs every call, and issues the license when payment_status = finished.
 */
export const onRequestPost = async ({ request, env }: Ctx) => {
  const raw = await request.text();
  const sig = request.headers.get("x-nowpayments-sig") || "";

  let payload: IpnPayload;
  try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  const valid = env.NOWPAYMENTS_IPN_SECRET ? await verifyIpnSignature(env.NOWPAYMENTS_IPN_SECRET, payload, sig) : false;
  const orderId = String(payload.order_id || "");
  const status = String(payload.payment_status || "");

  await env.DB.prepare("INSERT INTO webhook_log (provider, order_id, status, valid_sig, body) VALUES ('nowpayments', ?, ?, ?, ?)")
    .bind(orderId, status, valid ? 1 : 0, raw.slice(0, 8000)).run();

  if (!valid) return new Response("invalid signature", { status: 401 });

  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first<OrderRow>();
  if (!order) return new Response("unknown order", { status: 200 }); // 200 so the provider stops retrying

  const paymentId = payload.payment_id != null ? String(payload.payment_id) : null;
  const payCurrency = payload.pay_currency ? String(payload.pay_currency) : null;
  const actuallyPaid = typeof payload.actually_paid === "number" ? payload.actually_paid : null;

  if (status === "finished") {
    await fulfilOrder(env, request, order, { paymentId, payCurrency, actuallyPaid });
  } else if (order.status !== "paid") {
    const next =
      status === "partially_paid" ? "partial" :
      status === "failed" ? "failed" :
      status === "expired" ? "expired" :
      status === "refunded" ? "refunded" : "pending";
    await env.DB.prepare(
      "UPDATE orders SET status = ?, payment_id = COALESCE(?, payment_id), pay_currency = COALESCE(?, pay_currency), actually_paid = COALESCE(?, actually_paid) WHERE id = ?"
    ).bind(next, paymentId, payCurrency, actuallyPaid, order.id).run();
  }

  return new Response("ok");
};
