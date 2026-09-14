import type { Ctx, LicenseRow } from "./types";
import { fail } from "./http";
import { readSession } from "./session";

export const COURSE_PRODUCT = "mythic-course";

export interface Student { license: LicenseRow; licenseId: number }

/** Resolves the logged-in student from the session cookie, or returns a 401 response. */
export async function requireStudent(ctx: Pick<Ctx, "request" | "env">): Promise<Student | Response> {
  const session = await readSession(ctx.env, ctx.request);
  if (!session) return fail(401, "not_logged_in", "Log in with your license key first");
  const license = await ctx.env.DB.prepare("SELECT * FROM licenses WHERE id = ? AND product = ?").bind(session.licenseId, COURSE_PRODUCT).first<LicenseRow>();
  if (!license) return fail(401, "not_logged_in", "Log in with your license key first");
  if (license.status !== "active") return fail(403, "revoked", "This course key has been revoked");
  return { license, licenseId: license.id };
}
