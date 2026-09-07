import { KeyRing, parseKeys } from "./keyring";

const DEFAULT_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 45_000;

/**
 * Overridable so rotation can be exercised against a stub, and so the app can
 * sit behind an OpenAI-compatible proxy. Read per call rather than captured at
 * import, which keeps it settable from a test harness.
 */
function groqUrl() {
  return process.env.GROQ_API_URL || DEFAULT_GROQ_URL;
}

export const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

/** Statuses that say "this key, not this request" — worth trying another one. */
const KEY_SPECIFIC = new Set([401, 403, 429]);

/**
 * Built lazily and rebuilt only when the environment actually changes, so the
 * ring keeps its cursor and cooldowns across requests within a process.
 */
let cached: { source: string; ring: KeyRing } | null = null;

function keyRing(): KeyRing {
  const plural = process.env.GROQ_API_KEYS ?? "";
  const single = process.env.GROQ_API_KEY ?? "";
  const source = `${plural}|${single}`;
  if (!cached || cached.source !== source) {
    cached = { source, ring: new KeyRing(parseKeys(plural, single)) };
  }
  return cached.ring;
}

/** True when at least one key is configured, cooling off or not. */
export function hasKey() {
  return keyRing().size > 0;
}

/** How many keys are configured, and how many are usable right now. */
export function keyStatus() {
  const ring = keyRing();
  return { configured: ring.size, available: ring.available() };
}

export class GroqError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

/**
 * One Groq call, retried across the key ring.
 *
 * Only key-specific failures rotate. A timeout or a network fault is not the
 * key's fault, and re-running a 45s timeout against every key in turn would
 * make an outage far worse than the fallback it is trying to avoid — those
 * fail straight through to the local engine, exactly as before.
 */
async function call(body: Record<string, unknown>, stream = false) {
  const ring = keyRing();
  if (ring.size === 0) throw new GroqError("GROQ_API_KEY is not configured.", 503);

  let lastError: GroqError | null = null;

  for (let attempt = 0; attempt < ring.size; attempt++) {
    const key = ring.next();
    if (!key) break; // every key is cooling off

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(groqUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ model: MODEL, ...body }),
        signal: ctrl.signal,
      });

      if (res.ok) {
        if (stream) {
          if (!res.body) throw new GroqError("Groq returned an empty stream.", 502);
          return res;
        }
        return await res.json();
      }

      const text = await res.text().catch(() => "");
      const error = new GroqError(`Groq API error (${res.status}): ${text.slice(0, 300)}`, res.status);

      if (KEY_SPECIFIC.has(res.status)) {
        const retryAfter = Number(res.headers.get("retry-after"));
        ring.penalise(
          key,
          res.status === 429 ? "rate-limit" : "auth",
          Date.now(),
          Number.isFinite(retryAfter) ? retryAfter : undefined
        );
        lastError = error;
        continue; // next key
      }
      throw error;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new GroqError("Groq took longer than 45s to respond.", 504);
      }
      if (err instanceof GroqError) throw err;
      throw new GroqError(`Could not reach Groq: ${(err as Error).message}`, 502);
    } finally {
      clearTimeout(timer);
    }
  }

  // Either every key was already cold, or each one we tried turned us away.
  throw (
    lastError ??
    new GroqError(
      `Every Groq key is rate limited or rejected. Try again in ${ring.coolestIn()}s.`,
      429
    )
  );
}

export async function chatText(messages: Msg[], temperature = 0.5) {
  const data = await call({ messages, temperature, max_tokens: 1200 });
  const text = (data.choices?.[0]?.message?.content as string) ?? "";
  if (!text.trim()) throw new GroqError("Groq returned an empty response.", 502);
  return text;
}

/** Chat completion forced into a JSON object, with brace-extraction repair. */
export async function chatJSON<T>(messages: Msg[], temperature = 0.3): Promise<T> {
  const raw = await call({
    messages,
    temperature,
    max_tokens: 6000,
    response_format: { type: "json_object" },
  });
  const content = (raw.choices?.[0]?.message?.content as string) ?? "";
  try {
    return JSON.parse(content) as T;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new GroqError("The model returned malformed JSON.", 502);
  }
}

/** Groq SSE → plain text ReadableStream. */
export async function streamText(messages: Msg[], temperature = 0.6) {
  const res = (await call(
    { messages, temperature, stream: true, max_tokens: 1200 },
    true
  )) as Response;

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = res.body!.getReader();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        } catch {
          /* keepalive fragment */
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}
