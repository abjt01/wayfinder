"use client";

import { Bar } from "./ui";
import { useScrollSpy } from "@/lib/hooks";
import { milestoneProgress } from "@/lib/progress";
import type { LearningPath } from "@/lib/types";

/** Sticky scroll-spy rail: shows where you are in the path while reading it. */
export function MilestoneSpine({
  path,
  completed,
}: {
  path: LearningPath;
  completed: string[];
}) {
  const ids = path.milestones.map((m) => m.id);
  const active = useScrollSpy(ids);

  return (
    <nav aria-label="Milestones" className="space-y-0">
      {path.milestones.map((m, i) => {
        const { done, pct } = milestoneProgress(m, completed);
        const isActive = active === m.id;
        return (
          <a
            key={m.id}
            href={`#${m.id}`}
            className={`flex gap-3 border-l-2 py-2.5 pl-3 pr-2 transition-colors ${
              isActive ? "border-ink bg-paper" : "border-rule hover:border-ink-faint hover:bg-paper/60"
            }`}
          >
            <span className={`t-num text-[15px] ${isActive ? "text-ink" : "text-ink-faint"}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[13px] ${isActive ? "text-ink" : "text-ink-mute"}`}>
                {m.title}
              </span>
              <span className="mt-1 flex items-center gap-2">
                <Bar pct={pct} tone={pct === 100 ? "moss" : "ink"} className="h-[3px] flex-1" />
                <span className="t-meta shrink-0">
                  {done}/{m.items.length}
                </span>
              </span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}
