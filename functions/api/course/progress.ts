import type { Ctx } from "../../_lib/types";
import { json, fail, readJson } from "../../_lib/http";
import { requireStudent } from "../../_lib/course-access";
import { lessonById, LESSON_COUNT } from "../../_lib/course-content";

/** POST /api/course/progress { lessonId, done: true|false, note? } */
export const onRequestPost = async (ctx: Ctx) => {
  const student = await requireStudent(ctx);
  if (student instanceof Response) return student;
  const body = await readJson<{ lessonId?: string; done?: boolean; note?: string }>(ctx.request);
  const lesson = lessonById(String(body?.lessonId || ""));
  if (!lesson) return fail(404, "not_found", "Unknown lesson");

  if (body?.done === false) {
    await ctx.env.DB.prepare("DELETE FROM course_progress WHERE license_id = ? AND lesson_id = ?").bind(student.licenseId, lesson.id).run();
  } else {
    const note = String(body?.note || "").trim().slice(0, 500) || null;
    await ctx.env.DB.prepare(
      "INSERT INTO course_progress (license_id, lesson_id, note) VALUES (?, ?, ?) ON CONFLICT(license_id, lesson_id) DO UPDATE SET note = COALESCE(excluded.note, course_progress.note)"
    ).bind(student.licenseId, lesson.id, note).run();
  }
  const rows = await ctx.env.DB.prepare("SELECT lesson_id FROM course_progress WHERE license_id = ?").bind(student.licenseId).all<{ lesson_id: string }>();
  const done = rows.results.map(row => row.lesson_id);
  return json({ ok: true, done, count: done.length, total: LESSON_COUNT, allDone: done.length >= LESSON_COUNT });
};
