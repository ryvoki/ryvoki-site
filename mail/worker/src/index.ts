import PostalMime from "postal-mime";
import {
  type Env, type MessageDoc, type MessageRow, type AttachmentMeta, type Address,
  json, fail, readJson, timingSafeEqual, newId, fmtAddrs, snippetOf, parseAddrList, isEmail, parseAddr, fmtAddr,
} from "./lib";

const FOLDERS = new Set(["inbox", "sent", "archive", "trash", "drafts"]);

export default {
  /* ------------------------------------------------------------------ inbound mail */
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);
    const id = newId();

    const attachments: AttachmentMeta[] = [];
    for (const [index, a] of parsed.attachments.entries()) {
      const content = typeof a.content === "string" ? new TextEncoder().encode(a.content) : new Uint8Array(a.content);
      await env.BLOBS.put(`att/${id}/${index}`, content);
      attachments.push({
        index,
        filename: a.filename || `attachment-${index + 1}`,
        mime: a.mimeType || "application/octet-stream",
        size: content.byteLength,
        contentId: a.contentId?.replace(/^<|>$/g, "") || undefined,
        inline: a.disposition === "inline",
      });
    }

    const from: Address = parsed.from ? { name: parsed.from.name || undefined, address: parsed.from.address || message.from } : { address: message.from };
    const doc: MessageDoc = {
      id,
      direction: "in",
      mailbox: message.to.toLowerCase(),
      from,
      to: (parsed.to || []).map(a => ({ name: a.name || undefined, address: a.address || "" })).filter(a => a.address),
      cc: (parsed.cc || []).map(a => ({ name: a.name || undefined, address: a.address || "" })).filter(a => a.address),
      replyTo: (parsed.replyTo || []).map(a => ({ name: a.name || undefined, address: a.address || "" })).filter(a => a.address),
      subject: parsed.subject || "(no subject)",
      date: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
      html: parsed.html || undefined,
      text: parsed.text || undefined,
      attachments,
      headers: { messageId: parsed.messageId || undefined, inReplyTo: parsed.inReplyTo || undefined, references: parsed.references || undefined },
    };

    await env.BLOBS.put(`raw/${id}`, raw);
    await env.BLOBS.put(`msg/${id}`, JSON.stringify(doc));
    await env.DB.prepare(
      `INSERT INTO mail_messages (id, folder, direction, mailbox, from_addr, from_name, to_addrs, subject, snippet, date, unread, starred, attachment_count, size, message_id, in_reply_to)
       VALUES (?, 'inbox', 'in', ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?)`
    ).bind(
      id, doc.mailbox, from.address, from.name ?? null, fmtAddrs(doc.to), doc.subject, snippetOf(doc.text, doc.html), doc.date,
      attachments.filter(a => !a.inline).length, raw.byteLength, doc.headers.messageId ?? null, doc.headers.inReplyTo ?? null,
    ).run();

    if (env.FORWARD_TO) {
      try { await message.forward(env.FORWARD_TO); } catch { /* copy is best-effort; the message is already stored */ }
    }
  },

  /* ------------------------------------------------------------------ API for the desktop app */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    if (path === "" || path === "/") return json({ ok: true, service: "ryvoki-mail", domain: env.MAIL_DOMAIN });

    const denied = requireToken(request, env);
    if (denied) return denied;

    try {
      const m = path.match(/^\/v1\/messages\/([a-z0-9-]+)(?:\/(raw|attachments\/(\d+)))?$/);
      if (path === "/v1/ping" && request.method === "GET") return ping(env);
      if (path === "/v1/messages" && request.method === "GET") return listMessages(url, env);
      if (path === "/v1/send" && request.method === "POST") return sendMail(request, env);
      if (m && !m[2] && request.method === "GET") return getMessage(m[1], env);
      if (m && !m[2] && request.method === "PATCH") return patchMessage(m[1], request, env);
      if (m && !m[2] && request.method === "DELETE") return deleteMessage(m[1], env);
      if (m && m[2] === "raw" && request.method === "GET") return getRaw(m[1], env);
      if (m && m[3] !== undefined && request.method === "GET") return getAttachment(m[1], Number(m[3]), env);
      return fail(404, "not_found", "No such route");
    } catch (e) {
      return fail(500, "server_error", String((e as Error)?.message || e));
    }
  },
} satisfies ExportedHandler<Env>;

/* ---------------------------------------------------------------------- helpers */

function requireToken(request: Request, env: Env): Response | null {
  if (!env.MAIL_TOKEN) return fail(503, "no_token", "MAIL_TOKEN secret is not configured on the worker");
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !timingSafeEqual(token, env.MAIL_TOKEN)) return fail(401, "unauthorized", "Bad token");
  return null;
}

async function ping(env: Env): Promise<Response> {
  const counts = await env.DB.prepare(
    "SELECT folder, COUNT(*) AS n, SUM(CASE WHEN unread = 1 THEN 1 ELSE 0 END) AS unread FROM mail_messages GROUP BY folder"
  ).all<{ folder: string; n: number; unread: number }>();
  const boxes = await env.DB.prepare(
    "SELECT mailbox, COUNT(*) AS n FROM mail_messages WHERE mailbox IS NOT NULL GROUP BY mailbox ORDER BY n DESC"
  ).all<{ mailbox: string; n: number }>();
  return json({
    ok: true,
    domain: env.MAIL_DOMAIN,
    defaultFrom: env.DEFAULT_FROM,
    defaultFromName: env.DEFAULT_FROM_NAME,
    canSend: !!env.RESEND_API_KEY,
    folders: counts.results,
    mailboxes: boxes.results,
  });
}

async function listMessages(url: URL, env: Env): Promise<Response> {
  const folder = (url.searchParams.get("folder") || "inbox").toLowerCase();
  const q = (url.searchParams.get("q") || "").trim();
  const before = url.searchParams.get("before") || "";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));

  const where: string[] = [];
  const args: unknown[] = [];
  if (folder === "starred") where.push("starred = 1 AND folder != 'trash'");
  else if (folder === "all") where.push("folder != 'trash'");
  else if (FOLDERS.has(folder)) { where.push("folder = ?"); args.push(folder); }
  else return fail(400, "bad_folder", "Unknown folder");
  if (q) { where.push("(subject LIKE ? OR from_addr LIKE ? OR from_name LIKE ? OR to_addrs LIKE ? OR snippet LIKE ?)"); const like = `%${q}%`; args.push(like, like, like, like, like); }
  if (before) { where.push("date < ?"); args.push(before); }

  const rows = await env.DB.prepare(
    `SELECT * FROM mail_messages WHERE ${where.join(" AND ")} ORDER BY date DESC LIMIT ?`
  ).bind(...args, limit).all<MessageRow>();
  return json({ ok: true, folder, messages: rows.results, nextBefore: rows.results.length === limit ? rows.results[rows.results.length - 1].date : null });
}

async function getMessage(id: string, env: Env): Promise<Response> {
  const row = await env.DB.prepare("SELECT * FROM mail_messages WHERE id = ?").bind(id).first<MessageRow>();
  if (!row) return fail(404, "not_found", "No such message");
  const doc = await env.BLOBS.get<MessageDoc>(`msg/${id}`, "json");
  if (!doc) return fail(404, "not_found", "Message body is missing");
  return json({ ok: true, message: { ...doc, folder: row.folder, unread: !!row.unread, starred: !!row.starred } });
}

async function patchMessage(id: string, request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ unread?: boolean; starred?: boolean; folder?: string }>(request);
  if (!body) return fail(400, "bad_request", "Send JSON");
  const sets: string[] = []; const args: unknown[] = [];
  if (typeof body.unread === "boolean") { sets.push("unread = ?"); args.push(body.unread ? 1 : 0); }
  if (typeof body.starred === "boolean") { sets.push("starred = ?"); args.push(body.starred ? 1 : 0); }
  if (typeof body.folder === "string") {
    if (!FOLDERS.has(body.folder)) return fail(400, "bad_folder", "Unknown folder");
    sets.push("folder = ?"); args.push(body.folder);
  }
  if (!sets.length) return fail(400, "bad_request", "Nothing to change");
  const r = await env.DB.prepare(`UPDATE mail_messages SET ${sets.join(", ")} WHERE id = ?`).bind(...args, id).run();
  if (!r.meta.changes) return fail(404, "not_found", "No such message");
  return json({ ok: true });
}

/** First DELETE moves to trash; DELETE on a trashed message removes it for good. */
async function deleteMessage(id: string, env: Env): Promise<Response> {
  const row = await env.DB.prepare("SELECT id, folder, attachment_count FROM mail_messages WHERE id = ?").bind(id).first<MessageRow>();
  if (!row) return fail(404, "not_found", "No such message");
  if (row.folder !== "trash") {
    await env.DB.prepare("UPDATE mail_messages SET folder = 'trash' WHERE id = ?").bind(id).run();
    return json({ ok: true, folder: "trash" });
  }
  const doc = await env.BLOBS.get<MessageDoc>(`msg/${id}`, "json");
  await env.DB.prepare("DELETE FROM mail_messages WHERE id = ?").bind(id).run();
  await env.BLOBS.delete(`msg/${id}`);
  await env.BLOBS.delete(`raw/${id}`);
  for (const a of doc?.attachments || []) await env.BLOBS.delete(`att/${id}/${a.index}`);
  return json({ ok: true, deleted: true });
}

async function getRaw(id: string, env: Env): Promise<Response> {
  const raw = await env.BLOBS.get(`raw/${id}`, "arrayBuffer");
  if (!raw) return fail(404, "not_found", "No raw copy for this message");
  return new Response(raw, { headers: { "content-type": "message/rfc822", "content-disposition": `attachment; filename="${id}.eml"`, "cache-control": "no-store" } });
}

async function getAttachment(id: string, index: number, env: Env): Promise<Response> {
  const doc = await env.BLOBS.get<MessageDoc>(`msg/${id}`, "json");
  const meta = doc?.attachments.find(a => a.index === index);
  if (!doc || !meta) return fail(404, "not_found", "No such attachment");
  const bytes = await env.BLOBS.get(`att/${id}/${index}`, "arrayBuffer");
  if (!bytes) return fail(404, "not_found", "Attachment data is missing");
  const safeName = meta.filename.replace(/[^\w.\-() ]+/g, "_");
  return new Response(bytes, { headers: { "content-type": meta.mime, "content-disposition": `attachment; filename="${safeName}"`, "cache-control": "no-store" } });
}

interface SendBody {
  from?: string; fromName?: string; to?: unknown; cc?: unknown; bcc?: unknown; subject?: string; text?: string; html?: string;
  inReplyTo?: string; references?: string; attachments?: { filename: string; mime?: string; contentBase64: string }[];
}

async function sendMail(request: Request, env: Env): Promise<Response> {
  if (!env.RESEND_API_KEY) return fail(503, "sending_not_configured", "Sending isn't set up yet: add the RESEND_API_KEY secret.");
  const body = await readJson<SendBody>(request);
  if (!body) return fail(400, "bad_request", "Send JSON");

  const fromAddress = (body.from || env.DEFAULT_FROM).trim().toLowerCase();
  if (!isEmail(fromAddress) || !fromAddress.endsWith("@" + env.MAIL_DOMAIN.toLowerCase())) return fail(400, "bad_from", `From must be an @${env.MAIL_DOMAIN} address`);
  const fromName = (body.fromName ?? env.DEFAULT_FROM_NAME).trim();
  const from: Address = fromName ? { name: fromName, address: fromAddress } : { address: fromAddress };

  const to = parseAddrList(body.to), cc = parseAddrList(body.cc), bcc = parseAddrList(body.bcc);
  if (!to.length && !cc.length && !bcc.length) return fail(400, "no_recipients", "Add at least one recipient");
  const subject = (body.subject || "").trim() || "(no subject)";
  const text = body.text || undefined;
  const html = body.html || undefined;
  if (!text && !html) return fail(400, "empty", "The message is empty");

  const attachments = (body.attachments || []).slice(0, 20).map(a => ({ filename: String(a.filename || "attachment"), content: a.contentBase64 }));
  const headers: Record<string, string> = {};
  if (body.inReplyTo) { headers["In-Reply-To"] = body.inReplyTo; headers["References"] = body.references ? `${body.references} ${body.inReplyTo}` : body.inReplyTo; }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: fmtAddr(from),
      to: to.map(fmtAddr), cc: cc.length ? cc.map(fmtAddr) : undefined, bcc: bcc.length ? bcc.map(fmtAddr) : undefined,
      subject, text, html,
      headers: Object.keys(headers).length ? headers : undefined,
      attachments: attachments.length ? attachments : undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) return fail(502, "provider_error", `Resend said ${res.status}: ${data.message || data.name || "unknown error"}`);

  const id = newId();
  const metas: AttachmentMeta[] = [];
  for (const [index, a] of (body.attachments || []).slice(0, 20).entries()) {
    const bytes = Uint8Array.from(atob(a.contentBase64), c => c.charCodeAt(0));
    await env.BLOBS.put(`att/${id}/${index}`, bytes);
    metas.push({ index, filename: a.filename || `attachment-${index + 1}`, mime: a.mime || "application/octet-stream", size: bytes.byteLength, inline: false });
  }
  const doc: MessageDoc = {
    id, direction: "out", mailbox: fromAddress, from, to, cc, bcc: bcc.length ? bcc : undefined, subject,
    date: new Date().toISOString(), html, text, attachments: metas,
    headers: { inReplyTo: body.inReplyTo || undefined, references: headers["References"] }, providerId: data.id,
  };
  await env.BLOBS.put(`msg/${id}`, JSON.stringify(doc));
  await env.DB.prepare(
    `INSERT INTO mail_messages (id, folder, direction, mailbox, from_addr, from_name, to_addrs, subject, snippet, date, unread, starred, attachment_count, size, in_reply_to, provider_id)
     VALUES (?, 'sent', 'out', ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
  ).bind(id, fromAddress, from.address, from.name ?? null, fmtAddrs(to), subject, snippetOf(text, html), doc.date, metas.length, (text || html || "").length, body.inReplyTo ?? null, data.id ?? null).run();

  return json({ ok: true, id, providerId: data.id });
}
