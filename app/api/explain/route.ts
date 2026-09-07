import { NextResponse } from "next/server";
import { COURSE_BY_ID } from "@/lib/catalog";
import { chatText } from "@/lib/groq";
import { degradedInit, guardRequest } from "@/lib/rateLimit";
import { localExplain } from "@/lib/localEngine";
import { profileBlock } from "@/lib/prompts";
import { hasGoal, normalizeProfile } from "@/lib/profile";
import { pathDigest } from "@/lib/buildPath";
import type { LearningPath, Profile } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const gate = guardRequest(req);
  if (gate.rejected) return gate.rejected;

  let courseId = "";
  let profile: Profile | undefined;
  let path: LearningPath | null = null;
  try {
    const body = (await req.json()) as {
      courseId?: string;
      profile?: Profile;
      path?: LearningPath | null;
    };
    courseId = body.courseId ?? "";
    profile = body.profile;
    path = body.path ?? null;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const course = COURSE_BY_ID.get(courseId);
  if (!course) return NextResponse.json({ error: "Unknown course id." }, { status: 400 });
  if (!hasGoal(profile)) {
    return NextResponse.json({ error: "A learner profile is required." }, { status: 400 });
  }
  const learner = normalizeProfile(profile);

  if (gate.useGroq) {
    try {
      const prereqs = course.prereqs.map((p) => COURSE_BY_ID.get(p)?.title || p);
      const text = await chatText(
        [
          {
            role: "system",
            content:
              "You explain a single recommendation inside a learning path. Answer in exactly three labelled lines:\n" +
              "Why now: <one sentence>\nWhat it unlocks: <one sentence>\nHow to know you're done: <one concrete, checkable signal>\n" +
              "Ground every line in this learner's stated goal, level and gaps. No preamble, no extra lines.",
          },
          {
            role: "user",
            content: `${profileBlock(learner)}\n\nRecommended item: ${course.title} (${course.kind}, ${course.level}, ${course.hours}h)\nSkills taught: ${course.skills.join(", ")}\nPrerequisites: ${prereqs.join(", ") || "none"}\nSummary: ${course.summary}\n\nTheir path:\n${path ? pathDigest(path) : "n/a"}`,
          },
        ],
        0.4
      );
      return NextResponse.json({ explanation: text.trim(), source: "groq" });
    } catch (err) {
      console.warn("[explain] groq failed, using local engine:", (err as Error).message);
    }
  }

  return NextResponse.json(
    { explanation: localExplain(course, learner, path), source: "local" },
    degradedInit(gate.degraded)
  );
}
