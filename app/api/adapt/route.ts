import { NextResponse } from "next/server";
import { chatJSON } from "@/lib/groq";
import { guardRequest, tooManyBody, tooManyHeaders } from "@/lib/rateLimit";
import { localCoach } from "@/lib/localEngine";
import { profileBlock } from "@/lib/prompts";
import { hasGoal, normalizeProfile } from "@/lib/profile";
import { pathDigest } from "@/lib/buildPath";
import type { LearningPath, Profile } from "@/lib/types";

export const maxDuration = 60;

type Advice = {
  status?: string;
  observations?: string[];
  nextActions?: { title?: string; detail?: string; effort?: string }[];
  pathChange?: string;
};

export async function POST(req: Request) {
  const gate = guardRequest(req);
  if (gate.rejected) {
    return NextResponse.json(tooManyBody(gate.rejected), {
      status: 429,
      headers: tooManyHeaders(gate.rejected),
    });
  }

  let profile: Profile | undefined;
  let path: LearningPath | undefined;
  let completedIds: string[] = [];
  let feedback = "";
  try {
    const body = (await req.json()) as {
      profile?: Profile;
      path?: LearningPath;
      completedIds?: string[];
      feedback?: string;
    };
    profile = body.profile;
    path = body.path;
    completedIds = Array.isArray(body.completedIds) ? body.completedIds : [];
    feedback = (body.feedback ?? "").slice(0, 800);
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (!hasGoal(profile) || !path?.milestones?.length) {
    return NextResponse.json({ error: "A profile and a generated path are required." }, { status: 400 });
  }
  const learner = normalizeProfile(profile);

  if (gate.useGroq) {
    try {
      const done = new Set(completedIds);
      const remaining = path.milestones
        .flatMap((m) => m.items)
        .filter((i) => !done.has(i.id))
        .slice(0, 12)
        .map((i) => `${i.title} (${i.kind}, ${i.hours}h)`);

      const advice = await chatJSON<Advice>(
        [
          {
            role: "system",
            content:
              "You are Wayfinder's progress coach. Given a learner, their path and what they have completed, return ONLY JSON:\n" +
              '{"status":"one sentence on where they stand","observations":["2-4 short specific observations about pace, gaps or momentum"],' +
              '"nextActions":[{"title":"short action","detail":"one sentence on how to do it","effort":"e.g. 3h this week"}],' +
              '"pathChange":"one sentence recommending a path change, or empty string"}\nGive 2-3 nextActions. Use their real numbers.',
          },
          {
            role: "user",
            content: `${profileBlock(learner)}\n\nPath: ${path.title}\n${pathDigest(path)}\n\nCompleted item count: ${done.size} of ${path.milestones.flatMap((m) => m.items).length}\nRemaining: ${remaining.join("; ") || "nothing"}\nLearner feedback: ${feedback || "none given"}`,
          },
        ],
        0.4
      );

      return NextResponse.json({
        status: advice.status ?? "",
        observations: (advice.observations ?? []).filter((o) => typeof o === "string").slice(0, 4),
        nextActions: (advice.nextActions ?? [])
          .filter((a) => a && typeof a.title === "string")
          .slice(0, 3)
          .map((a) => ({ title: a.title!, detail: a.detail ?? "", effort: a.effort ?? "" })),
        pathChange: advice.pathChange ?? "",
        source: "groq",
      });
    } catch (err) {
      console.warn("[adapt] groq failed, using local engine:", (err as Error).message);
    }
  }

  return NextResponse.json(
    { ...localCoach(learner, path, completedIds), source: "local" },
    gate.degraded ? { headers: { "X-Engine-Degraded": "rate-limit" } } : undefined
  );
}
