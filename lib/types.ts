export type Level = "beginner" | "intermediate" | "advanced";

/** The three levels in order, for both ordering maths and UI pickers. */
export const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

/** How far apart two levels are. Index with a Level, or guard with `?? 0`. */
export const LEVEL_RANK: Record<Level, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export type Course = {
  id: string;
  title: string;
  provider: string;
  domain: string;
  level: Level;
  hours: number;
  skills: string[];
  prereqs: string[];
  kind: "course" | "project" | "assessment" | "reading";
  url: string;
  summary: string;
};

export type Profile = {
  goal: string;
  role: string;
  level: Level;
  interests: string[];
  knownSkills: string[];
  completedCourses: string[];
  weeklyHours: number;
  targetWeeks: number;
  preferences: string[];
  notes: string;
};

export type PathItem = {
  id: string;
  courseId: string | null;
  title: string;
  kind: Course["kind"];
  provider: string;
  hours: number;
  skills: string[];
  why: string;
  prereqNote: string;
  url: string;
};

export type Milestone = {
  id: string;
  title: string;
  weeks: string;
  outcome: string;
  items: PathItem[];
};

export type SkillGap = {
  skill: string;
  /** Percent, 0-100. */
  current: number;
  target: number;
  note: string;
};

export type LearningPath = {
  title: string;
  summary: string;
  totalHours: number;
  skillGaps: SkillGap[];
  milestones: Milestone[];
  createdAt: number;
};

export type CoachAction = { title: string; detail: string; effort: string };

/** What the progress coach returns, from either engine. */
export type Coaching = {
  status: string;
  observations: string[];
  nextActions: CoachAction[];
  pathChange: string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };
