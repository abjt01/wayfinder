"use client";

import { useMemo, useState } from "react";
import { KindGlyph, KindTag } from "@/components/KindGlyph";
import { useAssistant } from "@/components/AssistantHost";
import { Button, Chip, Panel, Stat } from "@/components/ui";
import { CATALOG, COURSE_BY_ID } from "@/lib/catalog";
import { useHydrated, useStore } from "@/lib/store";
import type { Course, Level } from "@/lib/types";

const KINDS: Course["kind"][] = ["course", "project", "assessment", "reading"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const DOMAINS = Array.from(new Set(CATALOG.map((c) => c.domain))).sort();

export default function ExplorePage() {
  const hydrated = useHydrated();
  const { path } = useStore();
  const assistant = useAssistant();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Course["kind"] | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Empty until localStorage has been read, so the first client render matches
  // the prerendered HTML.
  const inPath = useMemo(
    () =>
      new Set(
        hydrated
          ? (path?.milestones.flatMap((m) => m.items.map((i) => i.courseId)).filter(Boolean) as string[])
          : []
      ),
    [path, hydrated]
  );

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return CATALOG.filter((c) => {
      if (kind && c.kind !== kind) return false;
      if (level && c.level !== level) return false;
      if (domain && c.domain !== domain) return false;
      if (!term) return true;
      return `${c.title} ${c.summary} ${c.provider} ${c.domain} ${c.skills.join(" ")}`
        .toLowerCase()
        .includes(term);
    });
  }, [q, kind, level, domain]);

  const totalHours = results.reduce((s, c) => s + c.hours, 0);
  const active = kind || level || domain || q.trim();

  return (
    <div className="mx-auto max-w-[1180px] px-4 sm:px-5 py-8">
      <header className="border-b border-rule pb-6">
        <p className="t-meta">THE CATALOG</p>
        <h1 className="t-h1 mt-2">Everything Wayfinder can recommend</h1>
        <p className="mt-3 max-w-[70ch] text-[14px] text-ink-soft">
          Recommendations are retrieved from exactly this list, which is why nothing invented ever ends up
          in your path. Prerequisites are real edges between these entries.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-4">
          <Stat label="ENTRIES" value={CATALOG.length} sub={`${results.length} shown`} />
          <Stat label="TOTAL EFFORT" value={totalHours} suffix="h" sub="in the current filter" />
          <Stat label="DOMAINS" value={DOMAINS.length} sub="across the catalog" />
          <Stat
            label="IN YOUR PATH"
            value={inPath.size}
            sub={hydrated && path ? "selected for you" : "no path yet"}
          />
        </div>
      </header>

      <div className="sticky top-14 z-30 -mx-4 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur-[2px] sm:-mx-5 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles, skills, providers…"
            className="min-w-[220px] flex-1 border border-rule bg-card px-2.5 py-1.5 text-[13.5px] outline-none focus:border-ink"
          />
          {active && (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setQ("");
                setKind(null);
                setLevel(null);
                setDomain(null);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        {/* One scrollable row on phones — wrapping every filter would push the
            catalog itself off screen under a sticky bar. */}
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-x-visible sm:pb-0">
          {KINDS.map((k) => (
            <span key={k} className="shrink-0">
              <Chip active={kind === k} onClick={() => setKind(kind === k ? null : k)}>
                {k}
              </Chip>
            </span>
          ))}
          <span className="mx-1 w-px shrink-0 bg-rule" />
          {LEVELS.map((l) => (
            <span key={l} className="shrink-0">
              <Chip active={level === l} onClick={() => setLevel(level === l ? null : l)}>
                {l}
              </Chip>
            </span>
          ))}
          <span className="mx-1 w-px shrink-0 bg-rule" />
          {DOMAINS.map((d) => (
            <span key={d} className="shrink-0">
              <Chip active={domain === d} onClick={() => setDomain(domain === d ? null : d)}>
                {d}
              </Chip>
            </span>
          ))}
        </div>
      </div>

      <section className="grid gap-3 py-6 sm:grid-cols-2 xl:grid-cols-3">
        {results.map((c) => {
          const selected = inPath.has(c.id);
          const expanded = open === c.id;
          return (
            <Panel
              key={c.id}
              as="div"
              className={`lift flex cursor-pointer flex-col p-4 ${selected ? "border-ink" : ""}`}
            >
              <button className="text-left" onClick={() => setOpen(expanded ? null : c.id)}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-ink-mute">
                    <KindGlyph kind={c.kind} size={15} />
                  </span>
                  <span className="t-meta">{c.id}</span>
                </div>
                <h2 className="mt-2 text-[14.5px] font-medium leading-snug">{c.title}</h2>
                <p className="t-meta mt-1">
                  {c.provider} · {c.level} · {c.hours}h
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-mute">{c.summary}</p>
              </button>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <KindTag kind={c.kind} />
                {selected && <Chip tone="moss">in your path</Chip>}
              </div>

              {expanded && (
                <div className="anim-fade mt-3 space-y-2 border-t border-rule pt-3">
                  <div>
                    <p className="t-meta">SKILLS</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.skills.map((s) => (
                        <Chip key={s}>{s}</Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="t-meta">PREREQUISITES</p>
                    <p className="mt-1 text-[12.5px] text-ink-soft">
                      {c.prereqs.length
                        ? c.prereqs.map((p) => COURSE_BY_ID.get(p)?.title ?? p).join(" → ")
                        : "None — you can start this cold."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => assistant.ask(`Should "${c.title}" be in my path? Be honest.`)}
                    >
                      Ask if I need it
                    </Button>
                    {c.url !== "#" && (
                      <a href={c.url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="quiet">
                          Open resource
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          );
        })}
      </section>

      {results.length === 0 && (
        <p className="py-16 text-center text-[13.5px] text-ink-mute">
          Nothing matches those filters. Clear them and try a broader term.
        </p>
      )}
    </div>
  );
}
