import { COURSE_BY_ID } from "./catalog";
import type { LearningPath, Milestone, PathItem, Profile } from "./types";

type RawItem = { courseId?: string; title?: string; why?: string; prereqNote?: string };
type RawMilestone = { title?: string; weeks?: string; outcome?: string; items?: RawItem[] };
export type RawPath = {
  title?: string;
  summary?: string;
  skillGaps?: { skill?: string; current?: unknown; target?: unknown; note?: string }[];
  milestones?: RawMilestone[];
};

function pct(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Turn the model's JSON into a validated path: every item must resolve to a
 * real catalog course, duplicates are dropped, hours are recomputed locally.
 */
export function buildPath(raw: RawPath, profile: Profile): LearningPath {
  const seen = new Set<string>(profile.completedCourses.map((c) => c.toLowerCase()));
  const milestones: Milestone[] = [];

  (raw.milestones ?? []).slice(0, 6).forEach((m, mi) => {
    const items: PathItem[] = [];
    (m.items ?? []).slice(0, 6).forEach((it, ii) => {
      const course = it.courseId ? COURSE_BY_ID.get(it.courseId.trim()) : undefined;
      if (!course) return;
      if (seen.has(course.id)) return;
      seen.add(course.id);
      items.push({
        id: `${mi}-${ii}-${course.id}`,
        courseId: course.id,
        title: course.title,
        kind: course.kind,
        provider: course.provider,
        hours: course.hours,
        skills: course.skills,
        why: (it.why || course.summary).trim(),
        prereqNote: (it.prereqNote || "").trim(),
        url: course.url,
      });
    });
    if (!items.length) return;
    milestones.push({
      id: `m${mi}`,
      title: (m.title || `Milestone ${mi + 1}`).trim(),
      weeks: (m.weeks || "").trim(),
      outcome: (m.outcome || "").trim(),
      items,
    });
  });

  const totalHours = milestones.reduce(
    (sum, m) => sum + m.items.reduce((s, i) => s + i.hours, 0),
    0
  );

  const skillGaps = (raw.skillGaps ?? [])
    .filter((g) => typeof g.skill === "string" && g.skill.trim())
    .slice(0, 10)
    .map((g) => ({
      skill: g.skill!.trim(),
      current: pct(g.current, 20),
      target: pct(g.target, 80),
      note: (g.note || "").trim(),
    }));

  return {
    title: (raw.title || `Path to ${profile.role}`).trim(),
    summary: (raw.summary || "").trim(),
    totalHours,
    skillGaps,
    milestones,
    createdAt: Date.now(),
  };
}

export function pathIsUsable(path: LearningPath) {
  return path.milestones.length > 0 && path.milestones.some((m) => m.items.length > 0);
}

export function pathDigest(path: LearningPath) {
  return path.milestones
    .map(
      (m) =>
        `${m.title} (${m.weeks}) -> ${m.outcome}\n` +
        m.items.map((i) => `  - [${i.courseId}] ${i.title} (${i.kind}, ${i.hours}h): ${i.why}`).join("\n")
    )
    .join("\n");
}
