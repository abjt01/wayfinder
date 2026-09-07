import { NextResponse } from "next/server";
import { streamText } from "@/lib/groq";
import { DEGRADED_HEADERS, guardRequest } from "@/lib/rateLimit";
import { localChat, textToStream } from "@/lib/localEngine";
import { ASSISTANT_SYSTEM, profileBlock } from "@/lib/prompts";
import { hasGoal, normalizeProfile } from "@/lib/profile";
import { pathDigest } from "@/lib/buildPath";
import type { ChatMessage, LearningPath, Profile } from "@/lib/types";

export const maxDuration = 60;

const STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

export async function POST(req: Request) {
  const gate = guardRequest(req);
  if (gate.rejected) return gate.rejected;

  let messages: ChatMessage[] = [];
  let profile: Profile | null = null;
  let path: LearningPath | null = null;
  let completed: string[] = [];
  try {
    const body = (await req.json()) as {
      messages?: ChatMessage[];
      profile?: Profile | null;
      path?: LearningPath | null;
      completed?: string[];
    };
    messages = Array.isArray(body.messages) ? body.messages : [];
    profile = body.profile ?? null;
    path = body.path ?? null;
    completed = Array.isArray(body.completed) ? body.completed : [];
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  // Null when no profile was captured yet; complete whenever one was.
  const learner = hasGoal(profile) ? normalizeProfile(profile) : null;

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !last.content.trim()) {
    return NextResponse.json({ error: "No question provided." }, { status: 400 });
  }

  if (gate.useGroq) {
    try {
      const context = [
        learner ? profileBlock(learner) : "No profile captured yet.",
        path ? `Current path: ${path.title}\n${pathDigest(path)}` : "No path generated yet.",
        completed.length
          ? `Item ids the learner marked complete: ${completed.join(", ")}`
          : "Nothing completed yet.",
      ].join("\n\n");

      const stream = await streamText([
        { role: "system", content: `${ASSISTANT_SYSTEM}\n\n---\n${context}` },
        ...messages.slice(-12).map((m) => ({
          role: m.role,
          content: m.content.slice(0, 2000),
        })),
      ]);
      return new Response(stream, { headers: { ...STREAM_HEADERS, "X-Engine": "groq" } });
    } catch (err) {
      console.warn("[chat] groq failed, using local engine:", (err as Error).message);
    }
  }

  const answer = localChat(last.content, learner, path, completed);
  return new Response(textToStream(answer), {
    headers: {
      ...STREAM_HEADERS,
      "X-Engine": "local",
      ...(gate.degraded ? DEGRADED_HEADERS : {}),
    },
  });
}
