/* Student portal: key login, one-question-at-a-time intake, dashboard, lessons, 1-on-1 booking. */
(() => {
  "use strict";
  const { $, el, toast, discordUrl } = window.Ryvoki;
  const root = $("[data-learn]");
  if (!root) return;

  const state = { me: null, answers: {}, step: 0 };
  const api = async (path, opts = {}) => {
    const r = await fetch(path, { credentials: "same-origin", cache: "no-store", ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(data.message || "Something went wrong"); err.code = data.error; err.status = r.status; throw err; }
    return data;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const view = (html) => { root.innerHTML = html; window.scrollTo({ top: 0, behavior: "smooth" }); };
  const label = (q, value) => q?.options?.find(o => o.value === value)?.label || value || "";

  /* ---------------- routing ---------------- */
  async function boot() {
    try { state.me = await api("/api/course/me"); }
    catch (err) { if (err.status === 401) { renderLogin(); return; } view(`<div class="status-hero"><div class="big">Hmm.</div><p class="muted">${esc(err.message)}</p></div>`); return; }
    state.answers = state.me.profile?.answers || {};
    route();
  }
  function route() {
    const hash = location.hash.replace(/^#/, "");
    if (!state.me.profile?.completed && hash !== "answers") { renderWizard(); return; }
    if (hash === "answers") { renderWizard(true); return; }
    if (hash.startsWith("lesson/")) { renderLesson(hash.slice(7)); return; }
    if (hash === "book") { renderBooking(); return; }
    renderDashboard();
  }
  window.addEventListener("hashchange", () => { if (state.me) route(); });

  /* ---------------- login ---------------- */
  function renderLogin(message) {
    view(`
      <div class="card login">
        <div class="avatar"><img src="/assets/img/brand/mark.png" alt=""></div>
        <span class="eyebrow" style="justify-content:center">Student portal</span>
        <h2 style="margin:12px 0 8px;font-size:28px">Log in with your key.</h2>
        <p class="muted" style="font-size:14px">The license key from your course purchase is your login. It's on your order page and on the <a href="/license/" style="text-decoration:underline">license page</a>.</p>
        <form data-login>
          <input class="input mono" id="key" placeholder="RYV-XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off" spellcheck="false" style="text-align:center;text-transform:uppercase" required>
          <button class="btn btn-primary" type="submit" style="width:100%;margin-top:12px">Open my course</button>
          <div data-out style="margin-top:12px">${message ? `<div class="notice err">${esc(message)}</div>` : ""}</div>
        </form>
        <p class="muted" style="font-size:13px;margin:18px 0 0">Not enrolled yet? <a href="/course/" style="text-decoration:underline">See the course</a>. Problems with a key? <a data-discord-link style="text-decoration:underline">Open a ticket in the Discord</a>.</p>
      </div>`);
    fillDiscord();
    const form = $("[data-login]", root), out = $("[data-out]", form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button", form); btn.disabled = true; out.innerHTML = "";
      try { await api("/api/course/login", { method: "POST", body: JSON.stringify({ key: $("#key", form).value }) }); await boot(); }
      catch (err) { out.innerHTML = `<div class="notice err">${esc(err.message)}</div>`; btn.disabled = false; }
    });
    $("#key", form).focus();
  }
  async function logout() { await api("/api/course/logout", { method: "POST" }).catch(() => {}); state.me = null; location.hash = ""; renderLogin(); }
  async function fillDiscord() { const url = await discordUrl(); root.querySelectorAll("[data-discord-link]").forEach(a => { if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener"; } }); }

  /* ---------------- intake wizard ---------------- */
  function renderWizard(editing = false) {
    const qs = state.me.questions;
    if (state.step >= qs.length) state.step = 0;
    const q = qs[state.step];
    const value = state.answers[q.id] ?? "";
    const isLast = state.step === qs.length - 1;
    view(`
      <div class="wizard">
        <div class="learn-top">
          <span class="eyebrow">${editing ? "Update your answers" : "Before your first lesson"}</span>
          <div class="dots">${qs.map((_, i) => `<span class="${i < state.step ? "done" : i === state.step ? "on" : ""}"></span>`).join("")}</div>
        </div>
        <div class="card wizard-card wizard-enter" data-card>
          <div class="wizard-step">QUESTION ${state.step + 1} OF ${qs.length}</div>
          <h2>${esc(q.title)}</h2>
          ${q.help ? `<p class="help">${esc(q.help)}</p>` : '<div style="height:10px"></div>'}
          <div class="body" data-body></div>
          <div class="wizard-nav">
            <button class="btn btn-sm" data-back ${state.step === 0 ? "disabled" : ""}>Back</button>
            <span class="muted" data-hint>${q.required ? "" : "Optional"}</span>
            <button class="btn btn-sm btn-primary" data-next>${isLast ? "Build my plan" : "Next"}</button>
          </div>
        </div>
        ${editing ? '<p class="muted" style="text-align:center;font-size:13px;margin-top:14px"><a href="#" style="text-decoration:underline">Back to the dashboard</a></p>' : ""}
      </div>`);
    const body = $("[data-body]", root), next = $("[data-next]", root), back = $("[data-back]", root);
    let current = value;
    const commit = () => { if (current === "" || current == null) delete state.answers[q.id]; else state.answers[q.id] = String(current); };

    if (q.type === "choice") {
      const list = el("div", { class: "choices" });
      for (const opt of q.options) {
        const b = el("button", { type: "button", class: "choice" + (String(current) === opt.value ? " on" : ""), html: `<span class="dot"></span><span><b>${esc(opt.label)}</b>${opt.hint ? `<small>${esc(opt.hint)}</small>` : ""}</span>` });
        b.addEventListener("click", () => { current = opt.value; list.querySelectorAll(".choice").forEach(x => x.classList.toggle("on", x === b)); setTimeout(go, 160); });
        list.append(b);
      }
      body.append(list);
    } else if (q.type === "scale") {
      const grid = el("div", { class: "scale" });
      for (let n = q.min ?? 1; n <= (q.max ?? 10); n++) {
        const b = el("button", { type: "button", class: String(current) === String(n) ? "on" : "", text: String(n) });
        b.addEventListener("click", () => { current = String(n); grid.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); });
        grid.append(b);
      }
      body.append(grid, el("div", { class: "scale-labels", html: "<span>Not confident</span><span>Elite</span>" }));
    } else {
      const input = el(q.type === "textarea" ? "textarea" : "input", { class: "input", placeholder: q.placeholder || "", maxlength: String(q.maxLength || 200), rows: "5", style: q.type === "textarea" ? "resize:vertical" : "" });
      input.value = current;
      input.addEventListener("input", () => current = input.value);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && q.type !== "textarea") { e.preventDefault(); go(); } });
      body.append(input); setTimeout(() => input.focus(), 50);
    }

    async function go() {
      if (q.required && (current === "" || current == null || !String(current).trim())) { $("[data-hint]", root).textContent = "Pick one to continue"; $("[data-card]", root).animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 260 }); return; }
      commit();
      next.disabled = true;
      try {
        if (isLast) {
          const data = await api("/api/course/profile", { method: "POST", body: JSON.stringify({ answers: state.answers, done: true }) });
          state.me = await api("/api/course/me"); state.answers = state.me.profile.answers; state.step = 0;
          renderPlanReveal(data.plan);
        } else {
          api("/api/course/profile", { method: "POST", body: JSON.stringify({ answers: state.answers }) }).catch(() => {});
          state.step++; renderWizard(editing);
        }
      } catch (err) { next.disabled = false; $("[data-hint]", root).textContent = err.message; }
    }
    next.addEventListener("click", go);
    back.addEventListener("click", () => { commit(); state.step = Math.max(0, state.step - 1); renderWizard(editing); });
  }

  function renderPlanReveal(plan) {
    view(`
      <div class="wizard">
        <div class="card wizard-card wizard-enter" style="text-align:center;align-items:center;justify-content:center">
          <div class="check">✓</div>
          <span class="eyebrow" style="justify-content:center">Your plan</span>
          <h2 style="margin:12px 0 10px">${esc(plan.lessonsPerWeek >= 1 ? `${plan.lessonsPerWeek} lesson${plan.lessonsPerWeek === 1 ? "" : "s"} a week.` : "A lesson every week or two.")}</h2>
          <p class="muted" style="max-width:480px">${esc(plan.summary)}</p>
          <div class="plan-kv" style="width:100%;margin:10px 0 22px">
            <div><b>${plan.drillMinutesPerDay} min</b><span>drills per play day</span></div>
            <div><b>${esc(fmtDate(plan.targetDate))}</b><span>target finish</span></div>
            <div><b>${esc(plan.focus[0])}</b><span>first focus</span></div>
          </div>
          <a class="btn btn-primary" href="#" style="min-width:220px" data-start>Start lesson 1</a>
        </div>
      </div>`);
    $("[data-start]", root).addEventListener("click", (e) => { e.preventDefault(); location.hash = ""; renderDashboard(); });
  }

  /* ---------------- dashboard ---------------- */
  function renderDashboard() {
    const me = state.me, a = state.answers, plan = me.profile?.plan || {};
    const q = (id) => me.questions.find(x => x.id === id);
    const done = new Set(me.progress.done);
    const nextLesson = me.lessons.find(l => !done.has(l.id));
    const pct = Math.round((me.progress.count / me.progress.total) * 100);
    const bookState = me.call ? (me.call.status === "requested" ? "requested" : me.call.status) : (me.progress.allDone ? "open" : "locked");
    view(`
      <div class="learn-top">
        <div class="who">
          <div class="avatar"><img src="/assets/img/brand/mark.png" alt=""></div>
          <div><div style="font-family:var(--font-display);font-weight:800;font-size:18px">Hey ${esc(a.name || "there")}.</div><div class="muted" style="font-size:13px">${esc(label(q("rank"), a.rank))} · ${esc(label(q("platform"), a.platform))} · key ${esc(me.student.key)}</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn btn-sm" href="#answers">Edit answers</a>
          <a class="btn btn-sm" data-discord-link>Students channel</a>
          <button class="btn btn-sm" data-logout>Log out</button>
        </div>
      </div>

      <div class="card card-pad" style="margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline;margin-bottom:10px">
          <span class="eyebrow">Progress</span>
          <span class="mono muted" style="font-size:13px">${me.progress.count} / ${me.progress.total} lessons · ${pct}%</span>
        </div>
        <div class="progress"><span style="width:${pct}%"></span></div>
        ${nextLesson ? `<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-top:16px"><div><div class="muted" style="font-size:12px;letter-spacing:.12em;text-transform:uppercase">Up next</div><div style="font-weight:700">${esc(nextLesson.title)}</div></div><a class="btn btn-sm btn-primary" href="#lesson/${nextLesson.id}">Continue</a></div>`
                     : `<div style="margin-top:16px" class="notice ok">Every lesson complete. ${bookState === "open" ? "Book your 1-on-1 below." : "Nice work."}</div>`}
      </div>

      <div class="planbox" style="margin-bottom:18px">
        <div class="card card-pad">
          <span class="eyebrow">Your plan</span>
          <p style="margin:12px 0 14px;color:#d5d9df">${esc(plan.summary || "")}</p>
          <div class="plan-kv">
            <div><b>${plan.lessonsPerWeek >= 1 ? plan.lessonsPerWeek : "~1"}</b><span>lessons / week</span></div>
            <div><b>${plan.drillMinutesPerDay || 20} min</b><span>drills / play day</span></div>
            <div><b>${esc(fmtDate(plan.targetDate))}</b><span>target finish</span></div>
          </div>
        </div>
        <div class="card card-pad">
          <span class="eyebrow">Focus</span>
          <div style="margin-top:12px;display:grid;gap:8px">
            ${(plan.focus || []).map((f, i) => `<div class="kv-row"><span class="k">${i === 0 ? "FIRST" : "THEN"}</span><span class="v" style="font-family:var(--font-body);text-transform:capitalize">${esc(f)}</span></div>`).join("")}
            <div class="kv-row"><span class="k">AIM · MOVE · SENSE</span><span class="v">${esc(a.aim || "?")} · ${esc(a.movement || "?")} · ${esc(a.sense || "?")}</span></div>
          </div>
        </div>
      </div>

      <div class="card card-pad" style="margin-bottom:18px">
        <span class="eyebrow">Lessons</span>
        ${me.modules.map(m => `
          <div class="module-head"><img src="${m.image}" alt=""><div><h3>${String(m.number).padStart(2, "0")} · ${esc(m.title)}</h3><small>${esc(m.tagline)}</small></div></div>
          <div class="lesson-list">${me.lessons.filter(l => l.module === m.number).map(l => `
            <a class="lesson-row ${nextLesson?.id === l.id ? "next" : ""}" href="#lesson/${l.id}">
              <span class="tick ${done.has(l.id) ? "on" : ""}">✓</span>
              <span class="num">${l.id}</span>
              <span class="t">${esc(l.title)}<small>${esc(l.summary)}</small></span>
              <span class="mins">${l.minutes} min${l.hasVideo ? "" : " · video soon"}</span>
            </a>`).join("")}</div>`).join("")}
      </div>

      <div class="card booking" id="book">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
          <div>
            <span class="eyebrow">Your 1-on-1</span>
            <h3 style="margin:10px 0 6px">${bookState === "locked" ? "Unlocks when every lesson is complete." : bookState === "open" ? "Book your call with Ryvoki." : bookState === "requested" ? "Call requested. Ryvoki will confirm a time on Discord." : "Call " + esc(bookState) + "."}</h3>
            <p class="muted" style="margin:0;font-size:14px">${bookState === "locked" ? `${me.progress.total - me.progress.count} lesson${me.progress.total - me.progress.count === 1 ? "" : "s"} to go. Bring your death log and one recorded game when you get there.` : bookState === "open" ? "I watch you play, we go through a recorded game, and you leave with a personal fix-list." : "Not Mythic yet after the call? We keep going until you are."}</p>
          </div>
          ${bookState === "open" ? '<a class="btn btn-primary" href="#book-form" data-book>Schedule my 1-on-1</a>' : ""}
        </div>
      </div>`);
    fillDiscord();
    $("[data-logout]", root).addEventListener("click", logout);
    const book = $("[data-book]", root); if (book) book.addEventListener("click", (e) => { e.preventDefault(); location.hash = "book"; });
  }

  /* ---------------- lesson ---------------- */
  async function renderLesson(id) {
    let data;
    try { data = await api(`/api/course/lesson/${encodeURIComponent(id)}`); }
    catch (err) { view(`<div class="status-hero"><div class="big">Not found</div><p class="muted">${esc(err.message)}</p><a class="btn" href="#">Back</a></div>`); return; }
    const { lesson, module, next, prev, position } = data;
    const platform = state.answers.platform;
    const note = lesson.platformNotes ? (platform === "pc" ? lesson.platformNotes.pc : lesson.platformNotes.mobile) : null;
    const embed = embedUrl(lesson.video);
    view(`
      <div class="learn-top">
        <a class="btn btn-sm" href="#">← Dashboard</a>
        <span class="mono muted" style="font-size:12px">LESSON ${position.index + 1} OF ${position.total}</span>
      </div>
      <div class="module-head" style="margin-top:0"><img src="${module?.image || ""}" alt=""><div><span class="eyebrow">Module ${String(lesson.module).padStart(2, "0")} · ${esc(module?.title || "")}</span></div></div>
      <h2 style="margin:6px 0 8px">${esc(lesson.title)}</h2>
      <p class="muted" style="margin-bottom:20px">${esc(lesson.summary)} · ${lesson.minutes} min</p>
      <div class="video">${embed ? `<iframe src="${embed}" title="${esc(lesson.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>` : `<div class="soon"><div><b>Video coming soon</b><span>Ryvoki is recording this one. The reading and homework below are the full lesson, so you can start now and rewatch when the video lands.</span></div></div>`}</div>
      <div style="height:26px"></div>
      <span class="eyebrow">Key points</span>
      <div class="keypoints" style="margin:12px 0 26px">${lesson.keyPoints.map(k => `<div>${esc(k)}</div>`).join("")}</div>
      <div class="reading">${lesson.reading}</div>
      ${note ? `<div class="platform-note" style="margin:8px 0 26px"><b>${platform === "pc" ? "On PC:" : "On touch:"}</b> ${esc(note)}</div>` : '<div style="height:18px"></div>'}
      <div class="homework">
        <span class="eyebrow">Homework</span>
        <h3>${esc(lesson.homework.title)}</h3>
        <ol class="list steps">${lesson.homework.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
        <div class="target">TARGET · ${esc(lesson.homework.target)}</div>
      </div>
      <div class="card card-pad" style="margin-top:22px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:center">
        <div><div style="font-weight:700">${data.completed ? "Marked complete." : "Done the homework?"}</div><div class="muted" style="font-size:13.5px">${data.completed ? "You can un-tick it if you want to redo the week." : "Tick it off once you've actually played the games. Be honest, the 1-on-1 is better when you are."}</div></div>
        <button class="btn ${data.completed ? "" : "btn-primary"}" data-done>${data.completed ? "Un-mark" : "Mark complete"}</button>
      </div>
      <div class="lesson-nav">
        ${prev ? `<a class="btn btn-sm" href="#lesson/${prev.id}">← ${esc(prev.title)}</a>` : "<span></span>"}
        ${next ? `<a class="btn btn-sm" href="#lesson/${next.id}">${esc(next.title)} →</a>` : '<a class="btn btn-sm btn-primary" href="#">Back to dashboard</a>'}
      </div>`);
    $("[data-done]", root).addEventListener("click", async (e) => {
      const btn = e.currentTarget; btn.disabled = true;
      try {
        const res = await api("/api/course/progress", { method: "POST", body: JSON.stringify({ lessonId: lesson.id, done: !data.completed }) });
        state.me.progress = { done: res.done, count: res.count, total: res.total, allDone: res.allDone };
        toast(!data.completed ? (res.allDone ? "That's all of them. Book your 1-on-1." : "Lesson complete") : "Un-marked");
        if (!data.completed && next) location.hash = `lesson/${next.id}`; else location.hash = "";
      } catch (err) { toast(err.message); btn.disabled = false; }
    });
  }
  function embedUrl(url) {
    if (!url) return null;
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
    if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`;
    return url;
  }

  /* ---------------- booking ---------------- */
  function renderBooking() {
    if (!state.me.progress.allDone) { location.hash = ""; return; }
    const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } })();
    view(`
      <div class="learn-top"><a class="btn btn-sm" href="#">← Dashboard</a></div>
      <form class="card booking" data-book-form>
        <span class="eyebrow">Your 1-on-1</span>
        <h2 style="margin:12px 0 8px;font-size:30px">Book the call.</h2>
        <p class="muted" style="margin-bottom:20px">Tell me when you're free and I'll confirm a time on Discord. Have your death log and one recorded game ready.</p>
        <div class="grid">
          <div class="field"><label for="b-discord">DISCORD USERNAME</label><input class="input" id="b-discord" required maxlength="80" value="${esc(state.answers.discord || "")}"></div>
          <div class="field"><label for="b-tz">YOUR TIMEZONE</label><input class="input" id="b-tz" maxlength="80" value="${esc(tz)}"></div>
        </div>
        <div class="field" style="margin-top:12px"><label for="b-avail">WHEN ARE YOU USUALLY FREE?</label><textarea class="input" id="b-avail" required rows="3" maxlength="500" placeholder="e.g. weekday evenings after 8pm, any time Sunday" style="resize:vertical"></textarea></div>
        <div class="field" style="margin-top:12px"><label for="b-notes">ANYTHING YOU WANT ME TO LOOK AT? (OPTIONAL)</label><textarea class="input" id="b-notes" rows="4" maxlength="2000" placeholder="A link to a recorded game, what you've been stuck on, your current RP" style="resize:vertical"></textarea></div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:18px;flex-wrap:wrap">
          <button class="btn btn-primary" type="submit">Request my 1-on-1</button>
          <span class="muted" style="font-size:13px">Goes straight to Ryvoki.</span>
        </div>
        <div data-out style="margin-top:12px"></div>
      </form>`);
    const form = $("[data-book-form]", root), out = $("[data-out]", form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button[type=submit]", form); btn.disabled = true; out.innerHTML = "";
      try {
        await api("/api/course/schedule", { method: "POST", body: JSON.stringify({ discord: $("#b-discord", form).value, timezone: $("#b-tz", form).value, availability: $("#b-avail", form).value, notes: $("#b-notes", form).value }) });
        state.me = await api("/api/course/me");
        view(`<div class="status-hero"><div class="check">✓</div><div class="big">Requested.</div><p class="muted">Ryvoki will message you on Discord to lock in a time. Keep playing the plan until then.</p><a class="btn btn-primary" href="#">Back to dashboard</a></div>`);
      } catch (err) { out.innerHTML = `<div class="notice err">${esc(err.message)}</div>`; btn.disabled = false; }
    });
  }

  const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00"); return isNaN(d) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

  document.addEventListener("site:ready", boot, { once: true });
})();
