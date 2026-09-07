/**
 * Small in-process rate limiter for the routes that can spend Groq quota.
 *
 * Two deliberately different ceilings, because they protect different things:
 *
 * - `budget` guards the API key. Crossing it does not fail the request — the
 *   route falls through to the deterministic local engine, exactly as it does
 *   for a missing key or a Groq outage. The learner still gets a path; the
 *   key just stops paying for it. Only counted when a key is actually set.
 * - `hard` guards the server itself and is the only one that returns 429.
 *
 * The limits are intentionally loose: a normal session is a handful of calls,
 * so nobody legitimately using the app should ever meet one.
 *
 * State is per-process. Behind several instances (or serverless) each replica
 * keeps its own counters, so the effective ceiling scales with replica count.
 * That is fine for the protection this is meant to give — put a shared store
 * behind it if you ever need an exact global limit.
 */

import { hasKey } from "./groq";

type Rule = { limit: number; windowMs: number };

/** Groq-backed work per IP before requests degrade to the local engine. */
const GROQ_BUDGET: Rule = { limit: 30, windowMs: 60_000 };

/** Total requests per IP before the server refuses outright. */
const HARD_LIMIT: Rule = { limit: 120, windowMs: 60_000 };

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

/** Cap on distinct keys held, so a flood of spoofed IPs cannot grow the map. */
const MAX_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(key);
  }
}

type Verdict = {
  ok: boolean;
  /** Requests left in the current window, after this one. */
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

/**
 * Counts one hit of `name` for `ip` against `rule`. Fixed window: simple,
 * allocation-free per request, and precise enough for a ceiling this loose.
 */
function hit(ip: string, name: string, rule: Rule): Verdict {
  const now = Date.now();
  const key = `${name}:${ip}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, remaining: rule.limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > rule.limit) {
    return { ok: false, remaining: 0, retryAfter };
  }
  return { ok: true, remaining: rule.limit - existing.count, retryAfter };
}

/**
 * Best-effort client address. Proxies are trusted only for the leftmost entry
 * of x-forwarded-for, which is what Vercel and most reverse proxies set. Falls
 * back to a single shared bucket, which is the safe direction to fail: it
 * throttles harder rather than handing out an unlimited allowance per request.
 */
function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** The 429 every route returns, built once so clients see one shape. */
function tooMany(v: Verdict): Response {
  return new Response(
    JSON.stringify({
      error: `Too many requests. Try again in ${v.retryAfter}s.`,
      retryAfter: v.retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(v.retryAfter),
        "X-RateLimit-Limit": String(HARD_LIMIT.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/**
 * One call at the top of every AI route:
 *
 *     const gate = guardRequest(req);
 *     if (gate.rejected) return gate.rejected;
 *
 * `rejected` is a ready-to-return 429. The response is built here rather than
 * in each route so the five call sites cannot drift apart.
 *
 * `useGroq` false means answer from the local engine: either no key is set, or
 * this caller has spent its share of the key for the minute. `degraded`
 * separates the second case from the first, so the route can say which it was.
 *
 * The Groq budget is one bucket per IP across all routes, not one per route, so
 * the ceiling is on what an IP costs in total rather than per endpoint.
 */
export function guardRequest(req: Request): {
  rejected: Response | null;
  useGroq: boolean;
  degraded: boolean;
} {
  const ip = clientIp(req);

  const hard = hit(ip, "all", HARD_LIMIT);
  if (!hard.ok) return { rejected: tooMany(hard), useGroq: false, degraded: false };

  if (!hasKey()) return { rejected: null, useGroq: false, degraded: false };

  const budget = hit(ip, "groq", GROQ_BUDGET);
  return { rejected: null, useGroq: budget.ok, degraded: !budget.ok };
}

/** Marks a local answer that Groq would have given had budget remained. */
export const DEGRADED_HEADERS = { "X-Engine-Degraded": "rate-limit" } as const;

/** Spread into a NextResponse.json init when the answer was degraded. */
export function degradedInit(degraded: boolean) {
  return degraded ? { headers: DEGRADED_HEADERS } : undefined;
}
