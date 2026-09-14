import type { Ctx } from "../../_lib/types";
import { json, fail, readJson } from "../../_lib/http";
import { requireStudent } from "../../_lib/course-access";
import { LESSON_COUNT } from "../../_lib/course-content";
import { deliverToInbox } from "../../_lib/inbox";

/**
 * POST /api/course/schedule { discord, timezone, availability, notes? }
 * Unlocked once every lesson is complete. Files a call request and drops it into the Ryvoki Mail inbox.
 */
export const onRequestPost = async (ctx: Ctx) => {
  const student = await requireStudent(ctx);
  if (student instanceof Response) return student;
  const { env } = ctx;

  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM course_progress WHERE license_id = ?").bind(student.licenseId).first<{ n: number }>();
  if (Number(count?.n || 0) < LESSON_COUNT) return fail(403, "not_finished", "Finish every lesson first, then book the call.");

  const open = await env.DB.prepare("SELECT id FROM course_calls WHERE license_id = ? AND status = 'requested'").bind(student.licenseId).first<{ id: number }>();
  if (open) return fail(409, "already_requested", "You've already requested a call. Ryvoki will confirm a time on Discord.");

  const body = await readJson<{ discord?: string; timezone?: string; availability?: string; notes?: string }>(ctx.request);
  const discord = String(body?.discord || "").trim().slice(0, 80);
  const timezone = String(body?.timezone || "").trim().slice(0, 80);
  const availability = String(body?.availability || "").trim().slice(0, 500);
  const notes = String(body?.notes || "").trim().slice(0, 2000);
  if (!discord) return fail(400, "bad_discord", "Your Discord username is needed so I can reach you.");
  if (!availability) return fail(400, "bad_availability", "Tell me when you're usually free.");

  const profile = await env.DB.prepare("SELECT answers, plan FROM course_profiles WHERE license_id = ?").bind(student.licenseId).first<{ answers: string; plan: string | null }>();
  const answers = safeJson(profile?.answers || "{}");
  const plan = safeJson(profile?.plan || "{}");

  const insert = await env.DB.prepare("INSERT INTO course_calls (license_id, discord, timezone, availability, notes) VALUES (?, ?, ?, ?, ?)")
    .bind(student.licenseId, discord, timezone || null, availability, notes || null).run();

  const summary = [
    `${answers.name || "A student"} finished every lesson and wants their 1-on-1.`,
    ``,
    `Discord: ${discord}`,
    `Timezone: ${timezone || "not given"}`,
    `Free: ${availability}`,
    notes ? `Notes: ${notes}` : null,
    ``,
    `Intake: ${answers.platform || "?"} · rank ${answers.rank || "?"} · ${answers.hours || "?"} hours · queues ${answers.mode || "?"}`,
    `Confidence: aim ${answers.aim || "?"}/10 · movement ${answers.movement || "?"}/10 · game sense ${answers.sense || "?"}/10`,
    `Biggest struggle: ${answers.struggle || "?"} · trains ${answers.activity || "?"}`,
    plan.summary ? `Plan: ${plan.summary}` : null,
    answers.notes ? `Their notes: ${answers.notes}` : null,
    ``,
    `License: ${student.license.key} · call request #${insert.meta.last_row_id ?? "?"}`,
  ].filter(line => line !== null).join("\n");

  await deliverToInbox(env, { fromName: `${answers.name || "Student"} (course)`, fromEmail: "course@ryvoki.com", subject: `[Coaching] 1-on-1 request from ${answers.name || discord}`, text: summary }).catch(() => null);
  return json({ ok: true, id: insert.meta.last_row_id ?? null });
};

const safeJson = (s: string): Record<string, string> => { try { return JSON.parse(s); } catch { return {}; } };
