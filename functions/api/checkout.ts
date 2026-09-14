import type { Ctx } from "../_lib/types";
import { json, fail, readJson, siteUrl } from "../_lib/http";
import { findProduct } from "../_lib/products";
import { makeOrderId } from "../_lib/ids";
import { createInvoice } from "../_lib/nowpayments";

/** POST /api/checkout  { product, email? }  ->  { orderId, url } */
export const onRequestPost = async ({ request, env }: Ctx) => {
  const body = await readJson<{ product?: string; email?: string }>(request);
  if (!body?.product) return fail(400, "bad_request", "product is required");

  const product = await findProduct(env, request, String(body.product));
  if (!product) return fail(404, "not_found", "Unknown project");
  if (product.status !== "available") return fail(400, "unavailable", "This project isn't for sale yet");
  if (!(product.priceUsd > 0)) return fail(400, "free", "This project is free. Just download it.");

  const email = String(body.email || "").trim().toLowerCase().slice(0, 200) || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, "bad_email", "That email doesn't look right");

  if (!env.NOWPAYMENTS_API_KEY) return fail(503, "not_configured", "Payments aren't switched on yet. DM me on Discord to buy directly.");

  const orderId = makeOrderId();
  const site = siteUrl(env, request);

  let invoice;
  try {
    invoice = await createInvoice(env, {
      orderId,
      priceUsd: product.priceUsd,
      description: product.page ? product.name : `${product.name} license`,
      successUrl: `${site}/order/?id=${orderId}`,
      cancelUrl: `${site}${product.page || `/p/${product.slug}`}?cancelled=1`,
      ipnUrl: `${site}/api/ipn`,
    });
  } catch (e) {
    return fail(502, "provider_error", "The payment provider didn't answer. Try again in a minute.");
  }

  await env.DB.prepare(
    "INSERT INTO orders (id, product, email, price_usd, status, provider, invoice_id) VALUES (?, ?, ?, ?, 'pending', 'nowpayments', ?)"
  ).bind(orderId, product.slug, email, product.priceUsd, invoice.id).run();

  return json({ ok: true, orderId, url: invoice.url });
};
