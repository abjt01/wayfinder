/**
 * Integration check for Groq key rotation.
 *
 *   npm run build
 *   npm run verify:rotation
 *
 * The unit assertions in `verify.ts` drive the KeyRing directly. This drives
 * the whole HTTP path instead, because the part that actually breaks in
 * production is the retry loop in `lib/groq.ts`, not the ring.
 *
 * It stands up a stub that impersonates Groq, boots the app against it with
 * two fake keys, and asserts the three behaviours that matter: rotate past a
 * rate-limited key, skip that key while it is cooling off, and fall back to
 * the local engine once every key is spent. No real key, no real network.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";

const STUB_PORT = 4010;
const APP_PORT = 3100;
const APP = `http://127.0.0.1:${APP_PORT}`;

const KEY_A = "gsk_rotation_key_AAA_padding";
const KEY_B = "gsk_rotation_key_BBB_padding";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ------------------------------------------------------------------ */
/* the stub Groq                                                       */
/* ------------------------------------------------------------------ */

/** Keys the stub has been asked for, in order. */
let seen: string[] = [];
/** Keys the stub should currently rate limit. */
let rateLimited = new Set<string>([KEY_A]);

const completion = (content: string) =>
  JSON.stringify({ choices: [{ message: { content } }] });

const PROFILE_ANSWER = JSON.stringify({
  goal: "answered by the stub",
  role: "Machine learning engineer",
  level: "intermediate",
  interests: ["machine learning"],
  knownSkills: ["python"],
  completedCourses: [],
  weeklyHours: 10,
  targetWeeks: 26,
  preferences: [],
  notes: "",
  followUp: "stub follow-up",
});

function startStub(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const key = (req.headers.authorization ?? "").replace("Bearer ", "").trim();
        seen.push(key);
        if (rateLimited.has(key)) {
          res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "30" });
          res.end(JSON.stringify({ error: { message: "rate limit reached" } }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(completion(PROFILE_ANSWER));
      });
    });
    server.listen(STUB_PORT, () => resolve(server));
  });
}

/* ------------------------------------------------------------------ */
/* the app, pointed at the stub                                        */
/* ------------------------------------------------------------------ */

function startApp(): ChildProcess {
  return spawn("npx", ["next", "start", "--port", String(APP_PORT)], {
    env: {
      ...process.env,
      GROQ_API_URL: `http://127.0.0.1:${STUB_PORT}`,
      GROQ_API_KEYS: `${KEY_A},${KEY_B}`,
      GROQ_API_KEY: "",
    },
    stdio: "ignore",
  });
}

async function waitForApp(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${APP}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`app did not start on ${APP} in ${timeoutMs}ms`);
}

const profile = (message: string) =>
  fetch(`${APP}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }).then((r) => r.json() as Promise<{ source: string; profile: { goal: string } }>);

const health = () =>
  fetch(`${APP}/api/health`).then(
    (r) => r.json() as Promise<{ keys: { configured: number; available: number } }>
  );

/* ------------------------------------------------------------------ */

async function main() {
  console.log("\nGroq key rotation, over the real HTTP path\n");

  const stub = await startStub();
  const app = startApp();

  try {
    await waitForApp();

    check("both keys are registered", (await health()).keys.configured === 2);
    check("both start usable", (await health()).keys.available === 2);

    /* ---- rotate past a rate-limited key ---- */
    seen = [];
    const first = await profile("I want to become a machine learning engineer, 10 hours a week");
    check("the request still succeeds", first.source === "groq", `source ${first.source}`);
    check("the answer came from the model, not the fallback", first.profile.goal === "answered by the stub");
    check("the rate-limited key was tried first", seen[0] === KEY_A, seen.join(", "));
    check("then it rotated to the second key", seen[1] === KEY_B, seen.join(", "));
    check("and stopped there", seen.length === 2, `${seen.length} attempts`);
    check("the failed key is now cooling off", (await health()).keys.available === 1);

    /* ---- skip the cold key entirely ---- */
    seen = [];
    const second = await profile("I want to become a data analyst, 6 hours a week");
    check("a later request also succeeds", second.source === "groq");
    check("the cold key is not retried", !seen.includes(KEY_A), seen.join(", "));
    check("it goes straight to the good key", seen.length === 1 && seen[0] === KEY_B, seen.join(", "));

    /* ---- every key spent ---- */
    rateLimited = new Set([KEY_A, KEY_B]);
    seen = [];
    const third = await profile("I want to become a platform engineer, 8 hours a week");
    check("with every key spent it falls back to the local engine", third.source === "local");
    check("the learner still gets an answer", third.profile.goal.length > 0);
    check("no key is left usable", (await health()).keys.available === 0);

    /* ---- and nothing leaks ---- */
    const raw = JSON.stringify(await health());
    check("health never echoes key material", !raw.includes("gsk_"));
  } finally {
    app.kill();
    stub.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
  console.log("rotation verified\n");
}

main().catch((e) => {
  console.error("\nrotation check crashed:", e);
  process.exit(1);
});
