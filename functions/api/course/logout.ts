import { json } from "../../_lib/http";
import { clearSessionCookie } from "../../_lib/session";

export const onRequestPost = async () => json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
