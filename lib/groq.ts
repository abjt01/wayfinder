const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 45_000;

export const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export function hasKey() {
  return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 10);
}

export class GroqError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function call(body: Record<string, unknown>, stream = false) {
  if (!hasKey()) throw new GroqError("GROQ_API_KEY is not configured.", 503);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, ...body }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GroqError(`Groq API error (${res.status}): ${text.slice(0, 300)}`, res.status);
    }
    if (stream) {
      if (!res.body) throw new GroqError("Groq returned an empty stream.", 502);
      return res;
    }
    return res.json();
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
