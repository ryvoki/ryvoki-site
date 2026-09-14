/* Contact page: copy button for the address, and the message form -> /api/contact. */
(() => {
  "use strict";
  const { $, copy } = window.Ryvoki;
  const startedAt = Date.now();

  document.querySelectorAll("[data-copy-email]").forEach(b => b.addEventListener("click", () => copy(b.dataset.copyEmail, "Email copied")));

  const form = $("[data-contact-form]");
  if (!form) return;
  const out = $("[data-contact-out]");
  const button = $("[data-contact-send]", form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      name: $("#c-name", form).value,
      email: $("#c-email", form).value,
      subject: $("#c-subject", form).value,
      message: $("#c-message", form).value,
      website: $("#c-website", form).value,
      startedAt,
    };
    button.disabled = true; button.textContent = "Sending…"; out.innerHTML = "";
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(res.message || "Couldn't send that");
      form.reset();
      out.innerHTML = '<div class="notice ok">Sent. It\'s in my inbox, I\'ll reply to the email you gave.</div>';
      button.textContent = "Sent";
    } catch (err) {
      out.innerHTML = `<div class="notice err">${err.message}</div>`;
      button.disabled = false; button.textContent = "Send message";
    }
  });
})();
