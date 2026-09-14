import type { Ctx } from "../../_lib/types";
import { json, fail, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/admin";
import { normalizeKey } from "../../_lib/ids";

/** POST /api/admin/revoke   Authorization: Bearer <ADMIN_TOKEN>   { key, restore?: true } */
export const onRequestPost = async ({ request, env }: Ctx) => {
  const denied = requireAdmin(request, env); if (denied) return denied;
  const body = await readJson<{ key?: string; restore?: boolean }>(request);
  const key = normalizeKey(String(body?.key || ""));
  if (!key) return fail(400, "invalid_key", "key required");
  const r = await env.DB.prepare("UPDATE licenses SET status = ? WHERE key = ?").bind(body?.restore ? "active" : "revoked", key).run();
  if (!r.meta.changes) return fail(404, "invalid_key", "Unknown key");
  return json({ ok: true, key, status: body?.restore ? "active" : "revoked" });
};
