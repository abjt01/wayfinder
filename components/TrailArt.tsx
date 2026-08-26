"use client";

import { useReducedMotion } from "@/lib/hooks";

/**
 * Decorative self-drawing trail for the landing hero — the same visual
 * language as the real journey map, so the product explains itself.
 */
export function TrailArt() {
  const reduced = useReducedMotion();
  const stops = [
    { x: 24, y: 96, label: "now" },
    { x: 116, y: 62, label: "" },
    { x: 208, y: 104, label: "" },
    { x: 300, y: 54, label: "" },
    { x: 392, y: 88, label: "" },
    { x: 484, y: 34, label: "goal" },
  ];
  const d = stops.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = stops[i - 1];
    const mx = (prev.x + p.x) / 2;
    return `${acc} C ${mx} ${prev.y}, ${mx} ${p.y}, ${p.x} ${p.y}`;
  }, "");

  return (
    <svg viewBox="0 0 508 130" className="w-full" aria-hidden>
      <path d={d} fill="none" stroke="var(--color-rule)" strokeWidth="2" strokeDasharray="5 6" />
      <path
        d={d}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="2"
        className={reduced ? "" : "anim-draw"}
        style={{ ["--dash" as string]: "700", animationDuration: "2.2s" }}
      />
      {stops.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={i === 0 || i === stops.length - 1 ? 6 : 4}
            fill={i === stops.length - 1 ? "var(--color-rust)" : "var(--color-ink)"}
            className={reduced ? "" : "anim-pop"}
            style={{ animationDelay: `${400 + i * 300}ms` }}
          />
          {p.label && (
            <text
              x={p.x}
              y={p.y - 14}
              textAnchor="middle"
              className="font-mono"
              fontSize="10"
              fill="var(--color-ink-faint)"
            >
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
