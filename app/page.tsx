"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProfileEditor } from "@/components/ProfileEditor";
import { TrailArt } from "@/components/TrailArt";
import { useToast } from "@/components/Toast";
import { Button, Chip, Notice, Panel, PanelHead, Spinner, Stat } from "@/components/ui";
import { usePost, useReveal } from "@/lib/hooks";
import { useHydrated, useStore } from "@/lib/store";
import type { LearningPath, Profile } from "@/lib/types";

const EXAMPLES = [
  {
    tag: "career switch",
    text: "I'm a backend developer with 3 years of Python. I want to become a machine learning engineer in about 6 months, around 10 hours a week. I've already done a statistics course.",
  },
  {
    tag: "from zero",
    text: "Total beginner — I work in marketing and want to analyse our own data with SQL and build dashboards myself. I can do 5 hours a week and I learn best from short sessions.",
  },
  {
    tag: "ship something",
    text: "I know React well but I've never shipped anything full-stack. I want to build and deploy my own SaaS in 3 months. I learn by building, not watching.",
  },
  {
    tag: "go deeper",
    text: "Senior engineer, 8 years. I want to move into AI engineering — RAG systems and agents in production. 12 hours a week, I already know Python and Docker well.",
  },
];

const STEPS = ["Describe", "Confirm", "Generate"] as const;

export default function StartPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { push } = useToast();
  const { profile, path, setProfile, setPath, reset } = useStore();

  const [input, setInput] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [answer, setAnswer] = useState("");
  const profileCall = usePost<{ profile: Profile; followUp: string; source: string }>();
  const pathCall = usePost<{ path: LearningPath; source: string }>();
  const confirmRef = useRef<HTMLDivElement>(null);
  const revealA = useReveal();
  const revealB = useReveal();

  const step = !profile ? 0 : 1;

  useEffect(() => {
    if (profile && confirmRef.current) {
      confirmRef.current.scrollIntoView({ block: "start" });
    }
  }, [profile]);

  async function analyse(text: string) {
    const message = text.trim();
    if (message.length < 10) return;
    const data = await profileCall.post("/api/profile", { message, previous: profile });
    if (!data) return;
    setProfile(data.profile);
    setFollowUp(data.followUp || "");
    setAnswer("");
    push(data.source === "local" ? "Profile read by the local engine" : "Profile read by Groq");
  }

  async function generate(p: Profile) {
    const data = await pathCall.post("/api/path", { profile: p });
    if (!data) return;
    setPath(data.path);
    push(`Path built — ${data.path.milestones.length} milestones, ${data.path.totalHours}h`, "moss");
    router.push("/path");
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-20">
        <Spinner label="Loading your workspace" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] px-5">
      {/* ---------- hero ---------- */}
      <section className="grid items-center gap-10 border-b border-rule py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div>
          <p className="t-meta">A learning path recommender</p>
          <h1 className="t-hero mt-3">
            Say what you want to
            <br />
            be able to do.
          </h1>
          <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
            Wayfinder reads your goal, works out what you already know, finds the gap, and sequences a
            path of courses, projects and checkpoints in the order that actually works — with a reason
            attached to every single one.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => document.getElementById("describe")?.scrollIntoView({ block: "center" })}
            >
              Start with my goal
            </Button>
            {path && (
              <Link href="/path">
                <Button variant="outline">Open saved path</Button>
              </Link>
            )}
            <Link href="/explore" className="link-ink text-[13.5px] text-ink-mute">
              or browse the catalog
            </Link>
          </div>
        </div>

        <div className="border border-rule bg-card p-6">
          <TrailArt />
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-rule pt-4">
            <Stat label="RESOURCES" value={43} sub="courses, projects, checks" />
            <Stat label="SEQUENCED BY" value="prereqs" animate={false} sub="not popularity" />
            <Stat label="EXPLAINED" value="every item" animate={false} sub="why, and why now" />
          </div>
        </div>
      </section>

      {/* ---------- stepper ---------- */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center border font-mono text-[10.5px] ${
                i <= step ? "border-ink bg-ink text-paper" : "border-rule text-ink-faint"
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-[13px] ${i <= step ? "text-ink" : "text-ink-faint"}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="ml-3 hidden h-px w-10 bg-rule sm:block" />}
          </div>
        ))}
      </div>

      {/* ---------- describe ---------- */}
      <section id="describe" className="scroll-mt-20 pb-10">
        <Panel>
          <PanelHead
            title="Describe your goal"
            sub="Plain language. Mention what you already know and how much time you have."
            meta={`${input.trim().length} chars`}
          />
          <div className="px-5 py-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void analyse(input);
              }}
              rows={5}
              placeholder="e.g. I'm a data analyst who knows SQL and some Python. I want to move into machine learning within 4 months, about 8 hours a week."
              className="thin-scroll w-full resize-y border border-rule bg-paper p-3.5 text-[14px] leading-relaxed outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
            />

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.tag}
                  onClick={() => setInput(ex.text)}
                  className="lift group border border-rule bg-paper p-3 text-left"
                >
                  <span className="t-meta">{ex.tag}</span>
                  <span className="mt-1 block text-[12.5px] leading-snug text-ink-mute group-hover:text-ink-soft">
                    {ex.text.slice(0, 108)}…
                  </span>
                </button>
              ))}
            </div>

            {profileCall.error && (
              <div className="mt-4">
                <Notice>{profileCall.error}</Notice>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => analyse(input)} disabled={profileCall.loading || input.trim().length < 10}>
                {profileCall.loading ? "Reading your goal…" : "Analyse my goal"}
              </Button>
              {profileCall.loading && <Spinner label="Extracting profile, level and time budget" />}
              <span className="t-meta ml-auto hidden sm:inline">⌘ + ↵ to submit</span>
            </div>
          </div>
        </Panel>
      </section>

      {/* ---------- confirm ---------- */}
      {profile && (
        <div ref={confirmRef} className="scroll-mt-20 space-y-5 pb-16">
          <section ref={revealA} className="reveal">
            <Panel>
              <PanelHead
                title="What I understood"
                sub="Read this back before generating — a wrong level changes the whole path."
                action={
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => {
                      reset();
                      setInput("");
                      setFollowUp("");
                      push("Cleared");
                    }}
                  >
                    Start over
                  </Button>
                }
              />
              <div className="px-5 py-4">
                <p className="font-display text-[19px] leading-snug">{profile.goal}</p>

                <div className="mt-4 grid gap-5 border-t border-rule pt-4 sm:grid-cols-4">
                  <Stat label="TARGET ROLE" value={profile.role} animate={false} />
                  <Stat label="LEVEL" value={profile.level} animate={false} />
                  <Stat label="HOURS / WEEK" value={profile.weeklyHours} />
                  <Stat label="TARGET" value={profile.targetWeeks} suffix="wk" />
                </div>

                {profile.interests.length > 0 && (
                  <div className="mt-4">
                    <p className="t-meta">INTERESTS</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {profile.interests.map((i) => (
                        <Chip key={i}>{i}</Chip>
                      ))}
                    </div>
                  </div>
                )}

                {profile.knownSkills.length > 0 && (
                  <div className="mt-3">
                    <p className="t-meta">ALREADY HAVE — THESE GET SKIPPED</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {profile.knownSkills.map((i) => (
                        <Chip key={i} tone="moss">
                          {i}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                {followUp && (
                  <div className="mt-5 border-t border-rule pt-4">
                    <p className="text-[13.5px]">
                      <span className="font-medium">One question — </span>
                      {followUp}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void analyse(`${input}\n\nAlso: ${answer}`);
                        }}
                        placeholder="Answer to sharpen the recommendation"
                        className="min-w-[240px] flex-1 border border-rule bg-paper px-2.5 py-1.5 text-[13.5px] outline-none focus:border-ink"
                      />
                      <Button
                        variant="outline"
                        onClick={() => analyse(`${input}\n\nAlso: ${answer}`)}
                        disabled={profileCall.loading || !answer.trim()}
                      >
                        Refine
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          </section>

          <section ref={revealB} className="reveal" style={{ ["--delay" as string]: "80ms" }}>
            <ProfileEditor profile={profile} onChange={(p) => { setProfile(p); push("Profile updated"); }} />
          </section>

          {pathCall.error && <Notice>{pathCall.error}</Notice>}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => generate(profile)} disabled={pathCall.loading}>
              {pathCall.loading ? "Building your path…" : "Generate learning path"}
            </Button>
            {path && (
              <Link href="/path">
                <Button variant="outline">Open current path</Button>
              </Link>
            )}
            {pathCall.loading && <Spinner label="Retrieving resources, ordering prerequisites, cutting to your time budget" />}
          </div>
        </div>
      )}
    </div>
  );
}
