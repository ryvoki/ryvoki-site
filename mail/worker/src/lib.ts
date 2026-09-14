export interface Env {
  DB: D1Database;
  BLOBS: KVNamespace;
  MAIL_DOMAIN: string;
  DEFAULT_FROM: string;
  DEFAULT_FROM_NAME: string;
  FORWARD_TO?: string;
  MAIL_TOKEN?: string;
  RESEND_API_KEY?: string;
}

export interface Address { name?: string; address: string }

export interface AttachmentMeta {
  index: number;
  filename: string;
  mime: string;
  size: number;
  contentId?: string;
  inline: boolean;
}

/** Full message document stored in KV under msg/<id>. */
export interface MessageDoc {
  id: string;
  direction: "in" | "out";
  mailbox: string;
  from: Address;
  to: Address[];
  cc: Address[];
  bcc?: Address[];
  replyTo?: Address[];
  subject: string;
  date: string;
  html?: string;
  text?: string;
  attachments: AttachmentMeta[];
  headers: { messageId?: string; inReplyTo?: string; references?: string };
  providerId?: string;
}

export interface MessageRow {
  id: string; folder: string; direction: string; mailbox: string | null; from_addr: string | null; from_name: string | null;
  to_addrs: string | null; subject: string | null; snippet: string | null; date: string; unread: number; starred: number;
  attachment_count: number; size: number | null; message_id: string | null; in_reply_to: string | null; provider_id: string | null;
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

export const fail = (status: number, error: string, message: string) => json({ ok: false, error, message }, status);

export async function readJson<T>(request: Request): Promise<T | null> {
  try { return (await request.json()) as T; } catch { return null; }
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

/** Ids sort by creation time as plain strings: zero-padded base36 millis + random tail. */
export function newId(): string {
  const t = Date.now().toString(36).padStart(9, "0");
  const r = new Uint8Array(4); crypto.getRandomValues(r);
  return t + "-" + [...r].map(b => b.toString(16).padStart(2, "0")).join("");
}

export const fmtAddr = (a?: Address | null) => a ? (a.name ? `${a.name} <${a.address}>` : a.address) : "";
export const fmtAddrs = (list?: Address[] | null) => (list || []).map(fmtAddr).join(", ");

export function snippetOf(text?: string, html?: string): string {
  let s = text && text.trim() ? text : (html || "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
  return s.slice(0, 180);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** Loose email address check, good enough to stop typos before they reach the provider. */
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Parses "Name <addr>" or "addr" into an Address. */
export function parseAddr(input: string): Address | null {
  const s = input.trim();
  const m = s.match(/^(.*?)\s*<([^>]+)>$/);
  const address = (m ? m[2] : s).trim().toLowerCase();
  if (!isEmail(address)) return null;
  const name = m ? m[1].replace(/^"|"$/g, "").trim() : undefined;
  return name ? { name, address } : { address };
}

export function parseAddrList(input: unknown): Address[] {
  if (Array.isArray(input)) return input.map(x => typeof x === "string" ? parseAddr(x) : (x && typeof x === "object" && "address" in x ? parseAddr(fmtAddr(x as Address)) : null)).filter((x): x is Address => !!x);
  if (typeof input === "string") return input.split(/[;,]/).map(parseAddr).filter((x): x is Address => !!x);
  return [];
}
