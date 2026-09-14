/* License page: recover a key by order ID or email, or check a key's status. */
(() => {
  "use strict";
  const { $, copy } = window.Ryvoki;
  const form = $("[data-lookup]");
  if (!form) return;
  const out = $("[data-lookup-out]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#q", form).value.trim();
    if (!q) return;
    out.innerHTML = '<div class="muted">Looking…</div>';
    const compact = q.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const body = compact.startsWith("ORD") ? { orderId: q } : (compact.startsWith("RYV") ? { key: q } : { email: q });
    try {
      const r = await fetch("/api/license/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Not found");
      if (data.licenses) {
        out.innerHTML = data.licenses.length ? data.licenses.map(l => `
          <div class="card card-pad" style="margin-bottom:12px">
            <div class="muted" style="font-size:13px;margin-bottom:6px">${l.product} · order <span class="mono">${l.orderId || "manual"}</span> · ${l.status}</div>
            <div class="keybox" style="margin:0"><span>${l.key}</span><button class="copy" data-k="${l.key}">COPY</button></div>
          </div>`).join("") : '<div class="notice">No paid orders found for that.</div>';
        out.querySelectorAll("[data-k]").forEach(b => b.addEventListener("click", () => copy(b.dataset.k, "Key copied")));
      } else if (data.license) {
        const l = data.license;
        out.innerHTML = `<div class="notice ${l.status === "active" ? "ok" : "err"}">Key is <b>${l.status}</b> for <b>${l.product}</b> · ${l.activations}/${l.maxActivations} PCs activated.</div>`;
      }
    } catch (err) { out.innerHTML = `<div class="notice err">${err.message}</div>`; }
  });
})();
