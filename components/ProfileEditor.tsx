"use client";

import { useEffect, useState } from "react";
import { Button, Chip, Field, inputCls, Panel, PanelHead } from "./ui";
import { LEVELS } from "@/lib/types";
import type { Profile } from "@/lib/types";

const toText = (v: string[]) => v.join(", ");
const toList = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function ProfileEditor({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  const [draft, setDraft] = useState<Profile>(profile);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(profile);
    setDirty(false);
  }, [profile]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setDirty(true);
  };

  return (
    <Panel>
      <PanelHead
        title="Tune the profile"
        sub="Everything here feeds the recommendation. Fix whatever was read wrong."
        meta={dirty ? "unsaved" : "saved"}
        action={
          <Button
            size="sm"
            variant={dirty ? "solid" : "outline"}
            disabled={!dirty}
            onClick={() => {
              onChange(draft);
              setDirty(false);
            }}
          >
            {dirty ? "Apply changes" : "Applied"}
          </Button>
        }
      />

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="GOAL">
            <textarea
              rows={2}
              className={`${inputCls} resize-y`}
              value={draft.goal}
              onChange={(e) => set("goal", e.target.value)}
            />
          </Field>
        </div>

        <Field label="TARGET ROLE">
          <input className={inputCls} value={draft.role} onChange={(e) => set("role", e.target.value)} />
        </Field>

        <div>
          <span className="font-mono text-[11px] text-ink-mute">CURRENT LEVEL</span>
          <div className="mt-1 flex gap-1.5">
            {LEVELS.map((l) => (
              <Chip key={l} active={draft.level === l} onClick={() => set("level", l)}>
                {l}
              </Chip>
            ))}
          </div>
        </div>

        <Field label="HOURS PER WEEK" hint={`${draft.weeklyHours * draft.targetWeeks} h total budget`}>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={40}
              value={draft.weeklyHours}
              onChange={(e) => set("weeklyHours", Number(e.target.value))}
              className="h-1 flex-1 appearance-none bg-rule accent-ink"
            />
            <span className="t-num w-10 text-right text-[17px]">{draft.weeklyHours}</span>
          </div>
        </Field>

        <Field label="TARGET WEEKS" hint={`about ${Math.round(draft.targetWeeks / 4.35)} month(s)`}>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={52}
              value={draft.targetWeeks}
              onChange={(e) => set("targetWeeks", Number(e.target.value))}
              className="h-1 flex-1 appearance-none bg-rule accent-ink"
            />
            <span className="t-num w-10 text-right text-[17px]">{draft.targetWeeks}</span>
          </div>
        </Field>

        <div className="sm:col-span-2">
          <Field label="INTERESTS" hint="comma separated">
            <input
              className={inputCls}
              value={toText(draft.interests)}
              onChange={(e) => set("interests", toList(e.target.value))}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="SKILLS YOU ALREADY HAVE" hint="these get skipped in the path">
            <input
              className={inputCls}
              value={toText(draft.knownSkills)}
              onChange={(e) => set("knownSkills", toList(e.target.value))}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="ALREADY COMPLETED">
            <input
              className={inputCls}
              value={toText(draft.completedCourses)}
              onChange={(e) => set("completedCourses", toList(e.target.value))}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="PREFERENCES" hint="e.g. project-first, video, short sessions">
            <input
              className={inputCls}
              value={toText(draft.preferences)}
              onChange={(e) => set("preferences", toList(e.target.value))}
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}
