"use client";

import { useCountUp, useReducedMotion } from "@/lib/hooks";

/** Arc gauge with a count-up centre. Two-tone: ink for done, rule for rest. */
export function ProgressRing({
  value,
  label,
  size = 132,
  sub,
}: {
  value: number;
  label: string;
  size?: number;
  sub?: string;
}) {
  const reduced = useReducedMotion();
  const shown = useCountUp(value, 1000);
  const pct = Math.max(0, Math.min(100, reduced ? value : shown));
  const stroke = 9;
  const r = (size - stroke) / 2 - 6;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const arc = 0.78; // three-quarter dial
  const visible = circ * arc;
  const filled = visible * (pct / 100);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`} role="img" aria-label={`${label}: ${Math.round(pct)}%`}>
        <g transform={`rotate(-230 ${c} ${c})`}>
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="var(--color-rule)"
            strokeWidth={stroke}
            strokeDasharray={`${visible} ${circ}`}
            strokeLinecap="butt"
          />
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={stroke}
            strokeDasharray={`${filled} ${circ}`}
            strokeLinecap="butt"
            className="transition-[stroke-dasharray] duration-500"
          />
        </g>
        <text x={c} y={c + 4} textAnchor="middle" fontFamily="var(--font-display)" fontSize="30" fill="var(--color-ink)">
          {Math.round(pct)}
          <tspan fontSize="15" fill="var(--color-ink-mute)">
            %
          </tspan>
        </text>
        <text x={c} y={c + 24} textAnchor="middle" className="font-mono" fontSize="10" fill="var(--color-ink-faint)">
          {label}
        </text>
      </svg>
      {sub && <p className="-mt-1 text-[12px] text-ink-mute">{sub}</p>}
    </div>
  );
}

/** Compact hours bar used in dashboard rows. */
export function HoursBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-[6px] flex-1 bg-rule">
        <div className="absolute inset-y-0 left-0 bg-ink transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="t-meta shrink-0">
        {done}/{total} h
      </span>
    </div>
  );
}
