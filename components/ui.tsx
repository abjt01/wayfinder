"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useCountUp } from "@/lib/hooks";

/* ---------------- surfaces ---------------- */

export function Panel({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  return <Tag className={`border border-rule bg-card ${className}`}>{children}</Tag>;
}

export function PanelHead({
  title,
  meta,
  action,
  sub,
}: {
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="t-h2">{title}</h2>
        {sub && <p className="mt-0.5 text-[12.5px] text-ink-mute">{sub}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {meta && <span className="t-meta">{meta}</span>}
        {action}
      </div>
    </div>
  );
}

/* ---------------- controls ---------------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "quiet";
  size?: "sm" | "md";
  children: ReactNode;
};

export function Button({
  variant = "solid",
  size = "md",
  className = "",
  children,
  ...rest
}: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 disabled:cursor-not-allowed active:translate-y-px";
  const sizes = { sm: "px-2.5 py-1 text-[12.5px]", md: "px-3.5 py-2 text-[13.5px]" }[size];
  const variants = {
    solid: "bg-ink text-paper hover:bg-ink-soft disabled:bg-ink-faint",
    outline:
      "border border-ink text-ink hover:bg-ink hover:text-paper disabled:border-rule disabled:text-ink-faint disabled:hover:bg-transparent disabled:hover:text-ink-faint",
    quiet:
      "text-ink-mute hover:text-ink hover:bg-rule-soft disabled:text-ink-faint disabled:hover:bg-transparent",
  }[variant];
  return (
    <button className={`${base} ${sizes} ${variants} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Chip({
  children,
  onClick,
  active,
  tone = "neutral",
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  tone?: "neutral" | "rust" | "moss" | "ochre";
}) {
  const tones = {
    neutral: "border-rule bg-paper text-ink-mute",
    rust: "border-rust/35 bg-rust-soft text-rust",
    moss: "border-moss/30 bg-moss-soft text-moss",
    ochre: "border-ochre/30 bg-ochre-soft text-ochre",
  }[tone];
  const cls = `border px-2 py-0.5 font-mono text-[11px] transition-colors ${
    active ? "border-ink bg-ink text-paper" : tones
  }`;
  return onClick ? (
    <button onClick={onClick} className={`${cls} hover:border-ink hover:text-ink`}>
      {children}
    </button>
  ) : (
    <span className={cls}>{children}</span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] text-ink-mute">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "mt-1 w-full border border-rule bg-paper px-2.5 py-1.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink";

/* ---------------- data display ---------------- */

/** Segmented meter — reads as a printed scale, not a progress pill. */
export function Meter({
  value,
  segments = 24,
  tone = "ink",
}: {
  value: number;
  segments?: number;
  tone?: "ink" | "moss" | "rust";
}) {
  const animated = useCountUp(value, 800);
  const filled = Math.round((Math.min(100, Math.max(0, animated)) / 100) * segments);
  const fill = { ink: "bg-ink", moss: "bg-moss", rust: "bg-rust" }[tone];
  return (
    <div className="flex items-end gap-[2px]" aria-hidden>
      {Array.from({ length: segments }, (_, i) => {
        const on = i < filled;
        return (
          <span
            key={i}
            className={`w-full transition-colors duration-300 ${on ? fill : "bg-rule"}`}
            style={{ height: on ? 12 : 7 }}
          />
        );
      })}
    </div>
  );
}

/**
 * Thin progress track. The header, the milestone rail and the dashboard's
 * hours bar each hand-rolled this same absolutely-positioned fill.
 * Size it with `className`; the height and width belong to the caller.
 */
export function Bar({
  pct,
  tone = "ink",
  className = "",
}: {
  pct: number;
  tone?: "ink" | "moss";
  className?: string;
}) {
  return (
    <span className={`relative block bg-rule ${className}`}>
      <span
        className={`absolute inset-y-0 left-0 transition-all duration-500 ${
          tone === "moss" ? "bg-moss" : "bg-ink"
        }`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  suffix,
  animate = true,
}: {
  label: string;
  value: number | string;
  sub?: string;
  suffix?: string;
  animate?: boolean;
}) {
  const numeric = typeof value === "number" ? value : NaN;
  const counted = useCountUp(Number.isFinite(numeric) ? numeric : 0, 900);
  const isNumeric = typeof value === "number";
  const shown = isNumeric && animate ? Math.round(counted).toLocaleString() : String(value);
  return (
    <div className="min-w-0">
      <p className="t-meta">{label}</p>
      {/* Numbers get the full editorial size; word values are set smaller and
          allowed to wrap, so a long role name cannot overflow its grid cell. */}
      <p
        className={`t-num mt-1 ${
          isNumeric ? "text-[30px] leading-none" : "text-[19px] leading-snug break-words"
        }`}
      >
        {shown}
        {suffix && <span className="ml-0.5 text-[15px] text-ink-mute">{suffix}</span>}
      </p>
      {sub && <p className="mt-1 text-[12px] text-ink-mute">{sub}</p>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-ink-mute">
      <svg viewBox="0 0 16 16" className="spin h-3.5 w-3.5">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      {label}
    </span>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border border-rust/35 bg-rust-soft px-3.5 py-2.5 text-[13px] text-ink">
      <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rust">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.6v4.2M8 11.2v.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="px-8 py-14 text-center">
      <svg viewBox="0 0 72 40" className="mx-auto h-10 w-20 text-rule">
        <path
          d="M2 32 C 16 32, 18 10, 30 10 S 44 30, 56 30 S 68 18, 70 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <circle cx="2" cy="32" r="3" fill="currentColor" />
        <circle cx="70" cy="18" r="3" fill="currentColor" />
      </svg>
      <h2 className="t-h1 mt-5">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[13.5px] text-ink-mute">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </Panel>
  );
}

/* ---------------- page states ---------------- */

/* The same two wrappers were written out in four page files apiece, differing
   only in their copy. */

/** Full-page spinner, shown while localStorage hydrates. */
export function PageLoading({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-20 sm:px-5">
      <Spinner label={label} />
    </div>
  );
}

/** Full-page empty or error state. */
export function PageEmpty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-5">
      <Empty title={title} body={body} action={action} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="border border-rule bg-paper px-1.5 py-0.5 font-mono text-[10.5px] text-ink-mute">
      {children}
    </kbd>
  );
}
