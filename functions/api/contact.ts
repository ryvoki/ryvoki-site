import type { Ctx } from "../_lib/types";
import { json, fail, readJson } from "../_lib/http";

/**
 * POST /api/contact  { name, email, subject?, message, website?, startedAt? }
 * Writes the message straight into the mail database in the same shape the mail worker uses,
 * so it shows up in the Ryvoki Mail inbox as a message from the visitor (and Reply just works).
 * Spam defence: hidden "website" field must stay empty, form must take >3 s, 5 messages / hour / IP.
 */
const MAILBOX = "business@ryvoki.com";
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 3600;

interface Body { name?: string; email?: string; subject?: string; message?: string; website?: string; startedAt?: number }

export const onRequestPost = async ({ request, env }: Ctx) => {
  const kv = (env as unknown as { BLOBS?: KVNamespace }).BLOBS;
  if (!kv) return fail(503, "not_configured", "Contact form storage isn't set up yet.");

  const body = await readJson<Body>(request);
  if (!body) return fail(400, "bad_request", "Send JSON");
  if (body.website) return json({ ok: true }); // honeypot: pretend success, store nothing
  if (typeof body.startedAt === "number" && Date.now() - body.startedAt < 3000) return json({ ok: true });

  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
  const subject = String(body.subject || "").trim().slice(0, 200) || "Message from the website";
  const message = String(body.message || "").trim().slice(0, 8000);
  if (!name) return fail(400, "bad_name", "Tell me your name");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, "bad_email", "That email doesn't look right");
  if (message.length < 5) return fail(400, "bad_message", "Write a bit more than that");

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rlKey = `rl:contact:${ip}`;
  const used = Number((await kv.get(rlKey)) || 0);
  if (used >= RATE_LIMIT) return fail(429, "rate_limited", "Too many messages from your connection. Try again in an hour, or use Discord.");
  await kv.put(rlKey, String(used + 1), { expirationTtl: RATE_WINDOW_SECONDS });

  const id = newId();
  const date = new Date().toISOString();
  const text = `${message}\n\n—\nSent from the contact form at ryvoki.com\nName: ${name}\nEmail: ${email}\nIP: ${ip}`;
  const doc = {
    id, direction: "in", mailbox: MAILBOX,
    from: { name, address: email }, to: [{ address: MAILBOX }], cc: [], replyTo: [{ name, address: email }],
    subject: `[Contact] ${subject}`, date, text,
    attachments: [], headers: {},
  };
  await kv.put(`msg/${id}`, JSON.stringify(doc));
  await env.DB.prepare(
    `INSERT INTO mail_messages (id, folder, direction, mailbox, from_addr, from_name, to_addrs, subject, snippet, date, unread, starred, attachment_count, size)
     VALUES (?, 'inbox', 'in', ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?)`
  ).bind(id, MAILBOX, email, name, MAILBOX, doc.subject, message.replace(/\s+/g, " ").slice(0, 180), date, text.length).run();

  return json({ ok: true, id });
};

function newId(): string {
  const t = Date.now().toString(36).padStart(9, "0");
  const r = new Uint8Array(4); crypto.getRandomValues(r);
  return t + "-" + [...r].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Minimal KV typing so this file compiles without extra packages.
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}
