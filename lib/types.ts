export type Level = "beginner" | "intermediate" | "advanced";

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

export type LearningPath = {
  title: string;
  summary: string;
  totalHours: number;
  skillGaps: { skill: string; current: number; target: number; note: string }[];
  milestones: Milestone[];
  createdAt: number;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };
