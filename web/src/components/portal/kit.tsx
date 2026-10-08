"use client";

import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, X } from "lucide-react";
import { Glow } from "../ui/deco";

/* Shared building blocks for the seller, buyer and agent portals. They reuse the
   landing page's vocabulary: hairline frames, violet blooms, mono labels. */

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-8">
      <div className="min-w-0">
        <h1 className="font-display text-[30px] font-light leading-tight tracking-[-0.02em] md:text-[38px]">{title}</h1>
        {sub && <p className="mt-2 max-w-[60ch] text-[14.5px] text-ink2">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function Panel({
  children,
  className,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={clsx("relative overflow-hidden rounded-[16px] border border-line bg-s1", className)}>
      {glow && <Glow className="-right-16 -top-24 h-[18rem] w-[22rem]" intensity={0.2} />}
      <div className="relative">{children}</div>
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="num text-[10px] uppercase tracking-[0.18em] text-muted">{children}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "warn" }) {
  return (
    <div className="bg-bg px-6 py-5">
      <Label>{label}</Label>
      <div
        className={clsx(
          "num mt-2.5 text-[26px] font-medium leading-none tracking-tight",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

/** Stats laid out as hairline-separated cells, like the landing's counters. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-line bg-line md:grid-cols-4">{children}</div>
  );
}

type Tone = "default" | "ok" | "warn" | "bad" | "accent";
const TONES: Record<Tone, string> = {
  default: "border-line-strong text-ink2 bg-s2",
  ok: "border-[color-mix(in_srgb,var(--ok)_35%,transparent)] text-ok bg-[color-mix(in_srgb,var(--ok)_10%,transparent)]",
  warn: "border-[color-mix(in_srgb,var(--warn)_35%,transparent)] text-warn bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]",
  bad: "border-[color-mix(in_srgb,var(--bad)_35%,transparent)] text-bad bg-[color-mix(in_srgb,var(--bad)_10%,transparent)]",
  accent:
    "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] text-accent-soft bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]",
};

export function Pill({ tone = "default", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "num inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-medium",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className="inline-flex rounded-full border border-line-strong bg-s1 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "num rounded-full transition-colors",
            size === "sm" ? "px-3 py-1 text-[11.5px]" : "px-4 py-1.5 text-[12.5px]",
            value === o.value ? "bg-ink font-semibold text-bg" : "text-ink2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
      {hint && <div className="mt-1.5 text-[12px] text-muted">{hint}</div>}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  body?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-[12px] border border-line bg-bg p-3.5 text-left transition-colors hover:border-line-strong"
    >
      <span
        className={clsx(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-[#3a3d4d]",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink">{title}</span>
        {body && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{body}</span>}
      </span>
    </button>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="font-display text-[20px] font-light">{title}</div>
      {body && <p className="mt-2 max-w-[44ch] text-[14px] text-ink2">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[rgba(4,4,8,0.78)] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={{ maxWidth: width }}
            className="relative my-auto w-full overflow-hidden rounded-[20px] border border-line-strong bg-s1 shadow-[var(--e-3)]"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <Glow className="-right-20 -top-28 h-[18rem] w-[22rem]" intensity={0.22} />
            <div className="relative flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="font-display text-[19px] font-light tracking-tight">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted transition-colors hover:text-ink">
                <X size={17} />
              </button>
            </div>
            <div className="relative p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CopyText({ text, shown, className }: { text: string; shown?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      className={clsx("num group inline-flex max-w-full items-center gap-1.5 text-left hover:text-ink", className)}
    >
      <span className="truncate">{shown ?? text}</span>
      {done ? <Check size={12} className="shrink-0 text-ok" /> : <Copy size={12} className="shrink-0 opacity-50 group-hover:opacity-100" />}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}
