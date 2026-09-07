import { NextResponse } from "next/server";
import { catalogLines, retrieveCourses } from "@/lib/catalog";
import { buildPath, pathIsUsable, pathDigest, type RawPath } from "@/lib/buildPath";
import { chatJSON } from "@/lib/groq";
import { guardRequest, tooManyBody, tooManyHeaders } from "@/lib/rateLimit";
import { localPath } from "@/lib/localEngine";
import { pathSystem, profileBlock } from "@/lib/prompts";
import { hasGoal, normalizeProfile } from "@/lib/profile";
import type { LearningPath, Profile } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const gate = guardRequest(req);
  if (gate.rejected) {
    return NextResponse.json(tooManyBody(gate.rejected), {
      status: 429,
      headers: tooManyHeaders(gate.rejected),
    });
  }

  let profile: Profile | undefined;
  let feedback = "";
  let currentPath: LearningPath | null = null;
  try {
    const body = (await req.json()) as {
      profile?: Profile;
      feedback?: string;
      currentPath?: LearningPath | null;
    };
    profile = body.profile;
    feedback = (body.feedback ?? "").slice(0, 1000);
    currentPath = body.currentPath ?? null;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (!hasGoal(profile)) {
    return NextResponse.json({ error: "A learner profile with a goal is required." }, { status: 400 });
  }
  // Anything past this point indexes into the profile's arrays, so coerce a
  // partial or stale one into a complete Profile rather than crashing on it.
  const learner = normalizeProfile(profile);

  const source: "groq" | "local" = "local";
  let raw: RawPath | null = null;

  if (gate.useGroq) {
    try {
      const candidates = retrieveCourses(
        `${learner.goal} ${learner.role} ${learner.interests.join(" ")} ${learner.knownSkills.join(" ")} ${feedback}`,
        { level: learner.level, interests: learner.interests, limit: 34 }
      );
      const adaptBlock =
        feedback && currentPath
          ? `\n\nThe learner already has this path:\n${pathDigest(currentPath)}\n\nTheir feedback: "${feedback}"\nRevise accordingly. Keep what still works, change what the feedback asks for, and name the change in the summary.`
          : "";

      raw = await chatJSON<RawPath>(
        [
          { role: "system", content: pathSystem() },
          {
            role: "user",
            content: `${profileBlock(learner)}\n\nCatalog (id | title | kind | provider | level | hours | skills | prereqs):\n${catalogLines(
              candidates
            )}${adaptBlock}`,
          },
        ],
        0.35
      );
      const candidate = buildPath(raw, learner);
      if (pathIsUsable(candidate)) {
        return NextResponse.json({ path: candidate, source: "groq" });
      }
      console.warn("[path] groq output had no valid catalog items, using local engine");
    } catch (err) {
      console.warn("[path] groq failed, using local engine:", (err as Error).message);
    }
  }

  raw = localPath(learner, feedback, currentPath);
  const path = buildPath(raw, learner);
  if (!pathIsUsable(path)) {
    return NextResponse.json(
      { error: "Could not build a path for that goal. Try describing it in terms of what you want to be able to do." },
      { status: 422 }
    );
  }
  return NextResponse.json(
    { path, source },
    gate.degraded ? { headers: { "X-Engine-Degraded": "rate-limit" } } : undefined
  );
}
