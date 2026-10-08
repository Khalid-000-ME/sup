"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

export function Chip({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "ok" | "warn" | "bad" | "veil"; className?: string }) {
  const tones: Record<string, string> = {
    default: "",
    ok: "!border-[#1f6e55] !text-[#5fe3b3] bg-[#0c2a21]",
    warn: "!border-[#7a5a17] !text-[#f5c867] bg-[#2a2109]",
    bad: "!border-[#7b2f35] !text-[#f58a91] bg-[#2b1013]",
    veil: "!border-[#5546b8] !text-[#bdb0ff] bg-[#191338]",
  };
  return <span className={clsx("chip", tones[tone], className)}>{children}</span>;
}

export function Card({ children, className, title, right, id }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <section id={id} className={clsx("card p-4 sm:p-5", className)}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          <h3 className="eyebrow">{title}</h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="eyebrow">{label}</div>
      <div className="tabular mt-1 text-xl font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line2 px-6 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div className="text-sm font-semibold text-ink2">{title}</div>
      {children && <div className="max-w-md text-xs leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx("animate-spin", className)} width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
