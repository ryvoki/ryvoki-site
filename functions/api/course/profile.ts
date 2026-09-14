import type { Ctx } from "../../_lib/types";
import { json, fail, readJson } from "../../_lib/http";
import { requireStudent } from "../../_lib/course-access";
import { LESSON_COUNT } from "../../_lib/course-content";
import { buildPlan, validateAnswers } from "../../_lib/course-plan";

/**
 * POST /api/course/profile { answers: {...}, done?: boolean }
 * Saves intake answers to the profile. Partial saves are allowed while the wizard is in progress;
 * `done: true` requires every required answer and builds the training plan.
 */
export const onRequestPost = async (ctx: Ctx) => {
  const student = await requireStudent(ctx);
  if (student instanceof Response) return student;
  const body = await readJson<{ answers?: Record<string, unknown>; done?: boolean }>(ctx.request);
  if (!body?.answers || typeof body.answers !== "object") return fail(400, "bad_request", "Send answers");

  const { answers, missing } = validateAnswers(body.answers);
  const finishing = Boolean(body.done);
  if (finishing && missing.length) return fail(400, "incomplete", `Still need: ${missing.join(", ")}`);

  const plan = finishing ? buildPlan(answers, LESSON_COUNT) : null;
  await ctx.env.DB.prepare(
    `INSERT INTO course_profiles (license_id, answers, plan, completed)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(license_id) DO UPDATE SET answers = excluded.answers, plan = COALESCE(excluded.plan, course_profiles.plan),
       completed = MAX(course_profiles.completed, excluded.completed), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ).bind(student.licenseId, JSON.stringify(answers), plan ? JSON.stringify(plan) : null, finishing ? 1 : 0).run();

  return json({ ok: true, answers, plan, completed: finishing });
};
