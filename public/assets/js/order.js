/* Order status page: polls /api/order/:id until paid, then shows the license key. */
(() => {
  "use strict";
  const { $, copy, loadProjects } = window.Ryvoki;
  const root = $("[data-order]");
  if (!root) return;
  const params = new URLSearchParams(location.search);
  let id = (params.get("id") || "").trim().toUpperCase();
  if (!id) { try { id = localStorage.getItem("ryvoki:lastOrder") || ""; } catch {} }

  const view = (html) => { root.innerHTML = html; };
  if (!id) {
    view(`<div class="status-hero"><div class="big">No order selected</div><p class="muted">Open the link from your checkout, or <a href="/license/" style="text-decoration:underline">look up a key</a>.</p></div>`);
    return;
  }

  let projects = [];
  loadProjects().then(p => projects = p).catch(() => {});
  const productName = (slug) => projects.find(p => p.slug === slug)?.name || slug;
  const productDownload = (slug) => projects.find(p => p.slug === slug)?.download || "";
  const productAccess = (slug) => projects.find(p => p.slug === slug)?.access || "";

  async function tick() {
    let data;
    try { const r = await fetch(`/api/order/${encodeURIComponent(id)}`, { cache: "no-store" }); data = await r.json(); if (!r.ok) throw new Error(data.message || "Order not found"); }
    catch (err) {
      view(`<div class="status-hero"><div class="big">Hmm.</div><p class="muted">${err.message}. Order ID: <span class="mono">${id}</span></p><p><a class="btn" href="/license/">Look up a key</a></p></div>`);
      return;
    }
    const o = data.order;
    if (o.status === "paid" && o.key) {
      const dl = productDownload(o.product), access = productAccess(o.product);
      view(`<div class="status-hero">
        <div class="check">✓</div>
        <div class="big">Paid. Here's your key.</div>
        <p class="muted">${productName(o.product)} · order <span class="mono">${o.id}</span></p>
        <div class="keybox"><span data-key>${o.key}</span><button class="copy" data-copy>COPY</button></div>
        <p class="muted" style="font-size:14px">Save this somewhere. You can always get it back on the <a href="/license/" style="text-decoration:underline">license page</a> with your order ID${o.emailHint ? " or your email" : ""}.</p>
        <div class="hero-actions" style="justify-content:center;margin-top:18px">
          ${access ? `<a class="btn btn-primary" href="${access}">Open the course and log in</a>` : dl ? `<a class="btn btn-primary" href="${dl}">Download ${productName(o.product)}</a>` : `<span class="notice">Download link is on the project page.</span>`}
          ${access ? "" : `<a class="btn" href="/p/${o.product}">Setup instructions</a>`}
        </div>
      </div>`);
      $("[data-copy]", root).addEventListener("click", () => copy(o.key, "Key copied"));
      return;
    }
    if (o.status === "partial") {
      const dc = await window.Ryvoki.discordUrl();
      const link = dc ? `<a href="${dc}" target="_blank" rel="noopener" style="text-decoration:underline">message me on Discord</a>` : "message me on Discord";
      view(`<div class="status-hero"><div class="big">Partial payment</div><p class="muted">The payment came in short of the invoice amount. Send the remainder from the invoice page, or ${link} with order <span class="mono">${o.id}</span> and I'll sort it.</p></div>`);
      return;
    }
    if (["failed", "expired", "refunded"].includes(o.status)) {
      view(`<div class="status-hero"><div class="big">Order ${o.status}</div><p class="muted">Order <span class="mono">${o.id}</span> didn't complete. No key was issued.</p><p><a class="btn btn-primary" href="/p/${o.product}">Try again</a></p></div>`);
      return;
    }
    view(`<div class="status-hero">
      <div class="spinner"></div>
      <div class="big">Waiting for the network…</div>
      <p class="muted">Order <span class="mono">${o.id}</span> · ${productName(o.product)}<br>This page updates itself. Crypto confirmations usually take 1–15 minutes depending on the coin.</p>
      <p class="muted" style="font-size:13px">Closed the payment window? <a href="/p/${o.product}" style="text-decoration:underline">Start a new checkout</a>. Keep this order ID either way.</p>
    </div>`);
    setTimeout(tick, 5000);
  }
  tick();
})();
