import { json } from "../../_lib/http";
import { MODULES, lessonSummaries, LESSON_COUNT } from "../../_lib/course-content";
import { QUESTIONS } from "../../_lib/course-plan";

/** GET /api/course/content — public outline: modules, lesson titles, intake questions. Reading itself needs a login. */
export const onRequestGet = async () =>
  json({ ok: true, modules: MODULES, lessons: lessonSummaries(), lessonCount: LESSON_COUNT, questions: QUESTIONS }, 200, { "cache-control": "public, max-age=300" });
