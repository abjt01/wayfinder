"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Kbd } from "./ui";
import { useStore } from "@/lib/store";

const LINKS = [
  { href: "/", label: "Start" },
  { href: "/path", label: "Path" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/explore", label: "Catalog" },
];

type Health = { engine: "groq" | "local"; model: string; catalogSize: number };

export function Header() {
  const pathname = usePathname();
  const { path, completed } = useStore();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => alive && setHealth(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const items = path?.milestones.flatMap((m) => m.items) ?? [];
  const pct = items.length ? Math.round((items.filter((i) => completed.includes(i.id)).length / items.length) * 100) : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/92 backdrop-blur-[2px]">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-5 px-5">
        <Link href="/" className="flex shrink-0 items-baseline gap-2">
          <svg viewBox="0 0 22 22" className="h-[18px] w-[18px] text-ink" aria-hidden>
            <path d="M2 18 C 7 18, 6 6, 11 6 S 15 14, 20 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="2" cy="18" r="2" fill="currentColor" />
            <circle cx="20" cy="4" r="2" fill="currentColor" />
          </svg>
          <span className="font-display text-[17px] font-medium">Wayfinder</span>
        </Link>

        <nav className="flex items-center gap-0.5 text-[13px]">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative px-2.5 py-1.5 transition-colors ${
                  active ? "text-ink" : "text-ink-mute hover:text-ink"
                }`}
              >
                {l.label}
                {active && <span className="absolute inset-x-2.5 -bottom-[1px] h-[2px] bg-ink" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {path && (
            <div className="hidden items-center gap-2 sm:flex" title="Path completion">
              <span className="relative h-[4px] w-20 bg-rule">
                <span
                  className="absolute inset-y-0 left-0 bg-ink transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="t-meta">{pct}%</span>
            </div>
          )}
          {health && (
            <span
              className="t-meta hidden md:inline"
              title={health.engine === "groq" ? `Groq · ${health.model}` : "No GROQ_API_KEY — deterministic local engine"}
            >
              {health.engine === "groq" ? "groq" : "local engine"}
            </span>
          )}
          <span className="hidden items-center gap-1 lg:flex">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-rule bg-card">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-5 py-5 text-[12px] text-ink-mute">
        <p>
          Wayfinder — recommendations are retrieved from a local course catalog, then sequenced and
          explained. Nothing is invented.
        </p>
        <p className="t-meta">
          <Kbd>⌘K</Kbd> commands · <Kbd>A</Kbd> assistant
        </p>
      </div>
    </footer>
  );
}
