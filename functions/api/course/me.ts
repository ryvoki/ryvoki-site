import type { Ctx } from "../../_lib/types";
import { json } from "../../_lib/http";
import { requireStudent } from "../../_lib/course-access";
import { MODULES, lessonSummaries, LESSON_COUNT } from "../../_lib/course-content";
import { QUESTIONS } from "../../_lib/course-plan";

interface ProfileRow { answers: string; plan: string | null; completed: number; created_at: string; updated_at: string }
interface ProgressRow { lesson_id: string; completed_at: string }
interface CallRow { id: number; status: string; created_at: string }

/** GET /api/course/me — everything the dashboard needs in one call. */
export const onRequestGet = async (ctx: Ctx) => {
  const student = await requireStudent(ctx);
  if (student instanceof Response) return student;
  const { env } = ctx;
  const [profile, progress, call] = await Promise.all([
    env.DB.prepare("SELECT answers, plan, completed, created_at, updated_at FROM course_profiles WHERE license_id = ?").bind(student.licenseId).first<ProfileRow>(),
    env.DB.prepare("SELECT lesson_id, completed_at FROM course_progress WHERE license_id = ?").bind(student.licenseId).all<ProgressRow>(),
    env.DB.prepare("SELECT id, status, created_at FROM course_calls WHERE license_id = ? ORDER BY id DESC LIMIT 1").bind(student.licenseId).first<CallRow>(),
  ]);
  const done = progress.results.map(row => row.lesson_id);
  return json({
    ok: true,
    student: { key: maskKey(student.license.key), since: student.license.created_at },
    profile: profile ? { answers: safeJson(profile.answers), plan: profile.plan ? safeJson(profile.plan) : null, completed: Boolean(profile.completed), updatedAt: profile.updated_at } : null,
    progress: { done, count: done.length, total: LESSON_COUNT, allDone: done.length >= LESSON_COUNT },
    call: call ? { id: call.id, status: call.status, requestedAt: call.created_at } : null,
    modules: MODULES,
    lessons: lessonSummaries(),
    questions: QUESTIONS,
  });
};

const maskKey = (key: string) => key.slice(0, 4) + "•••••-•••••-•••••-" + key.slice(-5);
const safeJson = (s: string) => { try { return JSON.parse(s); } catch { return {}; } };
