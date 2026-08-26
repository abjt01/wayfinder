"use client";

import { useState } from "react";
import { KindGlyph, KindTag } from "./KindGlyph";
import { Button, Chip, Spinner } from "./ui";
import { useToast } from "./Toast";
import { useAssistant } from "./AssistantHost";
import { usePost } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { PathItem } from "@/lib/types";

export function ItemCard({ item, index }: { item: PathItem; index: number }) {
  const { profile, path, completed, toggleComplete } = useStore();
  const { push } = useToast();
  const assistant = useAssistant();
  const { post, loading, error } = usePost<{ explanation: string }>();
  const [explanation, setExplanation] = useState("");
  const [expanded, setExpanded] = useState(false);
  const done = completed.includes(item.id);

  async function explain() {
    if (explanation) {
      setExplanation("");
      return;
    }
    const data = await post("/api/explain", { courseId: item.courseId, profile, path });
    if (data?.explanation) setExplanation(data.explanation);
  }

  return (
    <li
      id={`item-${item.id}`}
      className={`group scroll-mt-28 border-b border-rule-soft transition-colors last:border-b-0 ${
        done ? "bg-paper/60" : "hover:bg-paper/70"
      }`}
    >
      <div className="flex gap-3.5 px-5 py-4">
        <div className="flex flex-col items-center gap-2 pt-0.5">
          <button
            onClick={() => {
              toggleComplete(item.id);
              push(done ? `Reopened "${item.title}"` : `Marked "${item.title}" complete`, done ? "ink" : "moss");
            }}
            aria-label={done ? "Mark as not done" : "Mark as done"}
            aria-pressed={done}
            className={`flex h-[22px] w-[22px] items-center justify-center border transition-all duration-150 ${
              done
                ? "border-moss bg-moss text-white"
                : "border-ink-faint bg-card text-transparent hover:border-ink hover:text-ink-faint"
            }`}
          >
            <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 ${done ? "anim-tick" : ""}`}>
              <path
                d="M3.4 8.4 6.4 11.3 12.6 4.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="t-meta">{String(index).padStart(2, "0")}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3
              className={`text-[15px] font-medium leading-snug ${
                done ? "text-ink-faint line-through decoration-ink-faint/50" : "text-ink"
              }`}
            >
              {item.title}
            </h3>
            <KindTag kind={item.kind} />
            <span className="t-meta">
              {item.provider} · {item.hours}h
            </span>
          </div>

          <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-ink-soft">{item.why}</p>

          {item.prereqNote && (
            <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-ink-mute">
              <svg viewBox="0 0 16 16" className="mt-[3px] h-3 w-3 shrink-0 text-ink-faint">
                <path d="M2 8h6M8 8V3.5M8 8v4.5M8 3.5h6M8 12.5h6" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              {item.prereqNote}
            </p>
          )}

          {(expanded || item.skills.length <= 4) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {item.skills.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
          )}
          {!expanded && item.skills.length > 4 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {item.skills.slice(0, 3).map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
              <button onClick={() => setExpanded(true)} className="t-meta hover:text-ink">
                +{item.skills.length - 3} more
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1">
            <Button variant="quiet" size="sm" onClick={explain} disabled={loading}>
              {loading ? <Spinner /> : explanation ? "Hide reasoning" : "Why this?"}
            </Button>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => assistant.ask(`Tell me more about "${item.title}" and whether I could skip it.`)}
            >
              Discuss
            </Button>
            {item.url && item.url !== "#" && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[12.5px] text-ink-mute transition-colors hover:bg-rule-soft hover:text-ink"
              >
                Open
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
                  <path d="M4 2h6v6M10 2 2.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </a>
            )}
          </div>

          {error && <p className="mt-2 text-[12.5px] text-rust">{error}</p>}

          {explanation && (
            <dl className="anim-rise mt-3 space-y-2 border border-rule bg-paper px-3.5 py-3">
              {explanation
                .split("\n")
                .filter((l) => l.trim())
                .map((line, i) => {
                  const [head, ...rest] = line.split(":");
                  const body = rest.join(":").trim();
                  return body ? (
                    <div key={i} className="flex flex-wrap gap-x-2">
                      <dt className="font-mono text-[10.5px] text-ink-faint">{head.trim()}</dt>
                      <dd className="min-w-0 flex-1 text-[13px] text-ink-soft">{body}</dd>
                    </div>
                  ) : (
                    <p key={i} className="text-[13px] text-ink-soft">
                      {line}
                    </p>
                  );
                })}
              <div className="flex items-center gap-1.5 pt-1 text-[11px] text-ink-faint">
                <KindGlyph kind={item.kind} size={11} />
                reasoning generated for your profile
              </div>
            </dl>
          )}
        </div>
      </div>
    </li>
  );
}
