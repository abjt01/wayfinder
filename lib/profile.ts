import type { Level, Profile } from "./types";

/**
 * One place that turns anything claiming to be a Profile into a real one.
 *
 * Profiles reach the API from two directions: freshly extracted by the model,
 * and replayed out of a browser's localStorage from an arbitrarily old build.
 * The engines index straight into `knownSkills`, `completedCourses` and
 * `interests`, so a profile missing any of them crashed the route with a 500.
 * Every field is filled here instead, and every route coerces on the way in.
 */

export const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

export function clampNumber(v: unknown, fallback: number, min: number, max: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function strArray(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(
    new Set(
      v
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((s) => s.trim().slice(0, 60))
    )
  ).slice(0, max);
}

/** True when there is enough here to recommend against. */
export function hasGoal(p: unknown): boolean {
  const c = p as Partial<Profile> | null | undefined;
  return Boolean(c && typeof c.goal === "string" && c.goal.trim().length > 3);
}

export function normalizeProfile(raw: Partial<Profile> | null | undefined, fallbackGoal = ""): Profile {
  const r = raw ?? {};
  const level = LEVELS.includes(r.level as Level) ? (r.level as Level) : "beginner";
  const goal =
    typeof r.goal === "string" && r.goal.trim() ? r.goal.trim().slice(0, 240) : fallbackGoal.slice(0, 240);
  return {
    goal,
    role: typeof r.role === "string" && r.role.trim() ? r.role.trim().slice(0, 60) : "Self-directed learner",
    level,
    interests: strArray(r.interests),
    knownSkills: strArray(r.knownSkills),
    completedCourses: strArray(r.completedCourses),
    weeklyHours: clampNumber(r.weeklyHours, 8, 1, 60),
    targetWeeks: clampNumber(r.targetWeeks, 12, 1, 104),
    preferences: strArray(r.preferences),
    notes: typeof r.notes === "string" ? r.notes.slice(0, 400) : "",
  };
}
