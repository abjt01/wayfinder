# Wayfinder — project context

AI-powered personalized learning path recommender. Profile a learner from natural
language, find the skill gaps, generate a sequenced roadmap with prerequisites and
milestones, explain every recommendation, adapt on feedback, visualise progress.

> `AGENTS.md` is tracked and carries a block that `next dev` writes and re-adds.
> Read it before writing Next-specific code — Next 16 changed conventions.
> That generator only touches this file when `AGENTS.md` is missing or does not
> host the block, so it leaves this one alone. Do not add the marker block here.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 (`@theme`
tokens in `app/globals.css`, no `tailwind.config`) · zustand 5 + persist · **npm**
(the user asked for npm, not Bun — do not switch back) · `tsx` for the verify
script · ESLint 9 flat config.

LLM: Groq's OpenAI-compatible endpoint via raw `fetch` in `lib/groq.ts`. No SDK.
Runtime dependencies are `next`, `react`, `react-dom`, `zustand` and nothing else.

## Commands

```bash
npm run dev          # http://localhost:3000
npm run lint         # eslint . — 0 errors expected, warnings are documented
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm run verify       # 127 end-to-end assertions; needs a server on :3000 first
npm run verify:rotation  # key rotation; starts its own stub Groq and app
```

`npm run verify` drives the real HTTP API, so start `npm run dev` (or
`npm run start` after a build) in another shell first. `VERIFY_BASE` points it
elsewhere. Run it after any change to the catalog, an engine, or a route.

## The dual-engine design (most important thing to know)

Every AI feature has a deterministic counterpart in `lib/localEngine.ts`. Routes
try Groq first when a key exists and **fall through to the local engine** on a
missing key, an API error, a timeout, output with no valid catalog items, or a
spent rate-limit budget. Responses carry `source: "groq" | "local"`; the chat
stream carries `X-Engine`. This is why the app runs end to end with zero
configuration — do not "simplify" it away.

## Architecture

- `lib/catalog.ts` — 43-entry catalog (courses / projects / assessments /
  readings) plus `retrieveCourses()` keyword retrieval. The model only ever sees
  a retrieved slice, so it cannot invent resources.
- `lib/buildPath.ts` — validates engine output against the catalog: drops unknown
  ids, duplicates and completed items, recomputes hours from real catalog data.
- `lib/localEngine.ts` — rule-based profiling (background/goal text split,
  years-of-experience level detection), topological path build over real
  prerequisites, `isRedundant()` outgrown-course filter, `settleCheckpoints()`,
  coaching arithmetic, `textToStream()`.
- `lib/profile.ts` — `normalizeProfile()` / `hasGoal()`. **Every route coerces an
  incoming profile through this.** Profiles arrive from localStorage and may
  predate the current shape; the engines index straight into `knownSkills` and
  `completedCourses`, so a missing array used to be a 500.
- `lib/progress.ts` — every "how far through the path" derivation:
  `pathProgress`, `milestoneProgress`, `weeksAt`, `paceFor`. **Use these
  rather than flattening milestones by hand**; that arithmetic was previously
  copied into nine places and had already drifted apart.
- `lib/keyring.ts` — `KeyRing` + `parseKeys()`. Round-robin over several Groq
  keys with per-key cooldowns. Deliberately free of `fetch` and `process.env`
  so the rotation logic is testable without a real key.
- `lib/rateLimit.ts` — per-IP fixed-window limiter. See below.
- `lib/svg.ts` — `smoothPath()`, shared by the journey map and the landing
  trail so both curves are literally the same shape.
- `lib/groq.ts` — `chatText` / `chatJSON` / `streamText`, 45s AbortController
  timeout, `hasKey()`.
- `lib/hooks.ts` — `useReveal`, `useCountUp`, `useScrollSpy`, `useHotkeys`,
  `useScrollLock`, `usePost`, `useReducedMotion`.
- `lib/store.ts` — localStorage state (`wayfinder-v1`) plus `useHydrated()`.
- `lib/mdlite.tsx` — tiny inline formatter for streamed assistant prose.
- Routes: `/api/profile`, `/api/path` (generate and adapt), `/api/chat`
  (streaming), `/api/explain`, `/api/adapt`, `/api/health`.
- Pages: `/` goal interview, `/path` roadmap, `/dashboard` progress, `/explore`
  catalog browser.
- Components: `PathMap` (SVG journey graph), `SkillRadar`, `ProgressRing`,
  `CommandPalette` (⌘K), `AssistantHost` (drawer and context provider),
  `ItemCard`, `MilestoneSpine`, `Toast`, `Shell`, `ui.tsx` primitives,
  `KindGlyph`, `TrailArt`. `ui.tsx` also holds the shared page states
  (`PageLoading`, `PageEmpty`) and the `Bar` progress track.

## Key rotation

Groq's limits are per key, so `lib/groq.ts` retries a call across a ring of them.
Only **key-specific** statuses rotate — 429 parks a key for its `Retry-After` (or
60s), 401/403 for 15 minutes. **Timeouts and network faults deliberately do not
rotate**: re-running a 45s timeout against every key would turn a short outage
into a long one, so those fall straight through to the local engine as before.
When every key is cold the request degrades to the local engine, so a spent pool
is never an error the learner sees.

`/api/health` reports `keys: { configured, available }` — counts only, never key
material. Keep it that way.

## Rate limiting

Two per-IP ceilings in `lib/rateLimit.ts`, deliberately loose, guarding different
things. Call `guardRequest(req)` once at the top of any route that can spend
quota; `/api/health` is exempt so the container healthcheck never consumes
allowance.

| Ceiling | Limit | On exceeding |
| --- | --- | --- |
| Groq budget | 30/min | Falls through to the local engine, `X-Engine-Degraded: rate-limit`. Never an error. |
| Hard limit | 120/min | `429` with `Retry-After`. The only one that refuses. |

Counters are per process, so behind N replicas the effective ceiling is N times
these numbers. Put a shared store behind `hit()` if an exact global limit is ever
needed.

## Deployment

Three-stage `Dockerfile` (deps → builder → runner) on `node:22-alpine`, Next
standalone output, non-root user, `HEALTHCHECK` on `/api/health`.
`docker compose up --build` serves :3000.

**`output: "standalone"` is opt-in**, gated on `BUILD_STANDALONE=1`, which only
the Dockerfile's builder stage sets. Managed hosts package the app themselves and
the extra output breaks their build — that is why the deployed fork had deleted
the line outright. Keep it conditional so one config serves both targets.

`.github/workflows/ci.yml` runs on push and PR to `main`: a **check** job (install,
lint, typecheck, build, boot the server, run the suite) and a **docker** job
(build the image, run it, wait for the healthcheck, smoke test that it serves with
no API key). Nothing is published; deployment stays with the host's git
integration.

Env vars: `GROQ_API_KEY` and/or `GROQ_API_KEYS` (both optional, merged into one
pool), `GROQ_MODEL` (optional), `GROQ_API_URL` (optional endpoint override),
`BUILD_STANDALONE` (Docker only).

## Conventions

- **Design: editorial paper-and-ink.** Palette tokens `paper` / `card` / `ink*` /
  `rule*` / `rust` / `moss` / `ochre`. Serif display (`.t-hero` / `.t-h1` /
  `.t-h2`), mono meta (`.t-meta`), tabular figures (`.t-num`).
- **Banned** (global rule): gradient glows, glassmorphism, purple-on-dark, status
  pills with dots, all-caps letter-spaced eyebrows, coloured left-accent alert
  stripes, gradient text, emoji in UI, three-column icon-card grids.
- All charts are hand-rolled SVG. No chart library — keep it that way.
- Animations are gated behind `prefers-reduced-motion` in `globals.css`; new ones
  must follow.
- Anything added to `CATALOG` needs prerequisite ids that exist and skills drawn
  from the existing vocabulary, which is what the local engine's skill matcher is
  built from.
- Shared shapes live in `lib/types.ts`: `Level`/`LEVELS`/`LEVEL_RANK`,
  `SkillGap`, `Coaching`. Derive from them rather than restating them — the
  coach's shape had drifted into three separate declarations.
- Resource kinds are labelled through `KIND_LABEL` / `kindCount` in
  `KindGlyph.tsx`. Never render the raw `kind` enum: the reader sees
  "Checkpoint", not "assessment".

## Gotchas

- **`useHydrated()` must keep its `useStore.persist` undefined guard**, or the
  production build fails during prerender. Anything reading persisted state
  during render needs the same gate, or the first client paint disagrees with the
  prerendered HTML — that is why `Shell`'s progress bar and the catalog's in-path
  markers are gated.
- **`useReveal` is a callback ref, not an object ref.** The nodes it decorates are
  conditionally rendered, so an effect keyed on `[]` would attach nothing and
  `.reveal`'s `opacity: 0` would be permanent — content visible in the DOM but
  invisible on screen. It also reveals anything already in the viewport
  synchronously, with a timed failsafe behind that. Do not "simplify" it back into
  a `useRef` + `useEffect`.
- **`useHotkeys` ignores non-modifier combos while a text field has focus.** Keys
  that must work inside a dialog's own input need `allowInInput: true` — that is
  how Escape closes the palette and the assistant.
- `react-hooks/set-state-in-effect` is a lint **warning**, not an error. Every
  current instance is a real subscription to something outside React, and
  `useHydrated`'s is load-bearing. Look twice before adding a new one.
- Docker is not currently installed on this machine; the image is exercised in CI
  rather than locally.

## Known issues, not yet fixed

Found by inspecting real engine output. None are UI bugs; all live in retrieval
and the local path builder.

1. **Retrieval is far too permissive.** The score threshold in `retrieveCourses()`
   is met by level bonus alone, with zero keyword overlap, so nearly the whole
   catalog is returned. A beginner asking for devops gets a product-management
   book and a UX design project.
2. **Transitive prerequisites are not closed.** Closure runs one level deep, so a
   path can contain pandas without Python.
3. **Budgets are overrun for low-hour learners.** The minimum item count
   overrides the budget check, and the guaranteed project and assessment are
   appended without counting toward it. Six hours a week can yield a 172-hour path.
4. **Completed courses are not skipped.** Matching needs one title to contain the
   other, which free text rarely satisfies, and `buildPath` compares user text
   against catalog ids.
5. **Age and deadlines are read as experience.** "I'm 25 years old and a total
   beginner" profiles as advanced.

`npm run verify` stays green through all of these, because it only checks the
ordering of prerequisites already present in the path. Fixing 1 and 2 should come
with assertions for external prerequisite coverage and budget ratio.
