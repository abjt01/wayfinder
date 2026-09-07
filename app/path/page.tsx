"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ItemCard } from "@/components/ItemCard";
import { MilestoneSpine } from "@/components/MilestoneSpine";
import { PathMap } from "@/components/PathMap";
import { SkillRadar } from "@/components/SkillRadar";
import { useToast } from "@/components/Toast";
import { Button, Chip, Empty, Notice, Panel, PanelHead, Spinner, Stat } from "@/components/ui";
import { usePost } from "@/lib/hooks";
import { milestoneProgress, pathProgress, sumHours, weeksAt } from "@/lib/progress";
import { useHydrated, useStore } from "@/lib/store";
import type { LearningPath } from "@/lib/types";

const FEEDBACK_PRESETS = [
  "Too long — cut it to the essentials.",
  "More hands-on projects, fewer courses.",
  "I already know the basics, start harder.",
  "Add more depth on deployment and production.",
];

export default function PathPage() {
  const hydrated = useHydrated();
  const { profile, path, completed, setPath } = useStore();
  const { push } = useToast();
  const { post, loading, error } = usePost<{ path: LearningPath; source: string }>();
  const [feedback, setFeedback] = useState("");

  const stats = useMemo(() => {
    if (!path || !profile) return null;
    const progress = pathProgress(path, completed);
    // The whole plan's length, not what is left — the dashboard quotes the
    // other one, and they are meant to differ.
    const weeks = weeksAt(path.totalHours, profile.weeklyHours);
    return {
      ...progress,
      weeks,
      overrun: weeks > profile.targetWeeks,
      kinds: progress.items.reduce<Record<string, number>>((acc, i) => {
        acc[i.kind] = (acc[i.kind] ?? 0) + 1;
        return acc;
      }, {}),
    };
  }, [path, profile, completed]);

  async function adapt(text: string) {
    if (!profile || !path || !text.trim()) return;
    const data = await post("/api/path", { profile, feedback: text.trim(), currentPath: path });
    if (!data) return;
    setPath(data.path);
    setFeedback("");
    push(`Path rebuilt — ${data.path.milestones.length} milestones, ${data.path.totalHours}h`, "moss");
    window.scrollTo({ top: 0 });
  }

  function jumpTo(itemId: string) {
    const el = document.getElementById(`item-${itemId}`);
    el?.scrollIntoView({ block: "center" });
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 sm:px-5 py-20">
        <Spinner label="Loading your path" />
      </div>
    );
  }

  if (!path || !profile || !stats) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-5 py-20">
        <Empty
          title="No learning path yet"
          body="Describe your goal on the start page and Wayfinder will sequence one for you."
          action={
            <Link href="/">
              <Button>Describe my goal</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 sm:px-5 py-8">
      {/* ---------- header ---------- */}
      <header className="border-b border-rule pb-7">
        <p className="t-meta">YOUR PATH · {profile.role}</p>
        <h1 className="t-h1 mt-2 max-w-[24ch]">{path.title}</h1>
        <p className="mt-3 max-w-[76ch] text-[14px] leading-relaxed text-ink-soft">{path.summary}</p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="RESOURCES" value={stats.items.length} sub={`${stats.done.length} complete`} />
          <Stat label="TOTAL EFFORT" value={path.totalHours} suffix="h" sub={`${stats.remainingHours}h remaining`} />
          <Stat label="AT YOUR PACE" value={stats.weeks} suffix="wk" sub={`${profile.weeklyHours} h/week`} />
          <Stat label="MILESTONES" value={path.milestones.length} sub="each ends in an outcome" />
          <Stat label="COMPLETE" value={stats.pct} suffix="%" sub="tick items as you go" />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          {Object.entries(stats.kinds).map(([kind, n]) => (
            <Chip key={kind} tone={kind === "project" ? "rust" : kind === "assessment" ? "ochre" : "neutral"}>
              {n} {kind}
              {n > 1 ? "s" : ""}
            </Chip>
          ))}
          <Link href="/dashboard" className="link-ink ml-auto text-[13px] text-ink-mute">
            Track progress on the dashboard
          </Link>
        </div>

        {stats.overrun && (
          <div className="mt-5">
            <Notice>
              At {profile.weeklyHours} h/week this runs about {stats.weeks - profile.targetWeeks} week
              {stats.weeks - profile.targetWeeks > 1 ? "s" : ""} past your {profile.targetWeeks}-week target.
              <button className="link-ink ml-1" onClick={() => adapt("Too long — cut it to the essentials.")}>
                Trim it to fit
              </button>
              , or raise your weekly hours on the start page.
            </Notice>
          </div>
        )}
      </header>

      {/* ---------- journey map ---------- */}
      <section className="py-7">
        <Panel>
          <PanelHead
            title="The route"
            sub="Every resource in order. The solid line is how far you have actually got."
            meta={`${stats.done.length}/${stats.items.length}`}
          />
          <PathMap path={path} completed={completed} onSelect={jumpTo} />
        </Panel>
      </section>

      {/* ---------- body: spine + milestones ---------- */}
      <div className="grid gap-7 lg:grid-cols-[228px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-5">
            <div>
              <p className="t-meta pb-2">MILESTONES</p>
              <MilestoneSpine path={path} completed={completed} />
            </div>
            <div className="border-t border-rule pt-4">
              <p className="t-meta pb-2">SKILL COVERAGE</p>
              <ul className="space-y-1.5">
                {path.skillGaps.slice(0, 6).map((g) => (
                  <li key={g.skill} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] text-ink-mute">{g.skill}</span>
                    <span className="t-meta shrink-0">
                      {g.current}→{g.target}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-7">
          {path.skillGaps.length >= 3 && (
            <Panel>
              <PanelHead
                title="Skill gaps this path closes"
                sub="Solid shape is where you are now; the dashed outline is where this path takes you."
              />
              <div className="px-5 py-5">
                <SkillRadar axes={path.skillGaps} />
              </div>
            </Panel>
          )}

          {path.milestones.map((m, mi) => {
            // Running position across the whole path, derived rather than
            // accumulated in a variable mutated during render.
            const offset = path.milestones.slice(0, mi).reduce((s, p) => s + p.items.length, 0);
            const { done, state } = milestoneProgress(m, completed);
            const hours = sumHours(m.items);
            return (
              <Panel key={m.id} as="section" className="scroll-mt-20" >
                <div id={m.id} className="scroll-mt-20" />
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4">
                  <div className="min-w-0">
                    <p className="t-meta">
                      MILESTONE {String(mi + 1).padStart(2, "0")} · {m.weeks || "unscheduled"} · {hours}h
                    </p>
                    <h2 className="t-h2 mt-1">{m.title}</h2>
                    {m.outcome && (
                      <p className="mt-1.5 max-w-[68ch] text-[13.5px] text-ink-soft">
                        <span className="font-medium">You will be able to: </span>
                        {m.outcome}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="t-num text-[22px] leading-none">
                      {done}
                      <span className="text-[14px] text-ink-faint">/{m.items.length}</span>
                    </p>
                    <p className="t-meta mt-1">{state}</p>
                  </div>
                </div>
                <ul>
                  {m.items.map((item, ii) => (
                    <ItemCard key={item.id} item={item} index={offset + ii + 1} />
                  ))}
                </ul>
              </Panel>
            );
          })}

          {/* ---------- adapt ---------- */}
          <Panel>
            <PanelHead
              title="Adapt the path"
              sub="Say what is wrong with it. The whole path gets re-sequenced around your feedback."
            />
            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-1.5">
                {FEEDBACK_PRESETS.map((s) => (
                  <Chip key={s} onClick={() => setFeedback(s)} active={feedback === s}>
                    {s}
                  </Chip>
                ))}
              </div>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="e.g. drop the deep learning theory, I need something shippable in 6 weeks"
                className="thin-scroll mt-3 w-full resize-y border border-rule bg-paper p-3 text-[13.5px] outline-none focus:border-ink"
              />
              {error && (
                <div className="mt-3">
                  <Notice>{error}</Notice>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button onClick={() => adapt(feedback)} disabled={loading || !feedback.trim()}>
                  {loading ? "Rebuilding…" : "Adapt path"}
                </Button>
                <Link href="/dashboard">
                  <Button variant="outline">Go to dashboard</Button>
                </Link>
                {loading && <Spinner label="Re-sequencing prerequisites" />}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
