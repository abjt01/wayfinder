# Wayfinder

An AI-powered personalized learning path recommender. You describe your goal in plain language; Wayfinder profiles you, finds your skill gaps, and sequences a roadmap of courses, projects and checkpoints — with prerequisites resolved, milestones that end in something you can show, and a reason attached to every single recommendation.

**It runs end to end with no API key.** Every AI feature has a deterministic rule-based counterpart, so the product is fully functional out of the box and upgrades to a Groq-hosted model the moment you add a key.

---

## Run it

### Local (npm)

```bash
npm install
npm run dev              # http://localhost:3000
```

That's it — no key, no database, no services. To use Groq instead of the local engine:

```bash
cp .env.example .env.local   # add your key from https://console.groq.com/keys
npm run dev
```

### Docker

```bash
docker compose up --build            # http://localhost:3000
```

Or without compose:

```bash
npm run docker:build
docker run --rm -p 3000:3000 wayfinder
```

Pass a key when you have one — the container works either way:

```bash
GROQ_API_KEY=gsk_... docker compose up --build
# or
docker run --rm -p 3000:3000 --env-file .env.local wayfinder
```

The image is a three-stage build (`deps` → `builder` → `runner`) on `node:22-alpine`, shipping only the Next.js standalone output, running as a non-root user, with a `HEALTHCHECK` against `/api/health`.

Standalone output is opt-in, via `BUILD_STANDALONE=1`, which the Dockerfile's builder stage sets. Managed hosts package the app themselves and the extra output trips their build, so every non-Docker build — local, CI, Vercel — gets the default output instead. One config serves both targets.

### Verify it works

```bash
npm run dev        # in one shell
npm run verify     # in another — 110 assertions over the real HTTP API
```

`npm run verify` walks three personas end to end (profile → path → explain → chat → coach → adapt) and asserts the invariants that actually matter: prerequisites ordered, no invented courses, no duplicates, budgets respected, streaming alive, malformed profiles coerced rather than crashing, rate limiting enforced without being tight enough to hit a real session, pages rendering. Point it anywhere with `VERIFY_BASE`.

```
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

### CI

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

- **check** — install, lint, typecheck, build, boot the production server, run the full end-to-end suite against it.
- **docker** — build the image, run it, wait for the healthcheck, and smoke test that it serves the app with no API key set.

Nothing is published. The image is built and exercised, not pushed; deployment stays with the host's git integration.

### Environment

| Var | Required | Default | Effect |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | no | — | Absent → deterministic local engine. Present → Groq. |
| `GROQ_MODEL` | no | `llama-3.3-70b-versatile` | Any Groq chat model. |
| `BUILD_STANDALONE` | no | — | `1` emits `.next/standalone` for the Docker image. Set by the Dockerfile; leave unset everywhere else. |

### Rate limiting

Two per-IP ceilings, in `lib/rateLimit.ts`, protecting different things:

- **30 Groq-backed requests a minute** guards the API key. Crossing it does not fail anything — the request falls through to the local engine, exactly as it does for a missing key or a Groq outage, and the response carries `X-Engine-Degraded: rate-limit`. One bucket covers all routes, so the ceiling is on what a caller costs in total rather than per endpoint.
- **120 requests a minute** guards the server and is the only one that returns `429`, with `Retry-After`. `/api/health` is exempt so the container healthcheck never consumes allowance.

Counters live in process memory, so behind N replicas the effective ceiling is N times these numbers. Put a shared store behind `hit()` if you ever need an exact global limit.

---

## What's in it

| Brief requirement | Where it lives |
| --- | --- |
| Conversational interface for goals in natural language | `app/page.tsx` → `POST /api/profile` |
| Learner profiling engine | `app/api/profile/route.ts`, editable via `components/ProfileEditor.tsx` |
| Recommendation engine | `lib/catalog.ts` — 43-resource catalog + keyword retrieval |
| Path generator with prerequisites and milestones | `app/api/path/route.ts` + `lib/buildPath.ts` + `lib/localEngine.ts` |
| AI assistant that explains recommendations and answers queries | `components/AssistantHost.tsx`, `/api/chat` (streaming), `/api/explain` |
| Adaptation from feedback and progress | `/api/path` with `feedback`, `/api/adapt` |
| Dashboard: progress, skills, milestones, next actions | `app/dashboard/page.tsx` |

### Pages

- **`/`** — the goal interview. Type in plain language, get a structured profile back, correct anything it read wrong, generate.
- **`/path`** — the roadmap: an interactive journey map, a skill-gap radar, milestone panels, per-item reasoning, and a feedback box that re-sequences the whole path.
- **`/dashboard`** — completion ring, hours logged, pace-vs-target, per-skill development, milestone timeline, and an AI progress review with concrete next actions.
- **`/explore`** — the whole catalog, filterable, showing exactly what the recommender can draw from and which entries landed in your path.

### Interaction

- **⌘K** command palette — navigate, jump to any milestone or resource, mark the next item complete, ask the assistant a canned question, reset.
- **A** or **⌘J** — assistant drawer, available on every page, keeps its transcript across navigation, streams token by token.
- Journey map nodes are hoverable, focusable and clickable (click scrolls to the resource).
- Scroll-spy milestone rail, reveal-on-scroll, count-up statistics, animated route drawing — all respecting `prefers-reduced-motion`.

---

## How a recommendation is made

1. **Profile.** Free text becomes a typed `Profile` (goal, role, level, interests, known skills, completed courses, weekly hours, target weeks, preferences). Server-side every field is clamped and validated; the learner can then edit all of it.
2. **Retrieve.** `retrieveCourses()` scores the catalog on token overlap with the goal and interests, nudges toward the learner's level, and pulls in the prerequisite closure of everything it picks. Only this slice is ever shown to the model.
3. **Sequence.** The slice is ordered into milestones with a per-item rationale, respecting prerequisites and the learner's time budget.
4. **Validate.** `buildPath()` discards any course id that isn't in the catalog, drops duplicates and anything already completed, and recomputes total hours from real catalog data. An unusable path is rejected rather than rendered.
5. **Adapt.** Feedback ("too long", "more projects", "start harder") is sent back with a digest of the current path, and the path is rebuilt around it.

### The two engines

`lib/groq.ts` (45s timeout, JSON mode, SSE streaming) is tried first when a key exists. On a missing key, an API error, a timeout, or output that contains no valid catalog items, the route falls through to `lib/localEngine.ts` and the request still succeeds — the response carries `source: "groq" | "local"` and the header `X-Engine` on the chat stream.

The local engine is not a stub:

- **Profiling** splits the text at the aspiration marker ("I want to…") and treats skills named in the *background* half as existing knowledge, so "3 years of Python, I want to be an ML engineer" correctly skips Python 101. Level comes from years-of-experience and self-description phrases; hours and target dates come from date/duration parsing.
- **Path building** is a topological sort over real catalog prerequisites, with greedy fill against the hour budget, guaranteed project and checkpoint coverage, and a pass that pushes assessments after the courses that teach their skills.
- **Coaching** is arithmetic over actual progress: pace needed vs. pace budgeted, hours remaining, stalled projects.

---

## Design

Editorial paper-and-ink rather than dashboard-generic: warm paper ground with a 1px graph-paper grid, a serif display face for headings, hairline rules, tabular figures, a single rust accent plus green for complete and ochre for in-progress. Charts are hand-rolled SVG — journey map, radar, arc gauge, segmented meters — no chart library. Deliberately avoided: gradient glows, glassmorphism, purple-on-dark, status pills, all-caps letter-spaced eyebrows, gradient text, emoji in UI.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · zustand (localStorage persistence) · Groq API via `fetch`, no SDK · zero runtime dependencies beyond those.

## Notes and limits

- State is per-browser `localStorage`. No database, no auth — swap `lib/store.ts` for a server store to make it multi-user.
- The catalog stands in for a real platform's course DB. Replace `CATALOG` in `lib/catalog.ts` (keeping prerequisite ids valid) and everything else keeps working.
- Catalog URLs point at real provider landing pages; project and assessment entries are Wayfinder-native and have no external link.
