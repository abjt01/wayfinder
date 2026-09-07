import type { LearningPath, Milestone, PathItem } from "./types";

/**
 * One place for "how far through the path is this learner".
 *
 * The same handful of derivations — flatten the milestones, split on completed,
 * sum hours, turn hours into weeks — were written out in the two pages, the
 * header, the command palette, the milestone rail and three functions of the
 * local engine. They had already drifted: some guarded a zero denominator and
 * some did not.
 *
 * Deliberately NOT unified: how many weeks a page reports. `/path` quotes the
 * whole plan, `/dashboard` quotes what is left, and the engine's path builder
 * quotes its own greedy accumulator. Those are three different numbers under
 * one formula, so `weeksAt` takes the hours explicitly and each caller keeps
 * saying which it means.
 */

/** Every item across every milestone, in path order. */
export function pathItems(path: LearningPath | null | undefined): PathItem[] {
  return path?.milestones.flatMap((m) => m.items) ?? [];
}

export type PathProgress = {
  items: PathItem[];
  done: PathItem[];
  remaining: PathItem[];
  doneHours: number;
  remainingHours: number;
  /** Percent of items complete, 0 when the path is empty. */
  pct: number;
  /** First unfinished item, or null once everything is done. */
  next: PathItem | null;
};

export function pathProgress(
  path: LearningPath | null | undefined,
  completed: string[]
): PathProgress {
  const items = pathItems(path);
  const isDone = (i: PathItem) => completed.includes(i.id);
  const done = items.filter(isDone);
  const remaining = items.filter((i) => !isDone(i));
  const hours = (list: PathItem[]) => list.reduce((sum, i) => sum + i.hours, 0);

  return {
    items,
    done,
    remaining,
    doneHours: hours(done),
    remainingHours: hours(remaining),
    pct: items.length ? Math.round((done.length / items.length) * 100) : 0,
    next: remaining[0] ?? null,
  };
}

export type MilestoneProgress = {
  done: number;
  total: number;
  pct: number;
  complete: boolean;
  /** The tri-state label shown wherever a milestone is summarised. */
  state: "complete" | "in progress" | "not started";
};

export function milestoneProgress(m: Milestone, completed: string[]): MilestoneProgress {
  const total = m.items.length;
  const done = m.items.filter((i) => completed.includes(i.id)).length;
  // Guarded: two of the four original copies divided by total unchecked, safe
  // only because buildPath happens to drop empty milestones today.
  const pct = total ? Math.round((done / total) * 100) : 0;
  return {
    done,
    total,
    pct,
    complete: total > 0 && done === total,
    state: pct === 100 ? "complete" : pct > 0 ? "in progress" : "not started",
  };
}

/** Milestones with every item complete. */
export function milestonesCleared(path: LearningPath, completed: string[]): number {
  return path.milestones.filter((m) => milestoneProgress(m, completed).complete).length;
}

/** Whole weeks needed to burn `hours` at a weekly budget, guarding a zero budget. */
export function weeksAt(hours: number, hoursPerWeek: number): number {
  return Math.ceil(hours / Math.max(1, hoursPerWeek));
}

/** Weekly hours needed to finish `hours` inside `weeks`. */
export function paceFor(hours: number, weeks: number): number {
  return Math.ceil(hours / Math.max(1, weeks));
}

/** Sum of the hours of any list of items. */
export function sumHours(items: Pick<PathItem, "hours">[]): number {
  return items.reduce((sum, i) => sum + i.hours, 0);
}
