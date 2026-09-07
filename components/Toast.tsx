"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = { id: number; text: string; tone: "ink" | "moss" };
type Ctx = { push: (text: string, tone?: Toast["tone"]) => void };

const ToastCtx = createContext<Ctx>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((text: string, tone: Toast["tone"] = "ink") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`anim-sheet pointer-events-auto max-w-[86vw] border px-3.5 py-2 text-[13px] shadow-[0_10px_30px_-18px_rgba(26,26,23,0.5)] ${
              t.tone === "moss" ? "border-moss/35 bg-moss-soft text-ink" : "border-ink bg-ink text-paper"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
