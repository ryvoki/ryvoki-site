/* Store: project grid, project detail, featured strip, checkout. */
(() => {
  "use strict";
  const { el, $, toast, loadProjects, fmtPrice } = window.Ryvoki;

  const statusTag = (p) => {
    if (p.status === "coming-soon") return '<span class="tag tag-gold">Coming soon</span>';
    if (!p.priceUsd) return '<span class="tag tag-green">Free</span>';
    return '<span class="tag tag-ember">Crypto</span>';
  };
  const media = (p, cls = "pmedia") => `
    <div class="${cls}">
      ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy">` : `<div class="ph">${p.name.slice(0, 1)}</div>`}
      <span class="badge">${statusTag(p)}</span>
    </div>`;

  function card(p) {
    const href = p.status === "coming-soon" ? "#" : `/p/${p.slug}`;
    const a = el("a", { class: "card pcard reveal", href, html: `
      ${media(p)}
      <div class="pbody">
        <h3>${p.name}</h3>
        <div class="tagline">${p.tagline || ""}</div>
        <div class="tags">${(p.platform || []).map(t => `<span class="tag">${t}</span>`).join("")}</div>
        <div class="pmeta">
          <span class="price">${fmtPrice(p.priceUsd)}${p.priceUsd ? "<small>USD in crypto</small>" : ""}</span>
          <span class="btn btn-sm ${p.status === "coming-soon" ? "" : "btn-primary"}">${p.status === "coming-soon" ? "Soon" : (p.priceUsd ? "Get it" : "Download")}</span>
        </div>
      </div>` });
    if (p.status === "coming-soon") a.addEventListener("click", e => { e.preventDefault(); toast("Not out yet — follow the socials"); });
    return a;
  }

  async function renderGrid(root) {
    const projects = await loadProjects();
    root.innerHTML = "";
    projects.forEach((p, i) => { const c = card(p); c.style.transitionDelay = `${70 * i}ms`; root.append(c); });
    void root.offsetWidth; // force layout so the fade-in transition actually runs
    root.querySelectorAll(".reveal").forEach(n => n.classList.add("in"));
  }

  async function renderFeatured(root) {
    const projects = await loadProjects();
    const p = projects.find(x => x.status === "available") || projects[0];
    if (!p) return;
    root.innerHTML = `
      <div class="feature">
        <div class="feature-media">${p.image ? `<img src="${p.image}" alt="${p.name}">` : ""}</div>
        <div class="feature-body">
          <div>${statusTag(p)} ${(p.platform || []).map(t => `<span class="tag">${t}</span>`).join(" ")}</div>
          <h3 style="font-size:26px">${p.name}</h3>
          <p class="muted" style="margin:0">${p.tagline || ""}</p>
          <ul class="list" style="margin-top:6px">${(p.features || []).slice(0, 3).map(f => `<li>${f}</li>`).join("")}</ul>
          <div class="pmeta" style="margin-top:10px">
            <span class="price">${fmtPrice(p.priceUsd)}${p.priceUsd ? "<small>USD · paid in crypto</small>" : ""}</span>
            <a class="btn btn-primary" href="/p/${p.slug}">${p.priceUsd ? "Buy with crypto" : "Download"}</a>
          </div>
        </div>
      </div>`;
  }

  async function renderDetail(root) {
    const slug = location.pathname.replace(/\/+$/, "").split("/").pop();
    const projects = await loadProjects();
    const p = projects.find(x => x.slug === slug) || projects.find(x => x.slug === new URLSearchParams(location.search).get("p"));
    if (!p) { root.innerHTML = `<div class="narrow status-hero"><div class="big">Not found</div><p class="muted">That project doesn't exist. <a href="/projects/">Back to projects</a></p></div>`; return; }
    document.title = `${p.name} — Ryvoki`;
    const cancelled = new URLSearchParams(location.search).get("cancelled");
    root.innerHTML = `
      <div class="detail">
        <div>
          <a class="eyebrow" href="/projects/">All projects</a>
          <h1 class="detail-title">${p.name}</h1>
          <p class="hero-tag" style="max-width:none">${p.tagline || ""}</p>
          <div class="detail-media reveal in">${p.image ? `<img src="${p.image}" alt="${p.name}">` : ""}</div>
          <div style="height:28px"></div>
          ${(p.body || []).map(t => `<p>${t}</p>`).join("")}
          ${p.features?.length ? `<h3 style="margin:28px 0 12px">What it does</h3><ul class="list">${p.features.map(f => `<li>${f}</li>`).join("")}</ul>` : ""}
          ${p.setup?.length ? `<h3 style="margin:28px 0 12px">Setup</h3><ol class="list steps">${p.setup.map(s => `<li>${s}</li>`).join("")}</ol>` : ""}
        </div>
        <aside class="card buybox">
          <div>${statusTag(p)} ${p.version ? `<span class="tag">v${p.version}</span>` : ""}</div>
          <div class="price">${fmtPrice(p.priceUsd)}${p.priceUsd ? "<small>USD</small>" : ""}</div>
          <div class="tags">${(p.platform || []).map(t => `<span class="tag">${t}</span>`).join("")}</div>
          ${cancelled ? '<div class="notice">Checkout cancelled. No charge.</div>' : ""}
          <div data-buy></div>
          ${p.licensed ? `<p class="muted" style="font-size:13px;margin:4px 0 0">License key delivered on this site the moment payment confirms. Works on up to ${p.maxActivations || 3} PCs. <a href="/license/" style="text-decoration:underline">Lost your key?</a></p>` : ""}
          <p class="muted" style="font-size:13px;margin:0" data-support></p>
        </aside>
      </div>`;
    window.Ryvoki.discordUrl().then(url => { const s = $("[data-support]", root); if (s && url) s.innerHTML = `Problems, questions, refunds: <a href="${url}" target="_blank" rel="noopener" style="text-decoration:underline">join the Discord</a>.`; });
    const buy = $("[data-buy]", root);
    if (p.status === "coming-soon") { buy.innerHTML = '<button class="btn" disabled>Not released yet</button>'; return; }
    if (!p.priceUsd) {
      buy.innerHTML = p.download ? `<a class="btn btn-primary" href="${p.download}">Download</a>` : '<div class="notice">Download link coming soon.</div>';
      return;
    }
    buy.innerHTML = `
      <div class="field"><label for="email">EMAIL (OPTIONAL, FOR KEY RECOVERY)</label><input class="input" id="email" type="email" placeholder="you@example.com" autocomplete="email"></div>
      <button class="btn btn-primary" data-checkout style="width:100%">Buy with crypto</button>
      <div class="crypto-row" data-crypto-inline></div>
      <div data-msg></div>`;
    window.Ryvoki.loadSite().then(site => { $("[data-crypto-inline]", buy).innerHTML = (site.cryptoAccepted || []).map(x => `<span class="tag">${x}</span>`).join(""); });
    $("[data-checkout]", buy).addEventListener("click", async (e) => {
      const btn = e.currentTarget, msg = $("[data-msg]", buy);
      btn.disabled = true; btn.textContent = "Creating invoice…"; msg.innerHTML = "";
      try {
        const r = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product: p.slug, email: $("#email", buy).value }) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.url) throw new Error(data.message || "Checkout failed");
        try { localStorage.setItem("ryvoki:lastOrder", data.orderId); } catch {}
        location.href = data.url;
      } catch (err) {
        msg.innerHTML = `<div class="notice err">${err.message}</div>`;
        btn.disabled = false; btn.textContent = "Buy with crypto";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const g = $("[data-grid]"); if (g) renderGrid(g);
    const f = $("[data-featured]"); if (f) renderFeatured(f);
    const d = $("[data-detail]"); if (d) renderDetail(d);
  });
})();
