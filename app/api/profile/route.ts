import { NextResponse } from "next/server";
import { chatJSON, hasKey } from "@/lib/groq";
import { localProfile } from "@/lib/localEngine";
import { PROFILE_SYSTEM } from "@/lib/prompts";
import type { Level, Profile } from "@/lib/types";

export const maxDuration = 60;

type Extracted = Profile & { followUp?: string };
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

function clampNumber(v: unknown, fallback: number, min: number, max: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(
    new Set(
      v
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((s) => s.trim().slice(0, 60))
    )
  ).slice(0, 12);
}

function normalize(raw: Partial<Extracted>, message: string): Profile {
  const level = LEVELS.includes(raw.level as Level) ? (raw.level as Level) : "beginner";
  return {
    goal: typeof raw.goal === "string" && raw.goal.trim() ? raw.goal.trim().slice(0, 240) : message.slice(0, 240),
    role: typeof raw.role === "string" && raw.role.trim() ? raw.role.trim().slice(0, 60) : "Self-directed learner",
    level,
    interests: strArray(raw.interests),
    knownSkills: strArray(raw.knownSkills),
    completedCourses: strArray(raw.completedCourses),
    weeklyHours: clampNumber(raw.weeklyHours, 8, 1, 60),
    targetWeeks: clampNumber(raw.targetWeeks, 12, 1, 104),
    preferences: strArray(raw.preferences),
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 400) : "",
  };
}

export async function POST(req: Request) {
  let message = "";
  let previous: Partial<Profile> | null = null;
  try {
    const body = (await req.json()) as { message?: string; previous?: Partial<Profile> | null };
    message = (body.message ?? "").trim();
    previous = body.previous ?? null;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (message.length < 8) {
    return NextResponse.json(
      { error: "Tell me a bit more — a sentence or two about what you want to be able to do." },
      { status: 400 }
    );
  }
  if (message.length > 4000) message = message.slice(0, 4000);

  if (hasKey()) {
    try {
      const context = previous
        ? `\n\nExisting profile to update (keep what still applies):\n${JSON.stringify(previous)}`
        : "";
      const raw = await chatJSON<Partial<Extracted>>([
        { role: "system", content: PROFILE_SYSTEM },
        { role: "user", content: `Learner said:\n"""${message}"""${context}` },
      ]);
      return NextResponse.json({
        profile: normalize(raw, message),
        followUp: typeof raw.followUp === "string" ? raw.followUp.slice(0, 240) : "",
        source: "groq",
      });
    } catch (err) {
      // fall through to the local engine rather than failing the request
      console.warn("[profile] groq failed, using local engine:", (err as Error).message);
    }
  }

  const local = localProfile(message);
  const merged: Profile = previous
    ? {
        ...local,
        knownSkills: Array.from(new Set([...(previous.knownSkills ?? []), ...local.knownSkills])).slice(0, 12),
        completedCourses: Array.from(
          new Set([...(previous.completedCourses ?? []), ...local.completedCourses])
        ).slice(0, 12),
        interests: Array.from(new Set([...(previous.interests ?? []), ...local.interests])).slice(0, 8),
      }
    : local;

  return NextResponse.json({
    profile: normalize(merged, message),
    followUp: local.followUp,
    source: "local",
  });
}
