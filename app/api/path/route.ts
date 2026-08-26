import { NextResponse } from "next/server";
import { catalogLines, retrieveCourses } from "@/lib/catalog";
import { buildPath, pathIsUsable, pathDigest, type RawPath } from "@/lib/buildPath";
import { chatJSON, hasKey } from "@/lib/groq";
import { localPath } from "@/lib/localEngine";
import { pathSystem, profileBlock } from "@/lib/prompts";
import type { LearningPath, Profile } from "@/lib/types";

export const maxDuration = 60;

function validProfile(p: unknown): p is Profile {
  const c = p as Profile | undefined;
  return Boolean(
    c &&
      typeof c.goal === "string" &&
      c.goal.trim().length > 3 &&
      typeof c.weeklyHours === "number" &&
      Array.isArray(c.interests)
  );
}

export async function POST(req: Request) {
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

  if (!validProfile(profile)) {
    return NextResponse.json({ error: "A learner profile with a goal is required." }, { status: 400 });
  }

  let source: "groq" | "local" = "local";
  let raw: RawPath | null = null;

  if (hasKey()) {
    try {
      const candidates = retrieveCourses(
        `${profile.goal} ${profile.role} ${profile.interests.join(" ")} ${profile.knownSkills.join(" ")} ${feedback}`,
        { level: profile.level, interests: profile.interests, limit: 34 }
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
            content: `${profileBlock(profile)}\n\nCatalog (id | title | kind | provider | level | hours | skills | prereqs):\n${catalogLines(
              candidates
            )}${adaptBlock}`,
          },
        ],
        0.35
      );
      const candidate = buildPath(raw, profile);
      if (pathIsUsable(candidate)) {
        return NextResponse.json({ path: candidate, source: "groq" });
      }
      console.warn("[path] groq output had no valid catalog items, using local engine");
    } catch (err) {
      console.warn("[path] groq failed, using local engine:", (err as Error).message);
    }
  }

  raw = localPath(profile, feedback, currentPath);
  const path = buildPath(raw, profile);
  if (!pathIsUsable(path)) {
    return NextResponse.json(
      { error: "Could not build a path for that goal. Try describing it in terms of what you want to be able to do." },
      { status: 422 }
    );
  }
  return NextResponse.json({ path, source });
}
