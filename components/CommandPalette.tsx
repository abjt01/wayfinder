"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Kbd } from "./ui";
import { useToast } from "./Toast";
import { useHotkeys, useScrollLock } from "@/lib/hooks";
import { pathProgress } from "@/lib/progress";
import { useStore } from "@/lib/store";
import { useAssistant } from "./AssistantHost";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const router = useRouter();
  const { push } = useToast();
  const assistant = useAssistant();
  const { path, completed, toggleComplete, reset } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useHotkeys([
    { key: "k", meta: true, run: () => setOpen((v) => !v) },
    { key: "/", run: () => setOpen(true) },
    // The palette focuses its own input on open, so Escape has to survive that.
    { key: "Escape", allowInInput: true, run: () => setOpen(false) },
  ]);
  useScrollLock(open);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const list: Cmd[] = [
      { id: "go-start", label: "Go to start", hint: "describe a goal", group: "Navigate", run: () => router.push("/") },
      { id: "go-path", label: "Go to learning path", group: "Navigate", run: () => router.push("/path") },
      { id: "go-dash", label: "Go to dashboard", group: "Navigate", run: () => router.push("/dashboard") },
      { id: "go-explore", label: "Browse the catalog", group: "Navigate", run: () => router.push("/explore") },
      {
        id: "ask",
        label: "Ask the assistant",
        hint: "opens the drawer",
        group: "Assistant",
        run: () => assistant.open(),
      },
      {
        id: "why-next",
        label: "Why is my next item recommended?",
        group: "Assistant",
        run: () => assistant.ask("Why is my next item recommended?"),
      },
      {
        id: "on-track",
        label: "Am I going to finish in time?",
        group: "Assistant",
        run: () => assistant.ask("Am I going to finish this in time?"),
      },
      {
        id: "skip",
        label: "What can I skip?",
        group: "Assistant",
        run: () => assistant.ask("What can I skip given what I already know?"),
      },
    ];

    if (path) {
      const { items, next } = pathProgress(path, completed);
      if (next) {
        list.push({
          id: "complete-next",
          label: `Mark complete: ${next.title}`,
          hint: `${next.hours}h`,
          group: "Progress",
          run: () => {
            toggleComplete(next.id);
            push(`Marked "${next.title}" complete`, "moss");
          },
        });
      }
      path.milestones.forEach((m, i) => {
        list.push({
          id: `jump-${m.id}`,
          label: `Jump to milestone ${i + 1}: ${m.title}`,
          group: "Path",
          run: () => {
            router.push("/path");
            setTimeout(() => document.getElementById(m.id)?.scrollIntoView({ block: "start" }), 60);
          },
        });
      });
      items.forEach((it) => {
        list.push({
          id: `item-${it.id}`,
          label: it.title,
          hint: `${it.kind} · ${it.hours}h`,
          group: "Resources",
          run: () => {
            router.push("/path");
            setTimeout(() => {
              const el = document.getElementById(`item-${it.id}`);
              el?.scrollIntoView({ block: "center" });
              el?.classList.add("anim-fade");
            }, 60);
          },
        });
      });
    }

    list.push({
      id: "reset",
      label: "Reset everything",
      hint: "clears profile, path and progress",
      group: "Danger",
      run: () => {
        reset();
        push("Cleared your profile and path");
        router.push("/");
      },
    });
    return list;
  }, [path, completed, router, toggleComplete, reset, push, assistant]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((c) => `${c.label} ${c.group} ${c.hint ?? ""}`.toLowerCase().includes(term));
  }, [commands, q]);

  useEffect(() => setCursor(0), [q]);

  if (!open) return null;

  const groups = filtered.reduce<Record<string, Cmd[]>>((acc, c) => {
    (acc[c.group] ||= []).push(c);
    return acc;
  }, {});
  const flat = Object.values(groups).flat();

  const runAt = (i: number) => {
    const cmd = flat[i];
    if (!cmd) return;
    setOpen(false);
    cmd.run();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
      <button
        className="absolute inset-0 bg-ink/25"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="anim-sheet relative w-full max-w-xl border border-ink bg-card shadow-[0_30px_70px_-30px_rgba(26,26,23,0.55)]"
      >
        <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-faint">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.8 10.8 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search commands, milestones, resources…"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-faint"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(flat.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runAt(cursor);
              }
            }}
          />
          <Kbd>esc</Kbd>
        </div>

        <div className="thin-scroll max-h-[52vh] overflow-y-auto py-1">
          {flat.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-ink-faint">No matches.</p>}
          {Object.entries(groups).map(([group, cmds]) => (
            <div key={group} className="py-1">
              <p className="px-4 pb-1 font-mono text-[10.5px] text-ink-faint">{group}</p>
              {cmds.map((c) => {
                const i = flat.indexOf(c);
                const on = i === cursor;
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => runAt(i)}
                    className={`flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left text-[13.5px] transition-colors ${
                      on ? "bg-ink text-paper" : "text-ink hover:bg-paper"
                    }`}
                  >
                    <span className="truncate">{c.label}</span>
                    {c.hint && (
                      <span className={`shrink-0 font-mono text-[10.5px] ${on ? "text-paper/70" : "text-ink-faint"}`}>
                        {c.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-rule px-4 py-2 text-[11px] text-ink-faint">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> run
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd> toggle
          </span>
        </div>
      </div>
    </div>
  );
}
