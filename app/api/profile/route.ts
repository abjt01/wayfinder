import { NextResponse } from "next/server";
import { chatJSON } from "@/lib/groq";
import { degradedInit, guardRequest } from "@/lib/rateLimit";
import { localProfile } from "@/lib/localEngine";
import { PROFILE_SYSTEM } from "@/lib/prompts";
import { normalizeProfile } from "@/lib/profile";
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
        knownSkills: Array.from(new Set([...(previous.knownSkills ?? []), ...local.knownSkills])).slice(0, 12),
        completedCourses: Array.from(
          new Set([...(previous.completedCourses ?? []), ...local.completedCourses])
        ).slice(0, 12),
        interests: Array.from(new Set([...(previous.interests ?? []), ...local.interests])).slice(0, 8),
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
