import { LEVEL_RANK } from "./types";
import type { Course, Level } from "./types";

/**
 * Local course catalog. Stands in for a real platform's course DB — the
 * recommender retrieves from this list so the model can only recommend
 * resources that actually exist.
 */
export const CATALOG: Course[] = [
  // ---------- Programming foundations ----------
  { id: "py-101", title: "Python Programming Foundations", provider: "Coursera", domain: "Programming", level: "beginner", hours: 30, skills: ["python", "programming basics", "loops", "functions"], prereqs: [], kind: "course", url: "https://www.coursera.org/learn/python", summary: "Syntax, control flow, functions and files in Python." },
  { id: "py-201", title: "Intermediate Python: OOP and Idioms", provider: "Udemy", domain: "Programming", level: "intermediate", hours: 24, skills: ["python", "oop", "decorators", "testing"], prereqs: ["py-101"], kind: "course", url: "https://www.udemy.com/course/intermediate-python", summary: "Classes, generators, decorators, packaging and pytest." },
  { id: "js-101", title: "Modern JavaScript from Scratch", provider: "Scrimba", domain: "Web", level: "beginner", hours: 28, skills: ["javascript", "dom", "es6"], prereqs: [], kind: "course", url: "https://scrimba.com/learn/javascript", summary: "ES6+, DOM, async/await and fetch." },
  { id: "ts-201", title: "TypeScript for Application Developers", provider: "Frontend Masters", domain: "Web", level: "intermediate", hours: 16, skills: ["typescript", "types", "generics"], prereqs: ["js-101"], kind: "course", url: "https://frontendmasters.com/courses/typescript", summary: "Structural typing, generics, narrowing, config." },
  { id: "algo-201", title: "Algorithms and Data Structures", provider: "Stanford Online", domain: "CS Core", level: "intermediate", hours: 45, skills: ["algorithms", "data structures", "complexity"], prereqs: ["py-101"], kind: "course", url: "https://www.coursera.org/specializations/algorithms", summary: "Sorting, graphs, dynamic programming, Big-O." },
  { id: "git-101", title: "Git and GitHub Essentials", provider: "GitHub Learning Lab", domain: "Tooling", level: "beginner", hours: 8, skills: ["git", "version control", "code review"], prereqs: [], kind: "course", url: "https://skills.github.com", summary: "Branching, merges, pull requests, CI basics." },

  // ---------- Data / ML / AI ----------
  { id: "stat-101", title: "Statistics and Probability for Data", provider: "Khan Academy", domain: "Data", level: "beginner", hours: 26, skills: ["statistics", "probability", "distributions", "hypothesis testing"], prereqs: [], kind: "course", url: "https://www.khanacademy.org/math/statistics-probability", summary: "Descriptive stats, distributions, inference." },
  { id: "sql-101", title: "SQL for Data Analysis", provider: "Mode Analytics", domain: "Data", level: "beginner", hours: 18, skills: ["sql", "joins", "aggregation", "window functions"], prereqs: [], kind: "course", url: "https://mode.com/sql-tutorial", summary: "Queries, joins, CTEs and window functions." },
  { id: "pandas-201", title: "Data Wrangling with pandas", provider: "DataCamp", domain: "Data", level: "intermediate", hours: 20, skills: ["pandas", "numpy", "data cleaning", "eda"], prereqs: ["py-101"], kind: "course", url: "https://www.datacamp.com/courses/data-manipulation-with-pandas", summary: "Indexing, groupby, merges, reshaping, plots." },
  { id: "viz-201", title: "Data Visualization and Storytelling", provider: "Coursera", domain: "Data", level: "intermediate", hours: 16, skills: ["visualization", "matplotlib", "communication"], prereqs: ["pandas-201"], kind: "course", url: "https://www.coursera.org/learn/data-visualization", summary: "Chart choice, narrative structure, dashboards." },
  { id: "ml-201", title: "Machine Learning Specialization", provider: "DeepLearning.AI", domain: "ML", level: "intermediate", hours: 60, skills: ["machine learning", "regression", "classification", "scikit-learn"], prereqs: ["pandas-201", "stat-101"], kind: "course", url: "https://www.coursera.org/specializations/machine-learning-introduction", summary: "Supervised and unsupervised learning end to end." },
  { id: "dl-301", title: "Deep Learning with PyTorch", provider: "fast.ai", domain: "ML", level: "advanced", hours: 50, skills: ["deep learning", "pytorch", "cnn", "transformers"], prereqs: ["ml-201"], kind: "course", url: "https://course.fast.ai", summary: "Neural nets, training loops, transfer learning." },
  { id: "nlp-301", title: "Natural Language Processing with Transformers", provider: "Hugging Face", domain: "ML", level: "advanced", hours: 32, skills: ["nlp", "transformers", "embeddings", "fine-tuning"], prereqs: ["dl-301"], kind: "course", url: "https://huggingface.co/learn/nlp-course", summary: "Tokenizers, attention, fine-tuning, evaluation." },
  { id: "llm-301", title: "Building LLM Applications with RAG", provider: "DeepLearning.AI", domain: "AI Engineering", level: "advanced", hours: 22, skills: ["llm", "rag", "vector databases", "prompt engineering"], prereqs: ["py-201"], kind: "course", url: "https://www.deeplearning.ai/short-courses", summary: "Retrieval pipelines, chunking, evals, agents." },
  { id: "mlops-301", title: "MLOps: Deploying Models to Production", provider: "Google Cloud", domain: "ML", level: "advanced", hours: 34, skills: ["mlops", "model deployment", "monitoring", "docker"], prereqs: ["ml-201", "docker-201"], kind: "course", url: "https://www.coursera.org/specializations/mlops", summary: "Pipelines, feature stores, drift monitoring." },

  // ---------- Web engineering ----------
  { id: "html-101", title: "HTML and CSS Layout Fundamentals", provider: "MDN", domain: "Web", level: "beginner", hours: 20, skills: ["html", "css", "flexbox", "grid", "accessibility"], prereqs: [], kind: "course", url: "https://developer.mozilla.org/en-US/docs/Learn", summary: "Semantic markup, responsive layout, a11y basics." },
  { id: "react-201", title: "React: Components, State and Hooks", provider: "React Docs", domain: "Web", level: "intermediate", hours: 26, skills: ["react", "hooks", "state management", "components"], prereqs: ["js-101", "html-101"], kind: "course", url: "https://react.dev/learn", summary: "Composition, effects, data fetching, forms." },
  { id: "next-301", title: "Full-Stack Next.js", provider: "Vercel", domain: "Web", level: "advanced", hours: 24, skills: ["next.js", "server components", "api routes", "ssr"], prereqs: ["react-201", "ts-201"], kind: "course", url: "https://nextjs.org/learn", summary: "App Router, server actions, caching, deployment." },
  { id: "api-201", title: "Designing REST and GraphQL APIs", provider: "Pluralsight", domain: "Backend", level: "intermediate", hours: 18, skills: ["api design", "rest", "graphql", "auth"], prereqs: ["js-101"], kind: "course", url: "https://www.pluralsight.com/courses/api-design", summary: "Resources, versioning, pagination, authn/authz." },
  { id: "db-201", title: "Relational Database Design", provider: "CMU DB Group", domain: "Backend", level: "intermediate", hours: 22, skills: ["database design", "normalization", "indexing", "postgres"], prereqs: ["sql-101"], kind: "course", url: "https://15445.courses.cs.cmu.edu", summary: "Schema design, transactions, indexes, query plans." },
  { id: "docker-201", title: "Docker and Containers in Practice", provider: "Docker", domain: "DevOps", level: "intermediate", hours: 14, skills: ["docker", "containers", "ci/cd"], prereqs: ["git-101"], kind: "course", url: "https://docs.docker.com/get-started", summary: "Images, volumes, compose, registries." },
  { id: "cloud-201", title: "Cloud Fundamentals on AWS", provider: "AWS Skill Builder", domain: "DevOps", level: "intermediate", hours: 28, skills: ["aws", "cloud", "networking", "iam"], prereqs: [], kind: "course", url: "https://skillbuilder.aws", summary: "Compute, storage, networking, security basics." },
  { id: "sysdes-301", title: "System Design for Scale", provider: "Educative", domain: "Architecture", level: "advanced", hours: 30, skills: ["system design", "scalability", "caching", "queues"], prereqs: ["api-201", "db-201"], kind: "course", url: "https://www.educative.io/courses/grokking-modern-system-design", summary: "Load balancing, sharding, consistency, capacity." },
  { id: "sec-201", title: "Web Application Security (OWASP Top 10)", provider: "OWASP", domain: "Security", level: "intermediate", hours: 16, skills: ["security", "owasp", "authentication"], prereqs: ["api-201"], kind: "course", url: "https://owasp.org/www-project-top-ten", summary: "Injection, XSS, access control, secure defaults." },

  // ---------- Product, design, analytics ----------
  { id: "pm-101", title: "Product Management Foundations", provider: "Reforge", domain: "Product", level: "beginner", hours: 20, skills: ["product management", "roadmapping", "user research"], prereqs: [], kind: "course", url: "https://www.reforge.com", summary: "Discovery, prioritisation, specs, stakeholders." },
  { id: "ux-101", title: "UX Research and Usability Testing", provider: "NN/g", domain: "Design", level: "beginner", hours: 18, skills: ["ux research", "usability", "interviews"], prereqs: [], kind: "course", url: "https://www.nngroup.com/courses", summary: "Interview scripts, usability tests, synthesis." },
  { id: "ui-201", title: "Interface Design Systems", provider: "Figma", domain: "Design", level: "intermediate", hours: 16, skills: ["ui design", "design systems", "figma", "typography"], prereqs: ["ux-101"], kind: "course", url: "https://www.figma.com/resource-library", summary: "Tokens, components, layout grids, handoff." },
  { id: "analytics-201", title: "Product Analytics and Experimentation", provider: "Amplitude", domain: "Product", level: "intermediate", hours: 14, skills: ["analytics", "a/b testing", "metrics"], prereqs: ["stat-101"], kind: "course", url: "https://amplitude.com/academy", summary: "Event models, funnels, retention, experiment design." },
  { id: "bi-201", title: "Business Intelligence with dbt and BI Tools", provider: "dbt Labs", domain: "Data", level: "intermediate", hours: 20, skills: ["dbt", "data modelling", "bi", "warehouse"], prereqs: ["sql-101"], kind: "course", url: "https://courses.getdbt.com", summary: "Transformations, tests, docs, semantic layers." },

  // ---------- Projects ----------
  { id: "proj-eda", title: "Project: End-to-end exploratory analysis", provider: "Wayfinder", domain: "Data", level: "beginner", hours: 12, skills: ["pandas", "eda", "visualization", "communication"], prereqs: ["pandas-201"], kind: "project", url: "#", summary: "Clean a messy public dataset and publish findings." },
  { id: "proj-ml", title: "Project: Predictive model with a served API", provider: "Wayfinder", domain: "ML", level: "intermediate", hours: 20, skills: ["machine learning", "scikit-learn", "api design", "model deployment"], prereqs: ["ml-201", "api-201"], kind: "project", url: "#", summary: "Train, evaluate and ship a model behind an endpoint." },
  { id: "proj-rag", title: "Project: Retrieval-augmented assistant", provider: "Wayfinder", domain: "AI Engineering", level: "advanced", hours: 18, skills: ["llm", "rag", "vector databases", "evaluation"], prereqs: ["llm-301"], kind: "project", url: "#", summary: "Build a grounded assistant over your own documents." },
  { id: "proj-web", title: "Project: Full-stack app with auth and payments", provider: "Wayfinder", domain: "Web", level: "intermediate", hours: 25, skills: ["next.js", "api design", "database design", "authentication"], prereqs: ["react-201", "db-201"], kind: "project", url: "#", summary: "Ship a deployed multi-user product." },
  { id: "proj-dash", title: "Project: Analytics dashboard for a real business question", provider: "Wayfinder", domain: "Data", level: "intermediate", hours: 14, skills: ["sql", "bi", "visualization", "metrics"], prereqs: ["sql-101", "viz-201"], kind: "project", url: "#", summary: "Model the data, build the dashboard, defend the metric." },
  { id: "proj-design", title: "Project: Redesign a flow end to end", provider: "Wayfinder", domain: "Design", level: "intermediate", hours: 16, skills: ["ux research", "ui design", "design systems"], prereqs: ["ui-201"], kind: "project", url: "#", summary: "Research, wireframe, prototype, usability-test." },

  // ---------- Assessments ----------
  { id: "assess-py", title: "Assessment: Python proficiency check", provider: "Wayfinder", domain: "Programming", level: "beginner", hours: 2, skills: ["python"], prereqs: [], kind: "assessment", url: "#", summary: "40-question timed check on core Python." },
  { id: "assess-sql", title: "Assessment: SQL query challenge", provider: "Wayfinder", domain: "Data", level: "intermediate", hours: 2, skills: ["sql", "window functions"], prereqs: [], kind: "assessment", url: "#", summary: "Ten increasingly hard analytical queries." },
  { id: "assess-ml", title: "Assessment: ML case study review", provider: "Wayfinder", domain: "ML", level: "advanced", hours: 3, skills: ["machine learning", "evaluation"], prereqs: ["ml-201"], kind: "assessment", url: "#", summary: "Critique a leaky, badly evaluated model." },
  { id: "assess-web", title: "Assessment: Frontend build exercise", provider: "Wayfinder", domain: "Web", level: "intermediate", hours: 3, skills: ["react", "css", "accessibility"], prereqs: ["react-201"], kind: "assessment", url: "#", summary: "Build a component to spec under time pressure." },
  { id: "assess-sysdes", title: "Assessment: System design mock interview", provider: "Wayfinder", domain: "Architecture", level: "advanced", hours: 2, skills: ["system design", "scalability"], prereqs: ["sysdes-301"], kind: "assessment", url: "#", summary: "Design a rate-limited, sharded write path." },

  // ---------- Readings ----------
  { id: "read-dmls", title: "Reading: Designing Machine Learning Systems", provider: "O'Reilly", domain: "ML", level: "advanced", hours: 15, skills: ["mlops", "system design", "machine learning"], prereqs: [], kind: "reading", url: "https://www.oreilly.com", summary: "Chip Huyen on production ML system tradeoffs." },
  { id: "read-ddia", title: "Reading: Designing Data-Intensive Applications", provider: "O'Reilly", domain: "Architecture", level: "advanced", hours: 25, skills: ["system design", "databases", "distributed systems"], prereqs: [], kind: "reading", url: "https://dataintensive.net", summary: "Storage, replication, partitioning, consistency." },
  { id: "read-inspired", title: "Reading: Inspired", provider: "Wiley", domain: "Product", level: "beginner", hours: 10, skills: ["product management", "discovery"], prereqs: [], kind: "reading", url: "https://www.svpg.com/inspired-how-to-create-products-customers-love", summary: "Marty Cagan on product discovery and teams." },
];

export const COURSE_BY_ID = new Map(CATALOG.map((c) => [c.id, c]));

function tokens(s: string) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9+.#]+/)
    .filter((t) => t.length > 2);
}

/**
 * Lightweight keyword retrieval so the LLM sees a relevant slice of the
 * catalog rather than the whole thing. Scores on goal/interest/skill overlap
 * and nudges toward the learner's level.
 */
export function retrieveCourses(
  query: string,
  opts: { level?: string; interests?: string[]; exclude?: string[]; limit?: number } = {}
): Course[] {
  const { level = "beginner", interests = [], exclude = [], limit = 30 } = opts;
  const q = new Set([...tokens(query), ...interests.flatMap(tokens)]);
  const excluded = new Set(exclude);

  const scored = CATALOG.filter((c) => !excluded.has(c.id)).map((c) => {
    const hay = new Set([
      ...tokens(c.title),
      ...tokens(c.domain),
      ...tokens(c.summary),
      ...c.skills.flatMap(tokens),
    ]);
    let score = 0;
    for (const t of q) if (hay.has(t)) score += 3;
    for (const s of c.skills) if (q.has(s.split(" ")[0])) score += 2;
    const gap = LEVEL_RANK[c.level] - (LEVEL_RANK[level as Level] ?? 0);
    score += gap === 0 ? 2 : gap === 1 ? 1 : gap < 0 ? 0.5 : -1;
    if (c.kind === "project") score += 1;
    return { c, score };
  });

  const hits = scored.filter((s) => s.score > 1.5).sort((a, b) => b.score - a.score);
  const picked = hits.slice(0, limit).map((s) => s.c);

  // Always include prerequisites of picked courses so the path can be ordered.
  const ids = new Set(picked.map((c) => c.id));
  for (const c of [...picked]) {
    for (const p of c.prereqs) {
      if (!ids.has(p) && !excluded.has(p)) {
        const prereq = COURSE_BY_ID.get(p);
        if (prereq) {
          picked.push(prereq);
          ids.add(p);
        }
      }
    }
  }
  return picked.length ? picked : CATALOG.slice(0, limit);
}

export function catalogLines(courses: Course[]) {
  return courses
    .map(
      (c) =>
        `${c.id} | ${c.title} | ${c.kind} | ${c.provider} | ${c.level} | ${c.hours}h | skills: ${c.skills.join(", ")} | prereqs: ${c.prereqs.join(", ") || "none"}`
    )
    .join("\n");
}
