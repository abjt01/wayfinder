"use client";

import { useState } from "react";
import { useReducedMotion } from "@/lib/hooks";
import type { SkillGap } from "@/lib/types";

/** A skill gap as the radar needs it; the dashboard plots rows with no note. */
type Axis = Pick<SkillGap, "skill" | "current" | "target"> & { note?: string };

const SIZE = 260;
const C = SIZE / 2;
const RADIUS = 88;

function point(i: number, total: number, value: number) {
  const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
  const r = (Math.max(0, Math.min(100, value)) / 100) * RADIUS;
  return [C + Math.cos(angle) * r, C + Math.sin(angle) * r] as const;
}

function polygon(axes: Axis[], key: "current" | "target") {
  return axes.map((a, i) => point(i, axes.length, a[key]).join(",")).join(" ");
}

/** Current-vs-target radar. Axis labels are interactive. */
export function SkillRadar({ axes }: { axes: Axis[] }) {
  const reduced = useReducedMotion();
  const [focus, setFocus] = useState<number | null>(null);
  const data = axes.slice(0, 8);
  if (data.length < 3) return null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-[260px] w-[260px] shrink-0" role="img" aria-label="Skill radar">
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={data.map((_, i) => point(i, data.length, ring).join(",")).join(" ")}
            fill="none"
            stroke="var(--color-rule)"
            strokeWidth={ring === 100 ? 1.2 : 0.8}
            strokeDasharray={ring === 100 ? undefined : "2 4"}
          />
        ))}
        {data.map((_, i) => {
          const [x, y] = point(i, data.length, 100);
          return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="var(--color-rule)" strokeWidth="0.8" />;
        })}

        <polygon
          points={polygon(data, "target")}
          fill="none"
          stroke="var(--color-rust)"
          strokeWidth="1.4"
          strokeDasharray="4 3"
        />
        <g
          className={reduced ? "" : "anim-pop"}
          style={{ transformOrigin: `${C}px ${C}px` }}
        >
          <polygon
            points={polygon(data, "current")}
            fill="var(--color-ink)"
            fillOpacity="0.1"
            stroke="var(--color-ink)"
            strokeWidth="1.8"
          />
        </g>

        {data.map((a, i) => {
          const [x, y] = point(i, data.length, a.current);
          const on = focus === i;
          return (
            <circle
              key={a.skill}
              cx={x}
              cy={y}
              r={on ? 4.5 : 3}
              fill={on ? "var(--color-rust)" : "var(--color-ink)"}
              className="transition-all duration-150"
            />
          );
        })}
      </svg>

      <ul className="w-full space-y-1.5">
        {data.map((a, i) => (
          <li key={a.skill}>
            <button
              onMouseEnter={() => setFocus(i)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(i)}
              onBlur={() => setFocus(null)}
              className={`flex w-full items-baseline justify-between gap-3 border-b border-rule-soft px-1 py-1 text-left transition-colors ${
                focus === i ? "bg-rust-soft" : "hover:bg-paper"
              }`}
            >
              <span className="truncate text-[13px]">{a.skill}</span>
              <span className="t-meta shrink-0">
                {a.current} → {a.target}
              </span>
            </button>
          </li>
        ))}
        <li className="flex items-center gap-4 pt-2 text-[11px] text-ink-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 bg-ink" /> now
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4">
              <line x1="0" y1="2" x2="16" y2="2" stroke="var(--color-rust)" strokeWidth="1.4" strokeDasharray="4 3" />
            </svg>
            target
          </span>
        </li>
      </ul>
    </div>
  );
}
