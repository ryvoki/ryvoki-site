import type { Env } from "./types";
import { timingSafeEqual } from "./http";

const enc = (s: string) => new TextEncoder().encode(s);
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

export interface InvoiceInput { orderId: string; priceUsd: number; description: string; successUrl: string; cancelUrl: string; ipnUrl: string }
export interface Invoice { id: string; url: string }

/** POST /v1/invoice on NOWPayments. Returns the hosted checkout page URL. */
export async function createInvoice(env: Env, i: InvoiceInput): Promise<Invoice> {
  const base = (env.NOWPAYMENTS_API_BASE || "https://api.nowpayments.io/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/invoice`, {
    method: "POST",
    headers: { "x-api-key": env.NOWPAYMENTS_API_KEY!, "content-type": "application/json" },
    body: JSON.stringify({
      price_amount: i.priceUsd,
      price_currency: "usd",
      order_id: i.orderId,
      order_description: i.description,
      ipn_callback_url: i.ipnUrl,
      success_url: i.successUrl,
      cancel_url: i.cancelUrl,
      is_fee_paid_by_user: false,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string | number; invoice_url?: string; message?: string };
  if (!res.ok || !data.invoice_url) throw new Error(`NOWPayments invoice failed (${res.status}): ${data.message || "no invoice_url"}`);
  return { id: String(data.id), url: data.invoice_url };
}

/** Recursively sort object keys. NOWPayments signs JSON.stringify(sortedPayload). */
export function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) out[k] = sortDeep((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

/** x-nowpayments-sig = HMAC-SHA512(ipn_secret, JSON.stringify(sorted body)) as lowercase hex. */
export async function verifyIpnSignature(secret: string, payload: unknown, signature: string): Promise<boolean> {
  if (!signature) return false;
  const message = JSON.stringify(sortDeep(payload));
  const key = await crypto.subtle.importKey("raw", enc(secret.trim()), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, enc(message)));
  return timingSafeEqual(mac, signature.trim().toLowerCase());
}

export interface IpnPayload {
  payment_id?: number | string; payment_status?: string; order_id?: string; price_amount?: number; price_currency?: string;
  pay_amount?: number; actually_paid?: number; pay_currency?: string; invoice_id?: number | string; outcome_amount?: number; outcome_currency?: string;
}
