"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Adds `is-in` once the element scrolls into view. Pair with `.reveal`.
 *
 * This is a **callback ref**, not an object ref, on purpose: the elements that
 * use it are conditionally rendered (they appear only after a profile exists),
 * so an effect keyed on `[]` would run while the ref is still null and the
 * observer would never attach — leaving `.reveal`'s `opacity: 0` permanent and
 * the content invisible. A callback ref fires whenever the node appears.
 *
 * A timer also force-reveals the node shortly after it mounts, so a missed or
 * never-firing IntersectionObserver can never hide content for good.
 */
const REVEAL_FAILSAFE_MS = 1200;

export function useReveal<T extends HTMLElement = HTMLElement>() {
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  return useCallback((el: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;

    const show = () => el.classList.add("is-in");

    if (typeof IntersectionObserver === "undefined") {
      show();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );
    io.observe(el);

    // Failsafe: content must never stay invisible because an observer misfired.
    const timer = setTimeout(show, REVEAL_FAILSAFE_MS);

    cleanup.current = () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, []);
}

/** Eases a number up to `value` whenever it changes. */
export function useCountUp(value: number, duration = 900) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(origin + (value - origin) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return display;
}

/** Tracks which of the given element ids is currently in view. */
export function useScrollSpy(ids: string[], offset = 140) {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    if (!ids.length) return;
    const onScroll = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - offset <= 0) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids, offset]);
  return active;
}

type Combo = {
  key: string;
  meta?: boolean;
  shift?: boolean;
  /** Fire even while a text field has focus — for dismiss keys like Escape. */
  allowInInput?: boolean;
  run: () => void;
};

export function useHotkeys(combos: Combo[]) {
  const ref = useRef(combos);
  ref.current = combos;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      for (const c of ref.current) {
        const metaOk = c.meta ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey;
        const shiftOk = c.shift ? e.shiftKey : true;
        if (e.key.toLowerCase() === c.key.toLowerCase() && metaOk && shiftOk) {
          if (typing && !c.meta && !c.allowInInput) continue;
          e.preventDefault();
          c.run();
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Locks body scroll while an overlay is open. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

export function useIsMac() {
  const [mac, setMac] = useState(true);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  return mac;
}

/** Fetch helper with abort + typed error, shared by every client call. */
export function usePost<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  const post = useCallback(async (url: string, body: unknown): Promise<T | null> => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status}).`);
      return data as T;
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => () => abort.current?.abort(), []);
  return { post, loading, error, setError };
}
