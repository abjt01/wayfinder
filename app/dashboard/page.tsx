"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { KindTag } from "@/components/KindGlyph";
import { HoursBar, ProgressRing } from "@/components/ProgressRing";
import { SkillRadar } from "@/components/SkillRadar";
import { useAssistant } from "@/components/AssistantHost";
import { Button, Chip, Empty, Meter, Notice, Panel, PanelHead, Spinner, Stat } from "@/components/ui";
import { usePost } from "@/lib/hooks";
import { useHydrated, useStore } from "@/lib/store";

type Coach = {
  status: string;
  observations: string[];
  nextActions: { title: string; detail: string; effort: string }[];
  pathChange: string;
  source?: string;
};

export default function DashboardPage() {
  const hydrated = useHydrated();
  const { profile, path, completed, toggleComplete } = useStore();
  const assistant = useAssistant();
  const { post, loading, error } = usePost<Coach>();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [note, setNote] = useState("");

  const stats = useMemo(() => {
    if (!path || !profile) return null;
    const items = path.milestones.flatMap((m) => m.items);
    const done = items.filter((i) => completed.includes(i.id));
    const hoursDone = done.reduce((s, i) => s + i.hours, 0);
    const remaining = items.filter((i) => !completed.includes(i.id));
    const remainingHours = remaining.reduce((s, i) => s + i.hours, 0);

    const skills = new Map<string, { total: number; done: number; hours: number; doneHours: number }>();
    for (const item of items) {
      for (const s of item.skills) {
        const e = skills.get(s) ?? { total: 0, done: 0, hours: 0, doneHours: 0 };
        e.total += 1;
        e.hours += item.hours;
        if (completed.includes(item.id)) {
          e.done += 1;
          e.doneHours += item.hours;
        }
        skills.set(s, e);
      }
    }
    const skillRows = [...skills.entries()]
      .map(([skill, v]) => ({
        skill,
        pct: Math.round((v.doneHours / Math.max(1, v.hours)) * 100),
        total: v.total,
        hours: v.hours,
        doneHours: v.doneHours,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);

    return {
      items,
      done,
      remaining,
      hoursDone,
      remainingHours,
      pct: items.length ? Math.round((done.length / items.length) * 100) : 0,
      weeksLeft: Math.ceil(remainingHours / Math.max(1, profile.weeklyHours)),
      neededPace: Math.ceil(remainingHours / Math.max(1, profile.targetWeeks)),
      skillRows,
      next: remaining[0] ?? null,
      upcoming: remaining.slice(0, 3),
      milestonesDone: path.milestones.filter((m) => m.items.every((i) => completed.includes(i.id))).length,
      radar: skillRows.slice(0, 7).map((s) => ({ skill: s.skill, current: s.pct, target: 100 })),
    };
  }, [path, profile, completed]);

  async function review() {
    if (!profile || !path) return;
    const data = await post("/api/adapt", { profile, path, completedIds: completed, feedback: note });
    if (data) setCoach(data);
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-20">
        <Spinner label="Loading your dashboard" />
      </div>
    );
  }

  if (!path || !profile || !stats) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20">
        <Empty
          title="Nothing to track yet"
          body="Generate a learning path and your progress, skill development and milestones show up here."
          action={
            <Link href="/">
              <Button>Describe my goal</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const behind = stats.weeksLeft > profile.targetWeeks;

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
        <div className="min-w-0">
          <p className="t-meta">PROGRESS · {profile.role}</p>
          <h1 className="t-h1 mt-2">{path.title}</h1>
          <p className="mt-2 max-w-[70ch] text-[13.5px] text-ink-mute">{profile.goal}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/path">
            <Button variant="outline">Open full path</Button>
          </Link>
          <Button onClick={() => assistant.ask("How am I doing, and what should I do this week?")}>
            Ask the assistant
          </Button>
        </div>
      </header>

      {/* ---------- top row ---------- */}
      <section className="grid gap-5 py-7 lg:grid-cols-[auto_1fr]">
        <Panel className="flex items-center justify-center px-8 py-6">
          <ProgressRing
            value={stats.pct}
            label="COMPLETE"
            sub={`${stats.done.length} of ${stats.items.length} resources`}
          />
        </Panel>

        <Panel className="px-5 py-5">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="HOURS LOGGED" value={stats.hoursDone} suffix="h" sub={`of ${path.totalHours}h planned`} />
            <Stat
              label="WEEKS REMAINING"
              value={stats.weeksLeft}
              sub={`at ${profile.weeklyHours} h/week`}
            />
            <Stat
              label="MILESTONES CLEARED"
              value={stats.milestonesDone}
              sub={`of ${path.milestones.length}`}
            />
            <Stat label="PACE NEEDED" value={stats.neededPace} suffix="h/wk" sub={`to hit ${profile.targetWeeks} weeks`} />
          </div>

          <div className="mt-6 border-t border-rule pt-4">
            <div className="flex items-baseline justify-between pb-2">
              <p className="t-meta">EFFORT COMPLETED</p>
              <p className="t-meta">
                {stats.hoursDone}h of {path.totalHours}h
              </p>
            </div>
            <Meter value={(stats.hoursDone / Math.max(1, path.totalHours)) * 100} segments={40} tone="ink" />
          </div>

          {behind && (
            <div className="mt-4">
              <Notice>
                You need about {stats.neededPace} h/week to finish inside {profile.targetWeeks} weeks — you
                budgeted {profile.weeklyHours}.{" "}
                <button className="link-ink" onClick={() => assistant.ask("I'm behind. What should I cut?")}>
                  Ask what to cut
                </button>
                .
              </Notice>
            </div>
          )}
        </Panel>
      </section>

      {/* ---------- middle ---------- */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHead title="Skill development" sub="Share of each skill's planned hours you have finished." />
          <div className="px-5 py-4">
            <ul className="space-y-3.5">
              {stats.skillRows.map((s) => (
                <li key={s.skill}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13.5px]">{s.skill}</span>
                    <span className="t-meta shrink-0">{s.pct}%</span>
                  </div>
                  <div className="mt-1.5">
                    <HoursBar done={s.doneHours} total={s.hours} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Coverage shape" sub="How evenly your progress is spread across the skills." />
          <div className="px-5 py-5">
            {stats.radar.length >= 3 ? (
              <SkillRadar axes={stats.radar} />
            ) : (
              <p className="text-[13px] text-ink-mute">Not enough distinct skills in this path to plot.</p>
            )}
          </div>
        </Panel>
      </section>

      {/* ---------- milestone timeline ---------- */}
      <section className="py-5">
        <Panel>
          <PanelHead title="Milestone timeline" meta={`${stats.milestonesDone}/${path.milestones.length} cleared`} />
          <ol className="divide-y divide-rule-soft">
            {path.milestones.map((m, i) => {
              const done = m.items.filter((it) => completed.includes(it.id)).length;
              const pct = Math.round((done / m.items.length) * 100);
              const state = pct === 100 ? "complete" : pct > 0 ? "in progress" : "not started";
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <span className="t-num w-8 shrink-0 text-[20px] text-ink-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-[180px] flex-1">
                    <span className="block text-[14px]">{m.title}</span>
                    <span className="t-meta">
                      {m.weeks} · {m.outcome.slice(0, 70)}
                      {m.outcome.length > 70 ? "…" : ""}
                    </span>
                  </span>
                  <span className="w-40 shrink-0">
                    <Meter value={pct} segments={16} tone={pct === 100 ? "moss" : "ink"} />
                  </span>
                  <span className="w-24 shrink-0 text-right">
                    <Chip tone={pct === 100 ? "moss" : pct > 0 ? "ochre" : "neutral"}>{state}</Chip>
                  </span>
                </li>
              );
            })}
          </ol>
        </Panel>
      </section>

      {/* ---------- next actions ---------- */}
      <section className="grid gap-5 pb-10 lg:grid-cols-[1fr_360px]">
        <Panel>
          <PanelHead
            title="Next recommended actions"
            sub="Generated from your real progress, pace and remaining prerequisites."
            action={
              <Button size="sm" variant={coach ? "outline" : "solid"} onClick={review} disabled={loading}>
                {loading ? "Reviewing…" : coach ? "Refresh" : "Review my progress"}
              </Button>
            }
          />
          <div className="px-5 py-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional — how is it going? e.g. 'the algorithms course is too dense, I keep stalling'"
              className="thin-scroll w-full resize-y border border-rule bg-paper p-3 text-[13.5px] outline-none focus:border-ink"
            />

            {error && (
              <div className="mt-3">
                <Notice>{error}</Notice>
              </div>
            )}

            {!coach && !loading && (
              <p className="mt-3 text-[13px] text-ink-mute">
                Hit review and Wayfinder reads your completion, pace and what is left, then tells you what to
                do this week.
              </p>
            )}

            {coach && (
              <div className="anim-rise mt-4 space-y-4">
                {coach.status && <p className="font-display text-[17px] leading-snug">{coach.status}</p>}

                {coach.observations.length > 0 && (
                  <ul className="space-y-1.5">
                    {coach.observations.map((o, i) => (
                      <li key={i} className="flex gap-2.5 text-[13.5px] text-ink-soft">
                        <span className="t-meta mt-[3px] shrink-0">{String(i + 1).padStart(2, "0")}</span>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {coach.nextActions.length > 0 && (
                  <ol className="space-y-2 border-t border-rule pt-4">
                    {coach.nextActions.map((a, i) => (
                      <li key={i} className="lift border border-rule bg-paper px-3.5 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[14px] font-medium">{a.title}</span>
                          {a.effort && <Chip tone="rust">{a.effort}</Chip>}
                        </div>
                        {a.detail && <p className="mt-1 text-[13px] text-ink-soft">{a.detail}</p>}
                      </li>
                    ))}
                  </ol>
                )}

                {coach.pathChange && (
                  <div className="border border-rule bg-paper px-3.5 py-3">
                    <p className="t-meta">SUGGESTED PATH CHANGE</p>
                    <p className="mt-1 text-[13.5px] text-ink-soft">{coach.pathChange}</p>
                    <Link href="/path" className="link-ink mt-2 inline-block text-[13px]">
                      Apply it under “Adapt the path”
                    </Link>
                  </div>
                )}

                {coach.source === "local" && (
                  <p className="t-meta">computed by the local engine — no API key configured</p>
                )}
              </div>
            )}
          </div>
        </Panel>

        <Panel className="self-start">
          <PanelHead title="Up next" sub="Tick items off here or on the path." />
          <ul className="divide-y divide-rule-soft">
            {stats.upcoming.length === 0 && (
              <li className="px-5 py-6 text-center text-[13px] text-ink-mute">
                Everything is complete. Generate a harder path from the start page.
              </li>
            )}
            {stats.upcoming.map((item) => (
              <li key={item.id} className="px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleComplete(item.id)}
                    aria-label={`Mark ${item.title} complete`}
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 border border-ink-faint bg-card transition-colors hover:border-ink"
                  />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium leading-snug">{item.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <KindTag kind={item.kind} />
                      <span className="t-meta">{item.hours}h</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] text-ink-mute">{item.why.slice(0, 120)}…</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </div>
  );
}
