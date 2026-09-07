import { NextResponse } from "next/server";
import { chatJSON } from "@/lib/groq";
import { degradedInit, guardRequest } from "@/lib/rateLimit";
import { localProfile } from "@/lib/localEngine";
import { PROFILE_SYSTEM } from "@/lib/prompts";
import { normalizeProfile, strArray } from "@/lib/profile";
import type { Profile } from "@/lib/types";

export const maxDuration = 60;

type Extracted = Profile & { followUp?: string };

export async function POST(req: Request) {
  const gate = guardRequest(req);
  if (gate.rejected) return gate.rejected;

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

  if (gate.useGroq) {
    try {
      const context = previous
        ? `\n\nExisting profile to update (keep what still applies):\n${JSON.stringify(previous)}`
        : "";
      const raw = await chatJSON<Partial<Extracted>>([
        { role: "system", content: PROFILE_SYSTEM },
        { role: "user", content: `Learner said:\n"""${message}"""${context}` },
      ]);
      return NextResponse.json({
        profile: normalizeProfile(raw, message),
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
        // strArray dedupes, trims and caps — the same job these three did by
        // hand, in three slightly different ways.
        knownSkills: strArray([...(previous.knownSkills ?? []), ...local.knownSkills]),
        completedCourses: strArray([...(previous.completedCourses ?? []), ...local.completedCourses]),
        interests: strArray([...(previous.interests ?? []), ...local.interests], 8),
      }
    : local;

  return NextResponse.json(
    {
      profile: normalizeProfile(merged, message),
      followUp: local.followUp,
      source: "local",
    },
    // Says the answer is local because the key budget is spent, not missing.
    degradedInit(gate.degraded)
  );
}
