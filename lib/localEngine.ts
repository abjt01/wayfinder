/**
 * Deterministic, dependency-free fallback engine.
 *
 * Every AI feature has a rule-based counterpart here so the product runs
 * end to end with no API key and stays usable if Groq is unreachable. It is
 * genuinely useful rather than a stub: profiling is regex/keyword extraction,
 * path building is a real topological sort over catalog prerequisites, and the
 * coach is arithmetic over actual progress.
 */
import { CATALOG, COURSE_BY_ID, retrieveCourses } from "./catalog";
import type { RawPath } from "./buildPath";
import { pathItems, pathProgress, paceFor, weeksAt } from "./progress";
import type { Course, LearningPath, Level, Profile } from "./types";

/* ------------------------------------------------------------------ */
/* profiling                                                           */
/* ------------------------------------------------------------------ */

const ROLE_HINTS: { match: RegExp; role: string; interests: string[] }[] = [
  { match: /\b(ml|machine learning) engineer|\bmlops\b/i, role: "Machine learning engineer", interests: ["machine learning", "python", "mlops"] },
  { match: /\bdata scientist|data science\b/i, role: "Data scientist", interests: ["machine learning", "statistics", "python"] },
  { match: /\bdata analyst|analytics\b|\bdashboard/i, role: "Data analyst", interests: ["sql", "visualization", "analytics"] },
  { match: /\bdata engineer|\bwarehouse\b|\bdbt\b|\betl\b/i, role: "Data engineer", interests: ["sql", "data modelling", "warehouse"] },
  { match: /\bai engineer|\bllm\b|\brag\b|\bgenai\b|\bagents?\b/i, role: "AI engineer", interests: ["llm", "rag", "prompt engineering"] },
  { match: /\bfront.?end\b|\breact\b/i, role: "Frontend engineer", interests: ["react", "typescript", "css"] },
  { match: /\bfull.?stack\b|\bsaas\b|\bship (my|a) (own )?(product|app)/i, role: "Full-stack engineer", interests: ["next.js", "api design", "database design"] },
  { match: /\bback.?end\b|\bapi\b/i, role: "Backend engineer", interests: ["api design", "database design", "system design"] },
  { match: /\bdevops\b|\bsre\b|\bkubernetes|\bdocker\b|\bcloud\b/i, role: "Platform engineer", interests: ["docker", "cloud", "ci/cd"] },
  { match: /\bproduct manager|\bpm\b|\bproduct management/i, role: "Product manager", interests: ["product management", "analytics", "user research"] },
  { match: /\b(ux|ui)\b|\bdesigner?\b|\bfigma\b/i, role: "Product designer", interests: ["ux research", "ui design", "design systems"] },
  { match: /\bsecurity\b|\bappsec\b|\bowasp\b/i, role: "Security engineer", interests: ["security", "api design"] },
  { match: /\barchitect\b|\bsystem design\b|\bscal(e|ability)\b/i, role: "Software architect", interests: ["system design", "scalability", "databases"] },
];

const SKILL_VOCAB = Array.from(new Set(CATALOG.flatMap((c) => c.skills))).sort(
  (a, b) => b.length - a.length
);

const PREFERENCE_HINTS: { match: RegExp; label: string }[] = [
  { match: /\bproject|hands.?on|build|ship|portfolio\b/i, label: "project-first" },
  { match: /\bvideo|watch|lecture\b/i, label: "video" },
  { match: /\bread|book|article|docs?\b/i, label: "reading" },
  { match: /\bshort|bite|commute|evening|busy\b/i, label: "short sessions" },
  { match: /\btheory|fundamental|first principles|deep\b/i, label: "theory-first" },
  { match: /\binterview|job|hire|portfolio\b/i, label: "interview-focused" },
];

function detectLevel(text: string): Level {
  const t = text.toLowerCase();
  const years = /(\d+)\s*(?:\+)?\s*(?:years?|yrs?)/.exec(t);
  if (years) {
    const n = Number(years[1]);
    if (n >= 5) return "advanced";
    if (n >= 2) return "intermediate";
  }
  if (/\b(advanced|senior|expert|lead|staff|years of experience)\b/.test(t)) return "advanced";
  if (/\b(some experience|intermediate|comfortable|familiar|i know|i've built|i have built|proficient)\b/.test(t))
    return "intermediate";
  if (/\b(beginner|new to|never|no experience|from scratch|total(ly)? new|zero)\b/.test(t)) return "beginner";
  return "beginner";
}

function detectWeeklyHours(text: string): number {
  const m =
    /(\d+)\s*(?:-|to|–)?\s*(\d+)?\s*(?:hours?|hrs?|h)\b[^.]{0,20}?(?:a|per|each|\/)\s*week/i.exec(text) ||
    /(?:about|around|roughly)?\s*(\d+)\s*(?:hours?|hrs?|h)\s*(?:a|per|each|\/)\s*week/i.exec(text);
  if (m) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : NaN;
    const v = Number.isFinite(b) ? Math.round((a + b) / 2) : a;
    if (v > 0) return Math.min(60, v);
  }
  const daily = /(\d+)\s*(?:hours?|hrs?|h)\s*(?:a|per|each)\s*day/i.exec(text);
  if (daily) return Math.min(60, Number(daily[1]) * 5);
  if (/\b(full.?time|intensive|bootcamp)\b/i.test(text)) return 30;
  if (/\b(weekend|evenings?)\b/i.test(text)) return 6;
  return 8;
}

function detectTargetWeeks(text: string): number {
  const months = /(\d+)\s*months?/i.exec(text);
  if (months) return Math.min(104, Math.max(2, Math.round(Number(months[1]) * 4.35)));
  const weeks = /(\d+)\s*weeks?/i.exec(text);
  if (weeks) return Math.min(104, Math.max(1, Number(weeks[1])));
  const years = /(\d+)\s*years?\s*(?:to|from now|plan)/i.exec(text);
  if (years) return Math.min(104, Number(years[1]) * 52);
  if (/\basap|quickly|fast|urgent\b/i.test(text)) return 8;
  return 12;
}

function extractSegment(text: string, starters: RegExp): string {
  const m = starters.exec(text);
  if (!m) return "";
  const rest = text.slice(m.index + m[0].length);
  return rest.split(/[.;!?\n]/)[0] ?? "";
}

function matchSkills(segment: string): string[] {
  if (!segment.trim()) return [];
  const t = segment.toLowerCase();
  return SKILL_VOCAB.filter((s) => t.includes(s.toLowerCase())).slice(0, 8);
}

export function localProfile(message: string): Profile & { followUp: string } {
  const text = message.trim();
  const level = detectLevel(text);

  const roleHit = ROLE_HINTS.find((r) => r.match.test(text));
  const role = roleHit?.role ?? "Self-directed learner";

  const mentioned = matchSkills(text);
  const domainInterests = Array.from(
    new Set([...(roleHit?.interests ?? []), ...mentioned])
  ).slice(0, 6);

  // Everything before the learner states an aspiration describes what they
  // already are; everything after describes what they want. Skills named in
  // the "background" half count as existing knowledge.
  const goalMarker =
    /\b(?:i want to|i'd like to|i would like to|my goal is|i'm aiming|i am aiming|planning to|aiming to|hoping to|need to learn|want to become|move into|switch to|transition to)\b/i.exec(
      text
    );
  const background = goalMarker ? text.slice(0, goalMarker.index) : "";

  const knownSegment = [
    background,
    extractSegment(
      text,
      /\b(?:i know|i already know|already know|i'm good at|i am good at|experience (?:with|in)|familiar with|comfortable with|strong in|background in|i use|i've used|i have used|proficient in|solid on)\b/i
    ),
    // "3 years of Python", "5 yrs React"
    (/(\d+\s*(?:\+)?\s*(?:years?|yrs?)\s*(?:of|with|in)?\s*)([^.;,\n]{0,60})/i.exec(text)?.[2] ?? ""),
  ].join(" . ");
  const doneSegment = extractSegment(
    text,
    /\b(?:completed|finished|already (?:did|done|taken)|i've done|i have done|took a|studied)\b/i
  );

  const knownSkills = Array.from(new Set(matchSkills(knownSegment)));
  const completedRaw = doneSegment.trim();
  const completedCourses = completedRaw
    ? completedRaw
        .split(/,| and /)
        .map((s) => s.trim())
        .filter((s) => s.length > 2 && s.length < 60)
        .slice(0, 5)
    : [];

  const preferences = PREFERENCE_HINTS.filter((p) => p.match.test(text)).map((p) => p.label).slice(0, 4);

  const goalSentence =
    /(?:i want to|i'd like to|i would like to|my goal is to|help me|planning to|aiming to)\s+([^.!?\n]{6,180})/i.exec(
      text
    )?.[1] ?? text.split(/[.!?\n]/)[0];

  const goal = (goalSentence || text).trim().replace(/\s+/g, " ").slice(0, 200);

  const followUp = !knownSkills.length
    ? "Which of these do you already have hands-on experience with? That lets me skip whole sections."
    : !/(hours?|week|month)/i.test(text)
      ? "How many hours a week can you realistically give this?"
      : "Do you want this weighted toward building projects or toward fundamentals first?";

  return {
    goal: goal.length > 8 ? goal : text.slice(0, 200),
    role,
    level,
    interests: domainInterests,
    knownSkills,
    completedCourses,
    weeklyHours: detectWeeklyHours(text),
    targetWeeks: detectTargetWeeks(text),
    preferences,
    notes: "Profiled by the local rule-based engine.",
    followUp,
  };
}

/* ------------------------------------------------------------------ */
/* path building                                                       */
/* ------------------------------------------------------------------ */

const LEVEL_RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };

function knowsSkill(profile: Profile, skill: string) {
  const owned = profile.knownSkills.map((s) => s.toLowerCase());
  return owned.some((s) => s === skill.toLowerCase() || skill.toLowerCase().includes(s));
}

function alreadyCompleted(profile: Profile, course: Course) {
  const done = profile.completedCourses.map((c) => c.toLowerCase());
  return done.some(
    (d) => d.length > 3 && (course.title.toLowerCase().includes(d) || d.includes(course.title.toLowerCase()))
  );
}

/**
 * A course is redundant when the learner already has its headline skill and it
 * sits below their level — the classic "3 years of Python, here is Python 101"
 * failure. Prerequisite closure honours this too, so it cannot sneak back in.
 */
function isRedundant(profile: Profile, effLevel: Level, course: Course) {
  if (course.kind !== "course") return false;
  if (course.skills.every((s) => knowsSkill(profile, s))) return true;
  const primary = course.skills[0];
  return Boolean(
    primary && knowsSkill(profile, primary) && LEVEL_RANK[course.level] < LEVEL_RANK[effLevel]
  );
}

/** Topological order over prerequisites, tie-broken by level then hours. */
function orderByPrereqs(courses: Course[]): Course[] {
  const pool = new Map(courses.map((c) => [c.id, c]));
  const placed: Course[] = [];
  const placedIds = new Set<string>();
  const remaining = [...courses].sort(
    (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.hours - b.hours
  );

  let guard = 0;
  while (remaining.length && guard++ < 500) {
    const idx = remaining.findIndex((c) =>
      c.prereqs.every((p) => !pool.has(p) || placedIds.has(p))
    );
    const pick = idx === -1 ? 0 : idx; // cycle or unmet external prereq: take the easiest
    const [course] = remaining.splice(pick, 1);
    placed.push(course);
    placedIds.add(course.id);
  }
  return placed;
}

/**
 * A checkpoint or project must sit after the courses that teach its skills,
 * even when it declares no formal prerequisite (assessments usually don't).
 */
function settleCheckpoints(order: Course[]): Course[] {
  const result = [...order];
  for (const item of order.filter((c) => c.kind === "assessment" || c.kind === "project")) {
    const from = result.indexOf(item);
    if (from === -1) continue;
    let lastTeacher = -1;
    result.forEach((c, i) => {
      if (c.id === item.id || c.kind !== "course") return;
      if (c.skills.some((s) => item.skills.includes(s))) lastTeacher = i;
    });
    if (lastTeacher > from) {
      result.splice(from, 1);
      result.splice(lastTeacher, 0, item);
    }
  }
  return result;
}

function milestoneName(items: Course[], index: number, total: number): string {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.domain, (counts.get(i.domain) ?? 0) + i.hours);
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "your goal";
  const hasProject = items.some((i) => i.kind === "project");
  if (hasProject) return `Prove it: ${dominant}`;
  if (index === 0) return `Foundations: ${dominant}`;
  if (index === total - 1) return `Consolidating ${dominant}`;
  return `Depth in ${dominant}`;
}

function outcomeFor(items: Course[]): string {
  const skills = Array.from(new Set(items.flatMap((i) => i.skills))).slice(0, 3);
  const hasProject = items.some((i) => i.kind === "project");
  return hasProject
    ? `Ship something that uses ${skills.join(", ")} without following a tutorial.`
    : `Use ${skills.join(", ")} confidently on a problem you have not seen before.`;
}

function whyFor(course: Course, profile: Profile, unlocks: Course[]): string {
  const newSkills = course.skills.filter((s) => !knowsSkill(profile, s)).slice(0, 2);
  const parts: string[] = [];

  if (course.kind === "project") {
    parts.push(
      `You learn ${newSkills.join(" and ") || course.skills.slice(0, 2).join(" and ")} properly by building, and this is the first point in the path where you have enough to build unaided.`
    );
  } else if (course.kind === "assessment") {
    parts.push(
      `A checkpoint before you go further — it tells you whether ${course.skills.slice(0, 2).join(" and ")} is actually solid or just familiar.`
    );
  } else if (course.kind === "reading") {
    parts.push(
      `Reading that gives you the vocabulary and tradeoff intuition behind ${course.skills.slice(0, 2).join(" and ")}, which courses tend to skip.`
    );
  } else if (newSkills.length) {
    parts.push(`Closes your gap in ${newSkills.join(" and ")}, which your goal depends on directly.`);
  } else {
    parts.push(`Consolidates ${course.skills.slice(0, 2).join(" and ")} at the depth your goal needs.`);
  }

  if (unlocks.length) {
    parts.push(`It is the prerequisite for ${unlocks[0].title}, later in this path.`);
  } else if (LEVEL_RANK[course.level] > LEVEL_RANK[profile.level]) {
    parts.push(`It sits one level above where you are now, which is where the useful stretch is.`);
  }
  return parts.join(" ");
}

export function localPath(
  profile: Profile,
  feedback?: string,
  // Kept for signature parity with the Groq path, which does condition on the
  // existing path. The local engine rebuilds from the profile and the feedback
  // text alone, so it never reads this.
  _current?: LearningPath | null
): RawPath {
  const fb = (feedback ?? "").toLowerCase();
  const wantsShorter = /(short|trim|cut|too long|faster|less|essential|minimal)/.test(fb);
  const wantsProjects = /(project|hands.?on|build|practical|less theory)/.test(fb);
  const wantsHarder = /(harder|advanced|deeper|know the basics|too easy|challenging)/.test(fb);
  const wantsLonger = /(more depth|thorough|comprehensive|add more|longer)/.test(fb);

  const effLevel: Level = wantsHarder
    ? profile.level === "beginner"
      ? "intermediate"
      : "advanced"
    : profile.level;

  const query = `${profile.goal} ${profile.role} ${profile.interests.join(" ")} ${feedback ?? ""}`;
  let candidates = retrieveCourses(query, {
    level: effLevel,
    interests: profile.interests,
    limit: 40,
  }).filter((c) => !alreadyCompleted(profile, c));

  if (wantsHarder) {
    candidates = candidates.filter((c) => LEVEL_RANK[c.level] >= LEVEL_RANK[effLevel] || c.kind === "project");
  }

  // Drop anything the learner has effectively outgrown.
  candidates = candidates.filter((c) => !isRedundant(profile, effLevel, c));

  const budgetHours = Math.max(
    24,
    Math.round(profile.weeklyHours * profile.targetWeeks * (wantsShorter ? 0.7 : wantsLonger ? 1.25 : 1))
  );

  const ordered = orderByPrereqs(candidates);

  // Greedy fill within budget, keeping prerequisite closure intact.
  const chosen: Course[] = [];
  const chosenIds = new Set<string>();
  let hours = 0;
  const minItems = wantsShorter ? 5 : 7;
  const maxItems = wantsShorter ? 8 : wantsLonger ? 14 : 12;

  const weight = (c: Course) => {
    let w = 0;
    if (wantsProjects && c.kind === "project") w += 3;
    if (wantsProjects && c.kind === "course") w -= 1;
    if (c.skills.some((s) => profile.interests.some((i) => s.includes(i) || i.includes(s)))) w += 2;
    return w;
  };

  const ranked = [...ordered].sort((a, b) => weight(b) - weight(a));
  for (const c of ranked) {
    if (chosen.length >= maxItems) break;
    if (chosenIds.has(c.id)) continue;
    const needed = c.prereqs
      .map((p) => COURSE_BY_ID.get(p))
      .filter((p): p is Course => Boolean(p) && !chosenIds.has(p!.id) && !alreadyCompleted(profile, p!))
      .filter((p) => !isRedundant(profile, effLevel, p));
    const cost = c.hours + needed.reduce((s, p) => s + p.hours, 0);
    if (hours + cost > budgetHours && chosen.length >= minItems) continue;
    for (const p of needed) {
      chosen.push(p);
      chosenIds.add(p.id);
    }
    chosen.push(c);
    chosenIds.add(c.id);
    hours += cost;
  }

  // Guarantee at least one project and one assessment.
  for (const kind of ["project", "assessment"] as const) {
    if (chosen.some((c) => c.kind === kind)) continue;
    const extra = ordered.find((c) => c.kind === kind && !chosenIds.has(c.id));
    if (extra) {
      chosen.push(extra);
      chosenIds.add(extra.id);
      hours += extra.hours;
    }
  }

  const finalOrder = settleCheckpoints(orderByPrereqs(chosen));

  // Chunk into milestones of 2-4, keeping projects/assessments at chunk ends.
  const perChunk = finalOrder.length <= 6 ? 2 : finalOrder.length <= 10 ? 3 : 4;
  const chunks: Course[][] = [];
  for (let i = 0; i < finalOrder.length; i += perChunk) chunks.push(finalOrder.slice(i, i + perChunk));
  if (chunks.length > 1 && chunks[chunks.length - 1].length === 1) {
    chunks[chunks.length - 2].push(chunks.pop()![0]);
  }

  let weekCursor = 1;
  const milestones = chunks.map((items, i) => {
    const chunkHours = items.reduce((s, c) => s + c.hours, 0);
    const span = Math.max(1, Math.round(chunkHours / Math.max(1, profile.weeklyHours)));
    const from = weekCursor;
    weekCursor += span;
    return {
      title: milestoneName(items, i, chunks.length),
      weeks: span === 1 ? `Week ${from}` : `Weeks ${from}-${weekCursor - 1}`,
      outcome: outcomeFor(items),
      items: items.map((c) => {
        const unlocks = finalOrder.filter((o) => o.prereqs.includes(c.id));
        const inPath = c.prereqs.filter((p) => chosenIds.has(p));
        return {
          courseId: c.id,
          why: whyFor(c, profile, unlocks),
          prereqNote: !c.prereqs.length
            ? ""
            : inPath.length === c.prereqs.length
              ? `Comes after ${inPath.map((p) => COURSE_BY_ID.get(p)?.title ?? p).join(", ")} in this path.`
              : (() => {
                  const outside = c.prereqs.filter((p) => !chosenIds.has(p));
                  const covered = outside.filter((p) => {
                    const pc = COURSE_BY_ID.get(p);
                    return pc ? pc.skills.every((s) => knowsSkill(profile, s)) : false;
                  });
                  const uncovered = outside.filter((p) => !covered.includes(p));
                  const bits: string[] = [];
                  if (inPath.length) {
                    bits.push(
                      `Comes after ${inPath.map((p) => COURSE_BY_ID.get(p)?.title ?? p).join(", ")} in this path.`
                    );
                  }
                  if (covered.length) {
                    bits.push(
                      `${covered.map((p) => COURSE_BY_ID.get(p)?.title ?? p).join(", ")} is skipped — you already have those skills.`
                    );
                  }
                  if (uncovered.length) {
                    bits.push(
                      `Assumes ${uncovered.map((p) => COURSE_BY_ID.get(p)?.title ?? p).join(", ")}, which is outside this goal — skim it if that ground is new to you.`
                    );
                  }
                  return bits.join(" ");
                })(),
        };
      }),
    };
  });

  const targetSkills = Array.from(new Set(finalOrder.flatMap((c) => c.skills)));
  const seenRoot = new Set<string>();
  const skillGaps = targetSkills
    .map((skill) => {
      const covering = finalOrder.filter((c) => c.skills.includes(skill));
      const hours = covering.reduce((s, c) => s + c.hours, 0);
      const known = knowsSkill(profile, skill);
      const wanted = profile.interests.some((i) => skill.includes(i) || i.includes(skill));
      return {
        skill,
        covering,
        hours,
        known,
        // hours invested is a better signal of emphasis than resource count
        weight: hours + (wanted ? 40 : 0),
      };
    })
    .filter((g) => g.hours > 0)
    .sort((a, b) => b.weight - a.weight)
    .filter((g) => {
      // collapse near-duplicates like git / version control
      const root = g.skill.split(" ")[0];
      if (seenRoot.has(root)) return false;
      seenRoot.add(root);
      return true;
    })
    .slice(0, 8)
    .map((g) => ({
      skill: g.skill,
      current: g.known
        ? Math.min(70, 45 + LEVEL_RANK[profile.level] * 12)
        : Math.max(4, LEVEL_RANK[profile.level] * 9 - 4),
      target: Math.min(95, 58 + Math.round(g.hours / 3)),
      note: g.known
        ? `You have some of this — ${g.hours}h across ${g.covering.length} resource${g.covering.length > 1 ? "s" : ""} takes it to working depth.`
        : `New ground; ${g.hours}h of this path (${g.covering.length} resource${g.covering.length > 1 ? "s" : ""}) builds it.`,
    }));

  const weeksNeeded = Math.ceil(hours / Math.max(1, profile.weeklyHours));
  const tradeoff =
    weeksNeeded > profile.targetWeeks
      ? ` At ${profile.weeklyHours} h/week this needs about ${weeksNeeded} weeks — ${weeksNeeded - profile.targetWeeks} past your target, so the later milestones are the ones to cut if you have to.`
      : ` It fits your ${profile.targetWeeks}-week window with room to spare at ${profile.weeklyHours} h/week.`;

  const changeNote = feedback
    ? ` Rebuilt around your feedback: ${wantsShorter ? "trimmed to essentials" : wantsProjects ? "weighted toward projects" : wantsHarder ? "started at a higher level" : wantsLonger ? "added depth" : "reordered around what you asked for"}.`
    : "";

  return {
    title: `${profile.role} path${wantsShorter ? " (essentials)" : ""}`,
    summary:
      `Sequenced from what you already have toward ${profile.goal.replace(/\.$/, "")}. Prerequisites are ordered so nothing arrives before you can use it, and each milestone ends in something you can show.` +
      tradeoff +
      changeNote,
    skillGaps,
    milestones,
  };
}

/* ------------------------------------------------------------------ */
/* explanations, chat, coaching                                        */
/* ------------------------------------------------------------------ */

export function localExplain(course: Course, profile: Profile, path?: LearningPath | null): string {
  const unlocks = pathItems(path)
    .filter((i) => i.courseId && COURSE_BY_ID.get(i.courseId)?.prereqs.includes(course.id))
    .map((i) => i.title);
  const newSkills = course.skills.filter((s) => !knowsSkill(profile, s));

  const why =
    course.kind === "project"
      ? `You have the pieces by this point, and ${profile.goal.replace(/\.$/, "")} needs evidence you can assemble them yourself.`
      : newSkills.length
        ? `${newSkills.slice(0, 2).join(" and ")} is the gap between where you are (${profile.level}) and what ${profile.role} work assumes.`
        : `It takes ${course.skills.slice(0, 2).join(" and ")} from familiar to reliable, which is where your goal needs it.`;

  const unlock = unlocks.length
    ? `${unlocks.slice(0, 2).join(" and ")} — neither makes sense before this.`
    : course.kind === "assessment"
      ? `Confidence that the previous milestone actually stuck, so you are not building on sand.`
      : `The rest of this milestone, plus ${course.skills.slice(0, 2).join(" and ")} showing up in your own work.`;

  const done =
    course.kind === "project"
      ? `Someone else can run it from your README without asking you a question.`
      : course.kind === "assessment"
        ? `You score well without looking anything up mid-question.`
        : `You can explain ${course.skills[0]} to someone one level behind you, and use it without the docs open.`;

  return `Why now: ${why}\nWhat it unlocks: ${unlock}\nHow to know you're done: ${done}`;
}

export function localChat(
  question: string,
  profile: Profile | null,
  path: LearningPath | null,
  completed: string[]
): string {
  const q = question.toLowerCase();
  if (!profile || !path) {
    return "I do not have a profile or path for you yet. Describe your goal on the start page and I will have something concrete to talk about.";
  }
  const { items, done, next, remainingHours } = pathProgress(path, completed);
  const weeks = weeksAt(remainingHours, profile.weeklyHours);

  if (/\bwhy\b/.test(q) && next) {
    return `**${next.title}** is next because: ${next.why}\n\n${next.prereqNote || "It has no unmet prerequisites, so you can start it today."}\n\nIt is ${next.hours} hours, which is about ${Math.max(1, Math.round(next.hours / Math.max(1, profile.weeklyHours)))} week(s) at your pace.`;
  }
  if (/(skip|already know|too easy|waste)/.test(q)) {
    const skippable = items.filter(
      (i) => i.skills.length > 0 && i.skills.every((s) => knowsSkill(profile, s))
    );
    return skippable.length
      ? `Given what you listed as existing skills, these look skippable:\n\n${skippable.map((s) => `- ${s.title} (${s.hours}h) — covers ${s.skills.slice(0, 3).join(", ")}`).join("\n")}\n\nSkipping them saves ${skippable.reduce((s, i) => s + i.hours, 0)} hours. Mark them complete and the dashboard will re-plan.`
      : `Nothing in the path is fully covered by the skills you listed (${profile.knownSkills.join(", ") || "none given"}). If that list is incomplete, add to it on the start page and I will re-check.`;
  }
  if (/(time|finish|deadline|how long|pace|behind|on track)/.test(q)) {
    const verdict =
      weeks <= profile.targetWeeks
        ? `Yes — ${weeks} weeks left against a ${profile.targetWeeks}-week target.`
        : `Not at this pace. ${weeks} weeks of work remain against a ${profile.targetWeeks}-week target.`;
    return `${verdict}\n\n- Remaining effort: **${remainingHours} h** across ${items.length - done.length} items\n- Your budget: ${profile.weeklyHours} h/week\n- To hit the target you would need about **${paceFor(remainingHours, profile.targetWeeks)} h/week**\n\nIf that is not realistic, ask me to trim it and apply "Adapt path".`;
  }
  if (/(project|hands.?on|practical|build)/.test(q)) {
    const projects = items.filter((i) => i.kind === "project");
    return `The path has ${projects.length} project${projects.length === 1 ? "" : "s"}:\n\n${projects.map((p) => `- **${p.title}** (${p.hours}h) — ${p.why}`).join("\n")}\n\nWant it heavier on building? Put "more hands-on projects, fewer courses" into Adapt path and it gets rebuilt.`;
  }
  if (/(harder|advanced|deeper|stretch)/.test(q)) {
    return `You are set to **${profile.level}**. Raising it drops the foundational courses and starts you at the level above.\n\nUse Adapt path with "I already know the basics, start harder" — or change your level on the start page for a cleaner rebuild.`;
  }
  if (/(gap|skill|weak)/.test(q)) {
    return `The path targets these gaps first:\n\n${path.skillGaps.slice(0, 5).map((g) => `- **${g.skill}** ${g.current} → ${g.target} — ${g.note}`).join("\n")}`;
  }
  return `Here is where you stand on **${path.title}**:\n\n- ${done.length} of ${items.length} items complete\n- ${remainingHours} h remaining, about ${weeks} week(s) at ${profile.weeklyHours} h/week\n- Up next: **${next?.title ?? "nothing — you finished it"}**\n\nAsk me why something is recommended, what you can skip, or whether you will finish in time.`;
}

export function localCoach(
  profile: Profile,
  path: LearningPath,
  completedIds: string[]
): { status: string; observations: string[]; nextActions: { title: string; detail: string; effort: string }[]; pathChange: string } {
  const { items, remaining, doneHours, remainingHours, pct } = pathProgress(path, completedIds);
  const weeksNeeded = weeksAt(remainingHours, profile.weeklyHours);
  const next = remaining.slice(0, 2);
  const currentMilestone =
    path.milestones.find((m) => m.items.some((i) => !completedIds.includes(i.id))) ?? path.milestones[0];

  const observations: string[] = [];
  observations.push(
    `${doneHours} of ${path.totalHours} planned hours logged — ${pct}% of the path, with ${remainingHours} h left.`
  );
  if (weeksNeeded > profile.targetWeeks) {
    observations.push(
      `At ${profile.weeklyHours} h/week you need ${weeksNeeded} more weeks, which overruns your ${profile.targetWeeks}-week target. Either raise weekly hours to ~${paceFor(remainingHours, profile.targetWeeks)} or cut a late milestone.`
    );
  } else {
    observations.push(
      `${weeksNeeded} week(s) of work remain, inside your ${profile.targetWeeks}-week target.`
    );
  }
  const totalProjects = items.filter((i) => i.kind === "project").length;
  const unfinishedProjects = remaining.filter((i) => i.kind === "project").length;
  if (pct > 40 && totalProjects > 0 && unfinishedProjects === totalProjects) {
    observations.push(
      `All ${unfinishedProjects} project${unfinishedProjects > 1 ? "s are" : " is"} still ahead of you. Course completion without a shipped project is the most common way this path stalls.`
    );
  }
  if (pct === 0) {
    observations.push(`Nothing marked complete yet — the first item is ${items[0]?.hours ?? 0} h, so it is a single sitting or two.`);
  }

  const nextActions = next.map((item) => ({
    title: `Start ${item.title}`,
    detail: item.why,
    effort: `${Math.min(item.hours, profile.weeklyHours)} h this week (${item.hours} h total)`,
  }));
  if (currentMilestone) {
    nextActions.push({
      title: `Close out "${currentMilestone.title}"`,
      detail: currentMilestone.outcome || "Finish the remaining items in this milestone before moving on.",
      effort: `${currentMilestone.items.filter((i) => !completedIds.includes(i.id)).reduce((s, i) => s + i.hours, 0)} h remaining`,
    });
  }

  const pathChange =
    weeksNeeded > profile.targetWeeks
      ? `Trim the path to fit ${profile.targetWeeks} weeks — drop the lowest-value course in the final milestone and keep the project.`
      : pct > 60
        ? `You are far enough in that a harder rebuild would suit you better than the remaining beginner material.`
        : "";

  return {
    status:
      pct === 100
        ? `Path complete — ${path.totalHours} hours and ${items.length} resources done.`
        : `${pct}% through "${path.title}", currently inside "${currentMilestone?.title ?? "your first milestone"}".`,
    observations: observations.slice(0, 4),
    nextActions: nextActions.slice(0, 3),
    pathChange,
  };
}

/** Chunked stream so the local engine feels the same as the model in the UI. */
export function textToStream(text: string, chunk = 3, delayMs = 14): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const words = text.split(/(\s+)/);
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= words.length) {
        controller.close();
        return;
      }
      const slice = words.slice(i, i + chunk).join("");
      i += chunk;
      controller.enqueue(encoder.encode(slice));
      await new Promise((r) => setTimeout(r, delayMs));
    },
  });
}
