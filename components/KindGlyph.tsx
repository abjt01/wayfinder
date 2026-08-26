"use client";

import type { Course } from "@/lib/types";

const LABEL: Record<Course["kind"], string> = {
  course: "Course",
  project: "Project",
  assessment: "Checkpoint",
  reading: "Reading",
};

/** Hand-drawn marks per resource type — no icon font, no emoji. */
export function KindGlyph({ kind, size = 16 }: { kind: Course["kind"]; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "project":
      // hammer / build
      return (
        <svg {...common} aria-hidden>
          <path d="M2 13.2 8.4 6.8" />
          <path d="M7.2 5.6 10 2.8l3.2 3.2-2.8 2.8z" />
          <path d="M10.4 8.8 13.6 12" />
        </svg>
      );
    case "assessment":
      // target
      return (
        <svg {...common} aria-hidden>
          <circle cx="8" cy="8" r="6" />
          <circle cx="8" cy="8" r="2.6" />
          <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15" />
        </svg>
      );
    case "reading":
      // open book
      return (
        <svg {...common} aria-hidden>
          <path d="M8 4.2C6.6 3 4.6 2.8 2.4 3.2v9.2c2.2-.4 4.2-.2 5.6 1 1.4-1.2 3.4-1.4 5.6-1V3.2c-2.2-.4-4.2-.2-5.6 1z" />
          <path d="M8 4.2v9.2" />
        </svg>
      );
    default:
      // stacked layers
      return (
        <svg {...common} aria-hidden>
          <path d="M8 2 14 5 8 8 2 5z" />
          <path d="M2.6 8.2 8 10.9l5.4-2.7" />
          <path d="M2.6 11.3 8 14l5.4-2.7" />
        </svg>
      );
  }
}

export function KindTag({ kind }: { kind: Course["kind"] }) {
  const tone = {
    project: "border-rust/35 bg-rust-soft text-rust",
    assessment: "border-ochre/35 bg-ochre-soft text-ochre",
    reading: "border-moss/30 bg-moss-soft text-moss",
    course: "border-rule bg-paper text-ink-mute",
  }[kind];
  return (
    <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10.5px] ${tone}`}>
      <KindGlyph kind={kind} size={11} />
      {LABEL[kind]}
    </span>
  );
}

export { LABEL as KIND_LABEL };
