/* Shared site runtime: loads /data/site.json, renders socials + ID card, effects. */
(() => {
  "use strict";

  const ICONS = {
    tiktok: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-1.99 6.15-1.59.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
    youtube: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
    twitch: "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z",
    kick: "M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z",
    x: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
    instagram: "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z",
    discord: "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z",
    github: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
  };
  const COLORS = { tiktok: "#69c9d0", youtube: "#ff0000", twitch: "#9146ff", kick: "#53fc18", x: "#ffffff", instagram: "#e1306c", discord: "#5865f2", github: "#ffffff" };

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c != null) n.append(c);
    return n;
  };
  const icon = (id) => ICONS[id] ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[id]}"/></svg>` : "";

  let sitePromise = null;
  const loadSite = () => (sitePromise ??= fetch("/data/site.json", { cache: "no-cache" }).then(r => r.json()));
  const loadProjects = () => fetch("/data/projects.json", { cache: "no-cache" }).then(r => r.json());

  /* ---- toast + copy ---- */
  let toastEl, toastTimer;
  function toast(msg) {
    toastEl ??= document.body.appendChild(el("div", { class: "toast" }));
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }
  async function copy(text, label = "Copied") {
    try { await navigator.clipboard.writeText(text); toast(label); }
    catch { toast("Copy failed — select it manually"); }
  }

  /* ---- effects ---- */
  function cardGlow() {
    document.addEventListener("pointermove", (e) => {
      for (const c of document.querySelectorAll(".card")) {
        const r = c.getBoundingClientRect();
        if (e.clientX < r.left - 80 || e.clientX > r.right + 80 || e.clientY < r.top - 80 || e.clientY > r.bottom + 80) continue;
        c.style.setProperty("--mx", `${e.clientX - r.left}px`);
        c.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
    }, { passive: true });
  }
  function reveal() {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach(n => io.observe(n));
  }
  function splitTitle(node) {
    const text = node.textContent.trim();
    node.textContent = "";
    [...text].forEach((ch, i) => node.append(el("span", { class: "l grad-text", style: `--i:${i}`, text: ch })));
    node.append(el("span", { class: "glow grad-text", "aria-hidden": "true", text }));
    fitTitle(node);
    window.addEventListener("resize", () => fitTitle(node), { passive: true });
    if (document.fonts?.ready) document.fonts.ready.then(() => fitTitle(node));
  }
  /* Shrinks the display title so any handle length fits its column on one line. */
  function fitTitle(node) {
    node.style.fontSize = "";
    const parentW = node.parentElement.clientWidth;
    const w = node.scrollWidth;
    if (w > parentW && w > 0) {
      const fs = parseFloat(getComputedStyle(node).fontSize);
      node.style.fontSize = Math.floor(fs * (parentW / w) * 0.985) + "px";
    }
  }
  function countUp(node, to, ms = 1400) {
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(to * e).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---- renderers ---- */
  function renderSocials(container, site) {
    const links = (site.socials || []).filter(s => s.url);
    container.innerHTML = "";
    if (!links.length) { container.append(el("span", { class: "socials-empty", text: "Socials coming soon." })); return; }
    for (const s of links) {
      container.append(el("a", { class: "chip", href: s.url, target: "_blank", rel: "noopener", style: `--c:${COLORS[s.id] || "#fff"}`,
        html: `${icon(s.id) || '<span class="dot"></span>'}<span>${s.label}</span>` }));
    }
  }

  function renderIdCard(root, site) {
    const bs = site.bloodstrike || {};
    const initials = (site.handle || "R").slice(0, 1).toUpperCase();
    const social = (id) => (site.socials || []).find(s => s.id === id && s.url);
    const twitch = social("twitch"), youtube = social("youtube");
    root.innerHTML = `
      <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
      <div class="idcard-head">
        <div class="avatar">${site.avatar ? `<img src="${site.avatar}" alt="">` : `<div>${initials}</div>`}</div>
        <div>
          <div class="idcard-name">${site.handle || ""}</div>
          <div class="idcard-sub">Player · Streamer · Dev</div>
        </div>
        <div style="margin-left:auto"><span class="live">${site.statusLabel || "GRINDING"}</span></div>
      </div>
      <div class="kv">
        <div class="kv-row"><span class="k">GAME</span><span class="v">Blood Strike</span></div>
        ${bs.uid ? `<div class="kv-row"><span class="k">UID</span><span class="v"><span data-uid>${bs.uid}</span><button class="copy" data-copy-uid>COPY</button></span></div>` : ""}
        ${bs.region ? `<div class="kv-row"><span class="k">REGION</span><span class="v">${bs.region}</span></div>` : ""}
        ${twitch ? `<div class="kv-row"><span class="k">LIVE ON</span><span class="v"><a href="${twitch.url}" target="_blank" rel="noopener" style="color:#c9a6ff">${twitch.url.replace(/^https?:\/\/(www\.)?/, "")}</a></span></div>` : ""}
        ${youtube ? `<div class="kv-row"><span class="k">VIDEOS</span><span class="v"><a href="${youtube.url}" target="_blank" rel="noopener" style="color:#ff8a8a">${youtube.url.replace(/^https?:\/\/(www\.)?/, "")}</a></span></div>` : ""}
      </div>`;
    const btn = $("[data-copy-uid]", root);
    if (btn) btn.addEventListener("click", () => copy(bs.uid, "UID copied"));
  }

  function renderFooter(site) {
    const f = $("[data-footer-note]");
    if (f) f.textContent = site.footerNote || "";
    const c = $("[data-crypto]");
    if (c) c.innerHTML = (site.cryptoAccepted || []).map(x => `<span class="tag">${x}</span>`).join("");
  }

  function fmtPrice(p) {
    if (!p || p <= 0) return "Free";
    return "$" + Number(p).toFixed(2);
  }

  /* ---- boot ---- */
  document.addEventListener("DOMContentLoaded", async () => {
    cardGlow(); reveal();
    const site = await loadSite().catch(() => ({}));
    document.querySelectorAll("[data-site]").forEach(n => { const k = n.dataset.site; if (site[k]) n.textContent = site[k]; });
    const t = $("[data-hero-title]"); if (t) { t.textContent = site.handle || t.textContent; splitTitle(t); }
    const s = $("[data-socials]"); if (s) renderSocials(s, site);
    const id = $("[data-idcard]"); if (id) renderIdCard(id, site);
    const cta = $("[data-primary-cta]");
    if (cta) { if (site.primaryCta?.url) { cta.href = site.primaryCta.url; cta.textContent = site.primaryCta.label || cta.textContent; } else cta.remove(); }
    const discord = (site.socials || []).find(x => x.id === "discord" && x.url);
    const nd = $("[data-nav-discord]");
    if (nd) { if (discord) nd.href = discord.url; else nd.remove(); }
    document.querySelectorAll("[data-discord-link]").forEach(a => {
      if (discord) { a.href = discord.url; a.target = "_blank"; a.rel = "noopener"; }
      else a.replaceWith(a.textContent);
    });
    renderFooter(site);
    document.dispatchEvent(new CustomEvent("site:ready", { detail: site }));
  });

  const discordUrl = async () => (((await loadSite().catch(() => ({}))).socials || []).find(x => x.id === "discord" && x.url) || {}).url || "";

  window.Ryvoki = { el, $, icon, toast, copy, loadSite, loadProjects, fmtPrice, countUp, discordUrl };
})();
