/** Intake questions and the training plan the portal builds from the answers. Shared by the API; the client fetches it. */

export interface Question {
  id: string;
  title: string;
  help?: string;
  type: "choice" | "scale" | "text" | "textarea";
  options?: Array<{ value: string; label: string; hint?: string }>;
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export const QUESTIONS: Question[] = [
  { id: "name", title: "What should I call you?", help: "First name or your in-game name is fine.", type: "text", required: true, placeholder: "Ryvoki", maxLength: 40 },
  { id: "platform", title: "What do you play on?", type: "choice", required: true, options: [
    { value: "pc", label: "PC", hint: "Mouse and keyboard" },
    { value: "phone", label: "Phone", hint: "Touch controls" },
    { value: "tablet", label: "Tablet / iPad", hint: "Touch controls, bigger screen" },
    { value: "controller", label: "Controller", hint: "On any device" },
  ] },
  { id: "rank", title: "What's your current rank?", help: "Be honest, the plan depends on it.", type: "choice", required: true, options: [
    { value: "bronze", label: "Bronze" }, { value: "silver", label: "Silver" }, { value: "gold", label: "Gold" }, { value: "platinum", label: "Platinum" },
    { value: "diamond", label: "Diamond" }, { value: "master", label: "Master" }, { value: "legend", label: "Legend" }, { value: "mythic", label: "Mythic (already there, want to stay)" },
  ] },
  { id: "hours", title: "Roughly how many hours have you played?", type: "choice", required: true, options: [
    { value: "new", label: "Under 50", hint: "Still learning the basics" }, { value: "some", label: "50 to 200" }, { value: "lots", label: "200 to 500" }, { value: "veteran", label: "500+" },
  ] },
  { id: "mode", title: "What do you mostly queue?", type: "choice", required: true, options: [
    { value: "solo", label: "Solo" }, { value: "duo", label: "Duo" }, { value: "squad", label: "Squad with randoms" }, { value: "stack", label: "Squad with friends" },
  ] },
  { id: "aim", title: "How confident are you in your aim?", help: "1 means you lose most 1v1s at any range. 10 means aim is never why you die.", type: "scale", min: 1, max: 10, required: true },
  { id: "movement", title: "How confident are you in your movement?", help: "Slides, jumps, peeks, using cover, not getting caught in the open.", type: "scale", min: 1, max: 10, required: true },
  { id: "sense", title: "How confident are you in your game sense?", help: "Rotations, when to fight, reading sound, not third-partying yourself into a grave.", type: "scale", min: 1, max: 10, required: true },
  { id: "struggle", title: "What loses you the most games right now?", type: "choice", required: true, options: [
    { value: "aim", label: "Losing gunfights I should win" }, { value: "movement", label: "Getting caught in the open" }, { value: "positioning", label: "Bad zone or rotations" },
    { value: "decisions", label: "Taking fights I shouldn't" }, { value: "consistency", label: "Good games then terrible games" }, { value: "tilt", label: "Tilt. I know it." },
  ] },
  { id: "activity", title: "How often will you actually train?", help: "This sets your pace and your goal. Pick what you'll really do, not what sounds good.", type: "choice", required: true, options: [
    { value: "daily", label: "Every day", hint: "About 5 lessons a week" }, { value: "often", label: "3 to 4 days a week", hint: "About 3 lessons a week" },
    { value: "weekly", label: "1 to 2 days a week", hint: "About 1 lesson a week" }, { value: "casual", label: "When I can", hint: "A lesson every week or two" },
  ] },
  { id: "discord", title: "Your Discord username", help: "For the students channel and the 1-on-1 call.", type: "text", required: true, placeholder: "yourname", maxLength: 60 },
  { id: "notes", title: "Anything else I should know?", help: "Optional. Injuries, device limits, a clip of you playing, whatever helps me coach you.", type: "textarea", required: false, placeholder: "Optional", maxLength: 1000 },
];

export interface Plan {
  lessonsPerWeek: number;
  drillMinutesPerDay: number;
  targetWeeks: number;
  targetDate: string;
  focus: string[];
  summary: string;
}

const PACE: Record<string, { lessonsPerWeek: number; drillMinutes: number }> = {
  daily: { lessonsPerWeek: 5, drillMinutes: 30 },
  often: { lessonsPerWeek: 3, drillMinutes: 25 },
  weekly: { lessonsPerWeek: 1, drillMinutes: 20 },
  casual: { lessonsPerWeek: 0.7, drillMinutes: 15 },
};

export function buildPlan(answers: Record<string, string>, lessonCount: number, now = new Date()): Plan {
  const pace = PACE[answers.activity] ?? PACE.weekly;
  const targetWeeks = Math.max(2, Math.ceil(lessonCount / pace.lessonsPerWeek));
  const targetDate = new Date(now.getTime() + targetWeeks * 7 * 86_400_000).toISOString().slice(0, 10);
  const scores = { aim: Number(answers.aim) || 5, movement: Number(answers.movement) || 5, sense: Number(answers.sense) || 5 };
  const ordered = (Object.keys(scores) as Array<keyof typeof scores>).sort((a, b) => scores[a] - scores[b]);
  const labels: Record<string, string> = { aim: "aim", movement: "movement", sense: "game sense", positioning: "positioning", decisions: "fight selection", consistency: "consistency", tilt: "mindset" };
  const focus = [labels[answers.struggle] ?? "aim", labels[ordered[0]] ?? "aim"].filter((value, index, list) => list.indexOf(value) === index);
  const name = answers.name?.trim() || "you";
  const prettyDate = new Date(targetDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  const summary = `${name}, ${pace.lessonsPerWeek >= 1 ? `${pace.lessonsPerWeek} lesson${pace.lessonsPerWeek === 1 ? "" : "s"} a week` : "a lesson every week or two"} plus ${pace.drillMinutes} minutes of drills on the days you play. Finish by ${prettyDate} and you're on track. Your first focus is ${focus[0]}${focus[1] ? `, then ${focus[1]}` : ""}.`;
  return { lessonsPerWeek: pace.lessonsPerWeek, drillMinutesPerDay: pace.drillMinutes, targetWeeks, targetDate, focus, summary };
}

export function validateAnswers(input: Record<string, unknown>): { answers: Record<string, string>; missing: string[] } {
  const answers: Record<string, string> = {};
  const missing: string[] = [];
  for (const question of QUESTIONS) {
    const raw = input[question.id];
    const value = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
    if (!value) { if (question.required) missing.push(question.id); continue; }
    if (question.type === "choice" && !question.options?.some(option => option.value === value)) { missing.push(question.id); continue; }
    if (question.type === "scale" && (!/^\d+$/.test(value) || Number(value) < (question.min ?? 1) || Number(value) > (question.max ?? 10))) { missing.push(question.id); continue; }
    answers[question.id] = value.slice(0, question.maxLength ?? 200);
  }
  return { answers, missing };
}
