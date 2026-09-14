import type { Ctx } from "../../../_lib/types";
import { json, fail } from "../../../_lib/http";
import { requireStudent } from "../../../_lib/course-access";
import { LESSONS, lessonById, MODULES } from "../../../_lib/course-content";

/** GET /api/course/lesson/:id — full lesson (video, reading, homework). Students only. */
export const onRequestGet = async (ctx: Ctx<{ id: string }>) => {
  const student = await requireStudent(ctx);
  if (student instanceof Response) return student;
  const lesson = lessonById(ctx.params.id);
  if (!lesson) return fail(404, "not_found", "Unknown lesson");
  const index = LESSONS.findIndex(item => item.id === lesson.id);
  const next = LESSONS[index + 1] ?? null;
  const prev = LESSONS[index - 1] ?? null;
  const done = await ctx.env.DB.prepare("SELECT note FROM course_progress WHERE license_id = ? AND lesson_id = ?").bind(student.licenseId, lesson.id).first<{ note: string | null }>();
  return json({
    ok: true,
    lesson,
    module: MODULES.find(module => module.number === lesson.module) ?? null,
    position: { index, total: LESSONS.length },
    next: next ? { id: next.id, title: next.title } : null,
    prev: prev ? { id: prev.id, title: prev.title } : null,
    completed: Boolean(done),
    note: done?.note ?? null,
  });
};
