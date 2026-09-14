import type { Env } from "./types";

/** Drops a message into the Ryvoki Mail inbox (same shape the mail worker writes), so it shows up in the desktop app. */
const MAILBOX = "business@ryvoki.com";

export interface InboxMessage {
  fromName: string;
  fromEmail: string;
  subject: string;
  text: string;
}

export async function deliverToInbox(env: Env, message: InboxMessage): Promise<string | null> {
  const kv = env.BLOBS;
  if (!kv) return null;
  const id = newId();
  const date = new Date().toISOString();
  const doc = {
    id, direction: "in", mailbox: MAILBOX,
    from: { name: message.fromName, address: message.fromEmail }, to: [{ address: MAILBOX }], cc: [], replyTo: [{ name: message.fromName, address: message.fromEmail }],
    subject: message.subject, date, text: message.text, attachments: [], headers: {},
  };
  await kv.put(`msg/${id}`, JSON.stringify(doc));
  await env.DB.prepare(
    `INSERT INTO mail_messages (id, folder, direction, mailbox, from_addr, from_name, to_addrs, subject, snippet, date, unread, starred, attachment_count, size)
     VALUES (?, 'inbox', 'in', ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?)`
  ).bind(id, MAILBOX, message.fromEmail, message.fromName, MAILBOX, message.subject, message.text.replace(/\s+/g, " ").slice(0, 180), date, message.text.length).run();
  return id;
}

export function newId(): string {
  const t = Date.now().toString(36).padStart(9, "0");
  const r = new Uint8Array(4); crypto.getRandomValues(r);
  return t + "-" + [...r].map(b => b.toString(16).padStart(2, "0")).join("");
}
