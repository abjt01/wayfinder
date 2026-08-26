"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MdLite } from "@/lib/mdlite";
import { Button, Kbd, Spinner } from "./ui";
import { useHotkeys, useScrollLock } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

type Ctx = {
  open: () => void;
  close: () => void;
  ask: (q: string) => void;
  isOpen: boolean;
};

const AssistantCtx = createContext<Ctx>({
  open: () => {},
  close: () => {},
  ask: () => {},
  isOpen: false,
});

export const useAssistant = () => useContext(AssistantCtx);

const STARTERS = [
  "Why is this the right first step for me?",
  "What can I skip given what I already know?",
  "Am I going to finish this in time?",
  "Make the path more project-heavy.",
];

/**
 * Assistant lives in a slide-over drawer so it is reachable from every page
 * and keeps its transcript across navigation.
 */
export function AssistantHost({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [engine, setEngine] = useState<string>("");
  const { profile, path, completed, chat, setChat } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setError("");
      setInput("");
      const history: ChatMessage[] = [...useStore.getState().chat, { role: "user", content: question }];
      setChat(history);
      setBusy(true);
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, profile, path, completed }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({ error: "The assistant is unavailable." }));
          throw new Error((data as { error?: string }).error ?? "The assistant is unavailable.");
        }
        setEngine(res.headers.get("X-Engine") ?? "");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        setChat([...history, { role: "assistant", content: "" }]);
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setChat([...history, { role: "assistant", content: acc }]);
          scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
        }
        if (!acc.trim()) {
          setChat([...history, { role: "assistant", content: "No answer came back. Try asking again." }]);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
          setChat(history);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, completed, path, profile, setChat]
  );

  const value = useMemo<Ctx>(
    () => ({
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      ask: (q: string) => {
        setOpen(true);
        void send(q);
      },
    }),
    [isOpen, send]
  );

  useHotkeys([
    { key: "j", meta: true, run: () => setOpen((v) => !v) },
    { key: "a", run: () => setOpen(true) },
  ]);
  useScrollLock(isOpen);

  return (
    <AssistantCtx.Provider value={value}>
      {children}

      {/* dock trigger */}
      {!isOpen && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 border border-ink bg-ink px-3.5 py-2.5 text-[13px] text-paper shadow-[0_14px_34px_-18px_rgba(26,26,23,0.7)] transition-transform hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
            <path
              d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          Ask the assistant
          <span className="hidden sm:inline">
            <Kbd>A</Kbd>
          </span>
        </button>
      )}

      {isOpen && (
        <>
          <button
            className="fixed inset-0 z-[70] bg-ink/20"
            aria-label="Close assistant"
            onClick={() => setOpen(false)}
          />
          <aside
            className="anim-sheet fixed right-0 top-0 z-[75] flex h-full w-full max-w-[440px] flex-col border-l border-ink bg-card"
            role="dialog"
            aria-label="Learning assistant"
          >
            <div className="flex items-start justify-between gap-3 border-b border-rule px-5 py-3.5">
              <div>
                <h2 className="t-h2">Assistant</h2>
                <p className="text-[12px] text-ink-mute">
                  Sees your profile, path and progress
                  {engine ? ` · ${engine === "local" ? "local engine" : "Groq"}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {chat.length > 0 && (
                  <Button variant="quiet" size="sm" onClick={() => setChat([])}>
                    Clear
                  </Button>
                )}
                <Button variant="quiet" size="sm" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </div>

            <div ref={scroller} className="thin-scroll flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {chat.length === 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] text-ink-mute">
                    {path ? "Ask about anything in your path:" : "Generate a path first, or ask a general question:"}
                  </p>
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="lift block w-full border border-rule bg-paper px-3 py-2 text-left text-[13px] text-ink-soft"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {chat.map((m, i) => {
                const streaming = busy && i === chat.length - 1 && m.role === "assistant";
                return m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[85%] border border-ink bg-ink px-3 py-2 text-[13px] text-paper">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="border-l-2 border-rule pl-3">
                    {m.content ? (
                      <div className={streaming ? "caret" : ""}>
                        <MdLite text={m.content} />
                      </div>
                    ) : (
                      <Spinner label="Thinking" />
                    )}
                  </div>
                );
              })}

              {error && <p className="border border-rust/40 bg-rust-soft px-3 py-2 text-[13px]">{error}</p>}
            </div>

            <form
              className="border-t border-rule px-4 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  rows={2}
                  placeholder="Ask why something was recommended…"
                  className="thin-scroll flex-1 resize-none border border-rule bg-paper px-2.5 py-2 text-[13.5px] outline-none focus:border-ink"
                />
                <Button type="submit" disabled={busy || !input.trim()}>
                  {busy ? "…" : "Send"}
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-ink-faint">
                <Kbd>↵</Kbd> send · <Kbd>shift</Kbd>+<Kbd>↵</Kbd> newline · <Kbd>⌘</Kbd>
                <Kbd>J</Kbd> toggle
              </p>
            </form>
          </aside>
        </>
      )}
    </AssistantCtx.Provider>
  );
}
