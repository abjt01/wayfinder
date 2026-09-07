/**
 * End-to-end check against a running server.
 *   npm run dev            (in one shell)
 *   npm run verify         (in another)
 *
 * Point it elsewhere with VERIFY_BASE, which is how CI runs it against a
 * production build.
 *
 * Walks the real user journey through the HTTP API and asserts the invariants
 * that matter: prerequisites ordered, no invented courses, budgets respected,
 * streaming works, adaptation changes the path.
 */
import { COURSE_BY_ID } from "../lib/catalog";
import { AUTH_COOLDOWN_MS, KeyRing, RATE_LIMIT_COOLDOWN_MS, parseKeys } from "../lib/keyring";
import type { LearningPath, Profile } from "../lib/types";

const BASE = process.env.VERIFY_BASE ?? "http://127.0.0.1:3000";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * Every request carries a caller address so the suite sits in its own
 * rate-limit bucket. Sections that need isolation call `bucket()` first, which
 * keeps the limiter from ever being the reason an unrelated assertion fails.
 *
 * The octet is randomised per run so two runs inside the same rate-limit
 * window do not inherit each other's counters.
 */
const RUN = Math.floor(Math.random() * 250) + 1;
const bucket = (n: number) => `10.${RUN}.${n}.1`;

let callerIp = bucket(0);

async function post<T>(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": callerIp, ...headers },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

const PERSONAS = [
  {
    name: "career switcher",
    message:
      "I'm a backend developer with 3 years of Python. I want to become a machine learning engineer in about 6 months, around 10 hours a week. I've already completed a statistics course.",
    expectLevel: "intermediate",
    expectHours: 10,
  },
  {
    name: "absolute beginner",
    message:
      "Total beginner. I work in marketing and want to analyse our own data with SQL and build dashboards myself. I can do 5 hours a week and I prefer short sessions.",
    expectLevel: "beginner",
    expectHours: 5,
  },
  {
    name: "senior going deeper",
    message:
      "Senior engineer with 8 years experience. I want to move into AI engineering — RAG systems and agents in production. 12 hours a week, I already know python and docker well.",
    expectLevel: "advanced",
    expectHours: 12,
  },
];

async function main() {
  console.log(`\nWayfinder end-to-end verification against ${BASE}\n`);

  /* ---- health ---- */
  console.log("health");
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  check("health responds", health.ok === true);
  check("engine is reported", health.engine === "groq" || health.engine === "local");
  check(
    "health reports key counts without leaking material",
    typeof health.keys?.configured === "number" &&
      typeof health.keys?.available === "number" &&
      !JSON.stringify(health).includes("gsk_")
  );
  console.log(`  ->   engine: ${health.engine} (${health.model}), catalog ${health.catalogSize}\n`);

  /* ---- validation / error handling ---- */
  callerIp = bucket(1);
  console.log("input validation");
  check("empty goal rejected", (await post("/api/profile", { message: "" })).status === 400);
  check("short goal rejected", (await post("/api/profile", { message: "hi" })).status === 400);
  check("path without profile rejected", (await post("/api/path", {})).status === 400);
  check("explain with bad course id rejected", (await post("/api/explain", { courseId: "nope-999", profile: { goal: "x" } })).status === 400);
  check("chat without message rejected", (await post("/api/chat", { messages: [] })).status === 400);
  check("adapt without path rejected", (await post("/api/adapt", { profile: { goal: "x" } })).status === 400);
  console.log("");

  /* ---- malformed profiles must degrade, not crash ----
     Profiles are replayed from localStorage, so an old or partial one has to
     be coerced rather than throwing a 500 inside the engine. */
  callerIp = bucket(2);
  console.log("malformed input");
  const partial = await post<{ explanation: string }>("/api/explain", {
    courseId: "py-101",
    profile: { goal: "I want to learn python" },
  });
  check("explain survives a profile missing its arrays", partial.status === 200, `got ${partial.status}`);

  const partialPath = await post<{ path: LearningPath }>("/api/path", {
    profile: { goal: "I want to become a data analyst", weeklyHours: 8, interests: [] },
  });
  check("path survives a profile missing its arrays", partialPath.status === 200, `got ${partialPath.status}`);

  const junk = await post<{ path: LearningPath }>("/api/path", {
    profile: {
      goal: "I want to become a data analyst",
      weeklyHours: "not a number",
      targetWeeks: null,
      interests: "not an array",
      knownSkills: null,
      completedCourses: 42,
      level: "wizard",
    },
  });
  check("path coerces wrong field types", junk.status === 200, `got ${junk.status}`);
  check(
    "coerced path is still valid",
    (junk.data.path?.milestones?.length ?? 0) > 0 &&
      junk.data.path.milestones.flatMap((m) => m.items).every((i) => i.courseId && COURSE_BY_ID.has(i.courseId))
  );
  console.log("");

  /* ---- Groq key rotation ----
     Pure logic, no network and no real key: the ring is driven directly with
     an injected clock so cooldowns can be tested without waiting a minute. */
  console.log("groq key rotation");
  const K = (n: number) => `gsk_test_key_${n}_${"x".repeat(12)}`;

  check("a comma separated list parses into keys", parseKeys(`${K(1)}, ${K(2)}`).length === 2);
  check("blanks and duplicates are dropped", parseKeys(`${K(1)},, ${K(1)} , short`).length === 1);
  check(
    "both env vars merge into one ring",
    parseKeys(`${K(1)},${K(2)}`, K(3)).length === 3
  );

  const ring = new KeyRing([K(1), K(2), K(3)]);
  check("ring reports its size", ring.size === 3);

  const t0 = 1_000_000;
  const firstPass = [ring.next(t0), ring.next(t0), ring.next(t0)];
  check("round-robins rather than reusing one key", new Set(firstPass).size === 3);
  check("wraps back to the first key", ring.next(t0) === firstPass[0]);

  ring.penalise(firstPass[0]!, "rate-limit", t0);
  check("a rate limited key is skipped", !new Set([ring.next(t0), ring.next(t0)]).has(firstPass[0]!));
  check("the other two stay available", ring.available(t0) === 2);

  check(
    "a rate limited key comes back after its cooldown",
    ring.available(t0 + RATE_LIMIT_COOLDOWN_MS + 1) === 3
  );

  const authRing = new KeyRing([K(9)]);
  authRing.penalise(K(9), "auth", t0);
  check("a rejected key sits out longer than a busy one", AUTH_COOLDOWN_MS > RATE_LIMIT_COOLDOWN_MS);
  check("a rejected key is unavailable", authRing.next(t0) === null);
  check(
    "a rejected key also recovers eventually",
    authRing.next(t0 + AUTH_COOLDOWN_MS + 1) === K(9)
  );

  const honoured = new KeyRing([K(4)]);
  honoured.penalise(K(4), "rate-limit", t0, 5); // Groq sent Retry-After: 5
  check("Groq's own Retry-After is honoured", honoured.next(t0 + 4_000) === null && honoured.next(t0 + 6_000) === K(4));

  const allCold = new KeyRing([K(5), K(6)]);
  allCold.penalise(K(5), "rate-limit", t0);
  allCold.penalise(K(6), "rate-limit", t0);
  check("null once every key is cooling off", allCold.next(t0) === null);
  check("and it says how long until one frees up", allCold.coolestIn(t0) > 0);

  check("an empty ring is simply unusable", new KeyRing([]).next(t0) === null);
  console.log("");

  /* ---- rate limiting ---- */
  console.log("rate limiting");
  const limitIp = { "x-forwarded-for": bucket(30) };
  const body = { courseId: "py-101", profile: { goal: "I want to learn python" } };
  let sawTooMany = 0;
  let firstBlockedAt = 0;
  for (let i = 1; i <= 130; i++) {
    const res = await post<{ retryAfter?: number }>("/api/explain", body, limitIp);
    if (res.status === 429) {
      sawTooMany++;
      if (!firstBlockedAt) firstBlockedAt = i;
    }
  }
  check("a flood is eventually refused", sawTooMany > 0);
  check("the limit is not tight enough to hit a normal session", firstBlockedAt > 100, `blocked at ${firstBlockedAt}`);
  check(
    "another caller is unaffected",
    (await post("/api/explain", body, { "x-forwarded-for": bucket(31) })).status === 200
  );
  check(
    "health is never rate limited",
    (await fetch(`${BASE}/api/health`, { headers: limitIp })).status === 200
  );
  console.log("");

  let lastProfile: Profile | null = null;
  let lastPath: LearningPath | null = null;

  let personaIndex = 0;
  for (const p of PERSONAS) {
    callerIp = bucket(10 + personaIndex++);
    console.log(`persona: ${p.name}`);

    /* ---- profile ---- */
    const prof = await post<{ profile: Profile; followUp: string; source: string }>("/api/profile", {
      message: p.message,
    });
    check("profile returns 200", prof.status === 200, `got ${prof.status}`);
    const profile = prof.data.profile;
    check("profile has a goal", Boolean(profile?.goal?.length));
    check(`level detected (${profile?.level})`, profile?.level === p.expectLevel, `expected ${p.expectLevel}`);
    check(`weekly hours detected (${profile?.weeklyHours})`, profile?.weeklyHours === p.expectHours, `expected ${p.expectHours}`);
    check("follow-up question present", Boolean(prof.data.followUp));

    /* ---- path ---- */
    const pathRes = await post<{ path: LearningPath; source: string }>("/api/path", { profile });
    check("path returns 200", pathRes.status === 200, `got ${pathRes.status}`);
    const path = pathRes.data.path;
    check("path has milestones", (path?.milestones?.length ?? 0) >= 2, `${path?.milestones?.length} milestones`);

    const items = path.milestones.flatMap((m) => m.items);
    check("path has 5+ items", items.length >= 5, `${items.length} items`);
    check("every item maps to a real catalog course", items.every((i) => i.courseId && COURSE_BY_ID.has(i.courseId)));
    check("no duplicate items", new Set(items.map((i) => i.courseId)).size === items.length);
    check("every item has a rationale", items.every((i) => i.why.trim().length > 20));
    check("includes at least one project", items.some((i) => i.kind === "project"));
    check("includes at least one assessment", items.some((i) => i.kind === "assessment"));
    check("hours recomputed from catalog", path.totalHours === items.reduce((s, i) => s + i.hours, 0));
    check("milestones have outcomes", path.milestones.every((m) => m.outcome.length > 10));
    check("skill gaps present", path.skillGaps.length >= 3, `${path.skillGaps.length} gaps`);
    check(
      "skill gap targets exceed current",
      path.skillGaps.every((g) => g.target >= g.current)
    );

    // prerequisite ordering: a course's in-path prereqs must appear earlier
    const order = new Map(items.map((i, idx) => [i.courseId!, idx]));
    const violations = items.filter((i) => {
      const course = COURSE_BY_ID.get(i.courseId!);
      return course?.prereqs.some((pr) => order.has(pr) && order.get(pr)! > order.get(i.courseId!)!);
    });
    check("prerequisites ordered correctly", violations.length === 0, violations.map((v) => v.title).join(", "));

    /* ---- explain ---- */
    const ex = await post<{ explanation: string }>("/api/explain", {
      courseId: items[0].courseId,
      profile,
      path,
    });
    check("explain returns 200", ex.status === 200);
    check("explanation has three labelled lines", (ex.data.explanation.match(/\n/g)?.length ?? 0) >= 2, ex.data.explanation.slice(0, 80));

    /* ---- chat (streaming) ---- */
    const chatRes = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Am I going to finish this in time?" }],
        profile,
        path,
        completed: [],
      }),
    });
    check("chat returns 200", chatRes.status === 200);
    const chatText = await chatRes.text();
    check("chat streamed non-empty text", chatText.trim().length > 40, `${chatText.length} chars`);

    /* ---- adapt / coaching ---- */
    const halfDone = items.slice(0, Math.ceil(items.length / 2)).map((i) => i.id);
    const coach = await post<{ status: string; observations: string[]; nextActions: unknown[] }>("/api/adapt", {
      profile,
      path,
      completedIds: halfDone,
      feedback: "I keep stalling on the long courses.",
    });
    check("adapt returns 200", coach.status === 200);
    check("coach gives a status", coach.data.status.length > 10);
    check("coach gives observations", coach.data.observations.length >= 1);
    check("coach gives next actions", coach.data.nextActions.length >= 1);

    /* ---- re-generation with feedback ---- */
    const trimmed = await post<{ path: LearningPath }>("/api/path", {
      profile,
      feedback: "Too long — cut it to the essentials.",
      currentPath: path,
    });
    check("adapted path returns 200", trimmed.status === 200);
    const trimmedItems = trimmed.data.path.milestones.flatMap((m) => m.items);
    check(
      "trimmed path is not longer than the original",
      trimmedItems.length <= items.length,
      `${trimmedItems.length} vs ${items.length}`
    );
    check("trimmed path still valid", trimmedItems.every((i) => i.courseId && COURSE_BY_ID.has(i.courseId)));

    lastProfile = profile;
    lastPath = path;
    console.log("");
  }

  /* ---- budget respect ---- */
  callerIp = bucket(20);
  console.log("time budget");
  const tight = await post<{ path: LearningPath }>("/api/path", {
    profile: {
      ...(lastProfile as Profile),
      weeklyHours: 3,
      targetWeeks: 6,
    },
  });
  check("tight-budget path builds", tight.status === 200);
  const tightHours = tight.data.path.totalHours;
  check("tight budget produces a smaller path", tightHours <= (lastPath?.totalHours ?? 0), `${tightHours}h`);
  console.log("");

  /* ---- pages render ---- */
  console.log("pages");
  for (const route of ["/", "/path", "/dashboard", "/explore", "/nope-404"]) {
    const res = await fetch(`${BASE}${route}`);
    const expected = route === "/nope-404" ? 404 : 200;
    check(`GET ${route} → ${expected}`, res.status === expected, `got ${res.status}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log(`\nfailures:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
    process.exit(1);
  }
  console.log("all green\n");
}

main().catch((e) => {
  console.error("\nverification crashed:", e);
  process.exit(1);
});
