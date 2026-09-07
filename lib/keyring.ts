/**
 * Round-robin over several Groq API keys, with a cooldown on the ones that
 * just told us to go away.
 *
 * Groq's limits are per key, so one key is the bottleneck on a free tier: the
 * moment it returns 429 the whole app drops to the local engine until the
 * window resets. Spreading requests over several keys pushes that ceiling out,
 * and parking a key that has failed stops us spending latency re-asking it.
 *
 * Kept free of `fetch` and `process.env` so the rotation logic is exercised
 * directly by the verify suite, which has no real key to spend.
 */

/** How long a key sits out after Groq rate limits it, absent a Retry-After. */
export const RATE_LIMIT_COOLDOWN_MS = 60_000;

/** Longer, because a rejected key is usually wrong rather than busy. */
export const AUTH_COOLDOWN_MS = 15 * 60_000;

/** Ignore an absurd Retry-After rather than parking a key for a day. */
const MAX_COOLDOWN_MS = 60 * 60_000;

export type Penalty = "rate-limit" | "auth";

type Entry = { key: string; coldUntil: number };

export class KeyRing {
  private entries: Entry[];
  private cursor = 0;

  constructor(keys: readonly string[]) {
    this.entries = keys.map((key) => ({ key, coldUntil: 0 }));
  }

  /** How many keys are configured, cooling off or not. */
  get size(): number {
    return this.entries.length;
  }

  /** How many are usable right now. */
  available(now: number = Date.now()): number {
    return this.entries.filter((e) => e.coldUntil <= now).length;
  }

  /**
   * The next usable key, advancing the cursor so load spreads evenly rather
   * than hammering the first key until it dies. Null when all are cooling off.
   */
  next(now: number = Date.now()): string | null {
    const n = this.entries.length;
    for (let i = 0; i < n; i++) {
      const entry = this.entries[(this.cursor + i) % n];
      if (entry.coldUntil <= now) {
        this.cursor = (this.cursor + i + 1) % n;
        return entry.key;
      }
    }
    return null;
  }

  /**
   * Park a key that just failed. `retryAfterSeconds` is Groq's own header when
   * it sent one, which is a better guess than our default.
   */
  penalise(
    key: string,
    reason: Penalty,
    now: number = Date.now(),
    retryAfterSeconds?: number
  ): void {
    const entry = this.entries.find((e) => e.key === key);
    if (!entry) return;

    const fromHeader =
      typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : undefined;

    const base = reason === "auth" ? AUTH_COOLDOWN_MS : (fromHeader ?? RATE_LIMIT_COOLDOWN_MS);
    entry.coldUntil = now + Math.min(base, MAX_COOLDOWN_MS);
  }

  /** Seconds until at least one key frees up. 0 when one is usable now. */
  coolestIn(now: number = Date.now()): number {
    if (this.available(now) > 0) return 0;
    const soonest = Math.min(...this.entries.map((e) => e.coldUntil));
    return Math.max(1, Math.ceil((soonest - now) / 1000));
  }
}

/**
 * Reads keys out of one or more environment values. Accepts a comma-separated
 * list so several keys fit in a single variable, tolerates whitespace, drops
 * duplicates, and applies the same length sanity check the single-key build
 * always used.
 */
export function parseKeys(...sources: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const source of sources) {
    if (!source) continue;
    for (const raw of source.split(",")) {
      const key = raw.trim();
      if (key.length > 10 && !seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}
