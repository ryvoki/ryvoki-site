/* Course sales page: curriculum from the API, checkout for the course product. */
(() => {
  "use strict";
  const { $, loadSite } = window.Ryvoki;
  const PRODUCT = "mythic-course";

  async function renderModules(root) {
    let data;
    try { data = await fetch("/api/course/content", { cache: "no-cache" }).then(r => r.json()); } catch { data = null; }
    if (!data?.modules) { root.innerHTML = '<div class="card card-pad muted">Curriculum is loading slowly. Refresh in a second.</div>'; return; }
    const count = $("[data-lesson-count]"); if (count) count.textContent = data.lessonCount;
    root.innerHTML = "";
    for (const m of data.modules) {
      const lessons = data.lessons.filter(l => l.module === m.number);
      const card = document.createElement("div");
      card.className = "card module reveal";
      card.innerHTML = `
        <div class="pmedia"><img src="${m.image}" alt="Module ${m.number}: ${m.title}" loading="lazy"><span class="badge"><span class="tag tag-ember">Module ${String(m.number).padStart(2, "0")}</span></span></div>
        <div class="pbody">
          <h3>${m.title}</h3>
          <div class="tagline" style="flex:0">${m.tagline}</div>
          <ul class="lessons">${lessons.map(l => `<li><span>${l.title}<span class="muted"> · ${l.minutes} min</span></span></li>`).join("")}</ul>
        </div>`;
      root.append(card);
    }
    requestAnimationFrame(() => root.querySelectorAll(".reveal").forEach((n, i) => { n.style.transitionDelay = `${60 * i}ms`; n.classList.add("in"); }));
  }

  function wireCheckout(box) {
    if (!box) return;
    loadSite().then(site => { const c = $("[data-crypto-inline]", box); if (c) c.innerHTML = (site.cryptoAccepted || []).map(x => `<span class="tag">${x}</span>`).join(""); });
    const btn = $("[data-checkout]", box), msg = $("[data-msg]", box);
    btn.addEventListener("click", async () => {
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = "Creating invoice…"; msg.innerHTML = "";
      try {
        const r = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product: PRODUCT, email: $("#email", box).value }) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.url) throw new Error(data.message || "Checkout failed");
        try { localStorage.setItem("ryvoki:lastOrder", data.orderId); } catch {}
        location.href = data.url;
      } catch (err) {
        msg.innerHTML = `<div class="notice err" style="margin-top:10px">${err.message}</div>`;
        btn.disabled = false; btn.textContent = label;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const m = $("[data-modules]"); if (m) renderModules(m);
    wireCheckout($("[data-buy]"));
    if (new URLSearchParams(location.search).get("cancelled")) { const msg = $("[data-msg]"); if (msg) msg.innerHTML = '<div class="notice" style="margin-top:10px">Checkout cancelled. No charge.</div>'; }
  });
})();
