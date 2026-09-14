import type { Env, OrderRow, LicenseRow } from "./types";
import { makeLicenseKey } from "./ids";
import { findProduct } from "./products";

/** Creates a license row with a unique key. Retries on the (astronomically unlikely) collision. */
export async function issueLicense(env: Env, product: string, opts: { orderId?: string | null; maxActivations?: number; note?: string | null } = {}): Promise<LicenseRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = makeLicenseKey();
    try {
      await env.DB.prepare("INSERT INTO licenses (key, product, order_id, max_activations, note) VALUES (?, ?, ?, ?, ?)")
        .bind(key, product, opts.orderId ?? null, opts.maxActivations ?? 3, opts.note ?? null).run();
      const row = await env.DB.prepare("SELECT * FROM licenses WHERE key = ?").bind(key).first<LicenseRow>();
      if (row) return row;
    } catch (e) {
      if (!String(e).includes("UNIQUE")) throw e;
    }
  }
  throw new Error("could not generate a unique key");
}

/** Marks an order paid and attaches a license. Idempotent: a paid order keeps its existing key. */
export async function fulfilOrder(env: Env, request: Request, order: OrderRow, extra: { paymentId?: string | null; payCurrency?: string | null; actuallyPaid?: number | null } = {}): Promise<LicenseRow> {
  if (order.status === "paid" && order.license_id) {
    const existing = await env.DB.prepare("SELECT * FROM licenses WHERE id = ?").bind(order.license_id).first<LicenseRow>();
    if (existing) return existing;
  }
  const product = await findProduct(env, request, order.product);
  const lic = await issueLicense(env, order.product, { orderId: order.id, maxActivations: product?.maxActivations ?? 3 });
  await env.DB.prepare(
    "UPDATE orders SET status = 'paid', license_id = ?, paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), payment_id = COALESCE(?, payment_id), pay_currency = COALESCE(?, pay_currency), actually_paid = COALESCE(?, actually_paid) WHERE id = ?"
  ).bind(lic.id, extra.paymentId ?? null, extra.payCurrency ?? null, extra.actuallyPaid ?? null, order.id).run();
  return lic;
}
