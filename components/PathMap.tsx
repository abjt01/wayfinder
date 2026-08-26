"use client";

import { useMemo, useState } from "react";
import { KindGlyph } from "./KindGlyph";
import { useReducedMotion } from "@/lib/hooks";
import type { LearningPath, PathItem } from "@/lib/types";

const COL_W = 168;
const PAD_X = 58;
const H = 268;
const TOP = 64;
const AMP = 46;
const R = 17;

type Node = {
  item: PathItem;
  x: number;
  y: number;
  milestone: number;
  done: boolean;
  index: number;
};

/**
 * The journey map: milestones as columns, resources as nodes on a drawn trail.
 * The trail is stroked twice — a full dashed route and a solid overlay clipped
 * to how far the learner has actually got.
 */
export function PathMap({
  path,
  completed,
  onSelect,
}: {
  path: LearningPath;
  completed: string[];
  onSelect?: (itemId: string) => void;
}) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<Node | null>(null);

  const { nodes, width, trail, doneTrail, columns, nextNode } = useMemo(() => {
    const cols = path.milestones.map((m) => m.items);
    const ns: Node[] = [];
    let running = 0;

    cols.forEach((items, ci) => {
      const cx = PAD_X + ci * COL_W + COL_W / 2;
      items.forEach((item, ii) => {
        const spread = items.length > 1 ? (ii / (items.length - 1) - 0.5) * 2 : 0;
        const y = TOP + H / 2 - 30 + spread * AMP + (ci % 2 === 0 ? -8 : 8);
        ns.push({
          item,
          x: cx + (ii % 2 === 0 ? -26 : 26),
          y,
          milestone: ci,
          done: completed.includes(item.id),
          index: running++,
        });
      });
    });

    const w = PAD_X * 2 + Math.max(1, cols.length) * COL_W;

    // Smooth cubic trail through every node.
    const line = (list: Node[]) => {
      if (list.length === 0) return "";
      if (list.length === 1) return `M ${list[0].x} ${list[0].y}`;
      let d = `M ${list[0].x} ${list[0].y}`;
      for (let i = 1; i < list.length; i++) {
        const p = list[i - 1];
        const c = list[i];
        const mx = (p.x + c.x) / 2;
        d += ` C ${mx} ${p.y}, ${mx} ${c.y}, ${c.x} ${c.y}`;
      }
      return d;
    };

    // Completed prefix: contiguous run of done nodes from the start.
    let lastDone = -1;
    for (let i = 0; i < ns.length; i++) {
      if (ns[i].done) lastDone = i;
      else break;
    }
    const prefix = lastDone >= 0 ? ns.slice(0, lastDone + 1) : [];
    const next = ns.find((n) => !n.done) ?? null;

    return {
      nodes: ns,
      width: w,
      trail: line(ns),
      doneTrail: prefix.length > 1 ? line(prefix) : "",
      columns: cols,
      nextNode: next,
    };
  }, [path, completed]);

  const active = hover ?? nextNode;

  return (
    <div>
      <div className="thin-scroll edge-fade overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${H}`}
          width={width}
          height={H}
          className="block"
          role="img"
          aria-label={`Journey map with ${nodes.length} resources across ${columns.length} milestones`}
        >
          {/* column bands + milestone headers */}
          {columns.map((items, ci) => {
            const x = PAD_X + ci * COL_W;
            const m = path.milestones[ci];
            const doneCount = items.filter((i) => completed.includes(i.id)).length;
            const complete = doneCount === items.length;
            return (
              <g key={m.id}>
                {ci > 0 && (
                  <line x1={x} y1={30} x2={x} y2={H - 14} stroke="var(--color-rule)" strokeDasharray="2 5" />
                )}
                <text
                  x={x + 12}
                  y={26}
                  className="font-mono"
                  fontSize="10.5"
                  fill={complete ? "var(--color-moss)" : "var(--color-ink-faint)"}
                >
                  {m.weeks || `Milestone ${ci + 1}`}
                </text>
                <text x={x + 12} y={44} fontSize="13" fill="var(--color-ink)" fontFamily="var(--font-display)">
                  {m.title.length > 22 ? `${m.title.slice(0, 21)}…` : m.title}
                </text>
                <text x={x + 12} y={H - 16} className="font-mono" fontSize="10" fill="var(--color-ink-faint)">
                  {doneCount}/{items.length} done
                </text>
              </g>
            );
          })}

          {/* prerequisite links inside the path */}
          {nodes.map((n) =>
            n.item.prereqNote && n.index > 0 ? (
              <path
                key={`pr-${n.item.id}`}
                d={`M ${nodes[n.index - 1].x} ${nodes[n.index - 1].y} Q ${(nodes[n.index - 1].x + n.x) / 2} ${
                  Math.min(nodes[n.index - 1].y, n.y) - 34
                } ${n.x} ${n.y}`}
                fill="none"
                stroke="var(--color-rule)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            ) : null
          )}

          {/* the route */}
          <path
            d={trail}
            fill="none"
            stroke="var(--color-rule)"
            strokeWidth="2.5"
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
          {doneTrail && (
            <path
              d={doneTrail}
              fill="none"
              stroke="var(--color-moss)"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={reduced ? "" : "anim-draw"}
              style={{ ["--dash" as string]: "1400" }}
            />
          )}

          {/* nodes */}
          {nodes.map((n) => {
            const isActive = active?.item.id === n.item.id;
            const stroke = n.done ? "var(--color-moss)" : isActive ? "var(--color-rust)" : "var(--color-ink)";
            return (
              <g
                key={n.item.id}
                transform={`translate(${n.x} ${n.y})`}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                aria-label={`${n.item.title}, ${n.done ? "complete" : "not started"}`}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect?.(n.item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(n.item.id);
                  }
                }}
              >
                {nextNode?.item.id === n.item.id && !reduced && (
                  <circle r={R} fill="none" stroke="var(--color-rust)" strokeWidth="1.5" className="pulse-ring" />
                )}
                <circle
                  r={R}
                  fill={n.done ? "var(--color-moss-soft)" : "var(--color-card)"}
                  stroke={stroke}
                  strokeWidth={isActive ? 2.2 : 1.5}
                  className="transition-all duration-200"
                />
                <g transform="translate(-8 -8)" style={{ color: stroke }}>
                  {n.done ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" className="anim-tick">
                      <path
                        d="M3.6 8.4 6.6 11.4 12.4 5"
                        fill="none"
                        stroke="var(--color-moss)"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <KindGlyph kind={n.item.kind} />
                  )}
                </g>
                <text
                  y={R + 15}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="9.5"
                  fill={isActive ? "var(--color-ink)" : "var(--color-ink-faint)"}
                >
                  {n.item.hours}h
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* inspector strip — replaces a floating tooltip so nothing clips */}
      <div className="min-h-[62px] border-t border-rule bg-paper px-5 py-3">
        {active ? (
          <div key={active.item.id} className="anim-fade flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="t-meta">
              {String(active.index + 1).padStart(2, "0")} / {String(nodes.length).padStart(2, "0")}
            </span>
            <span className="text-[13.5px] font-medium">{active.item.title}</span>
            <span className="t-meta">
              {active.item.provider} · {active.item.hours}h · {active.done ? "complete" : "pending"}
            </span>
            <p className="w-full text-[12.5px] text-ink-mute">{active.item.why}</p>
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-faint">
            Hover or focus a node to inspect it. Click to jump to the resource.
          </p>
        )}
      </div>
    </div>
  );
}
