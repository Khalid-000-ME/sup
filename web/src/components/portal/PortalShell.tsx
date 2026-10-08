"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronDown, LogOut, RotateCcw, Unplug } from "lucide-react";
import { disconnectWallet, shortParty, useWallet } from "@/lib/client/wallet";
import { Cross, Glow, Mark } from "../ui/deco";
import { SUP_PERSONAS, type SupRole } from "@/lib/sup/personas";
import { useSupState } from "@/lib/sup/client";
import { fmt, fmtAmount } from "@/lib/shared/format";

export type PortalRole = "seller" | "buyer" | "agent";

const NAV: Record<PortalRole, { href: string; label: string }[]> = {
  seller: [
    { href: "/seller", label: "Trades" },
    { href: "/seller/bonds", label: "Bonds" },
    { href: "/seller/analytics", label: "Analytics" },
  ],
  buyer: [
    { href: "/buyer", label: "Market" },
    { href: "/buyer/trades", label: "My trades" },
    { href: "/buyer/analytics", label: "Analytics" },
  ],
  agent: [{ href: "/agent", label: "Confirmations" }],
};

function isActive(path: string, href: string, role: PortalRole) {
  if (href === `/${role}`) return path === href || path.startsWith(`/${role}/trades`) && role === "seller";
  return path === href || path.startsWith(href + "/");
}

export function PortalShell({ role, children }: { role: PortalRole; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { data: state } = useSupState(role as SupRole);
  const persona = SUP_PERSONAS[role as SupRole];
  const onboarding = path.endsWith("/onboard");

  // A party that has not been through onboarding goes there first.
  useEffect(() => {
    if (state && state.onboardedAt === null && !onboarding) router.replace(`/${role}/onboard`);
  }, [state, onboarding, role, router]);

  const cash = state?.cash.reduce((s, h) => s + h.quantity, 0) ?? 0;
  const cc = state?.amulet?.unlocked ?? 0;

  return (
    <div className="relative min-h-[100dvh]">
      <span aria-hidden className="grain pointer-events-none fixed inset-0 z-[60]" />
      <header className="sticky top-0 z-30 border-b border-line bg-[rgba(8,8,12,0.9)]">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-5 md:px-10">
          <Link href="/" className="flex items-center gap-2" aria-label="Sup">
            <Mark size={26} className="text-white" />
            <span className="text-[15px] font-bold tracking-tight">Sup</span>
          </Link>

          {!onboarding && (
            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-full border border-line-strong bg-s1 p-1 md:flex">
              {NAV[role].map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={clsx(
                    "num rounded-full px-4 py-1.5 text-[12.5px] transition-colors",
                    isActive(path, n.href, role) ? "bg-ink font-semibold text-bg" : "text-ink2 hover:text-ink",
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2.5">
            {!onboarding && role !== "agent" && state && (
              <div className="num hidden items-center gap-3 rounded-full border border-line px-3.5 py-1.5 text-[12px] text-ink2 lg:flex">
                <span>
                  {fmt(cash, 0)} <span className="text-muted">CashUSD</span>
                </span>
                {state.ledger.network === "devnet" && (
                  <span>
                    {fmt(cc, 0)} <span className="text-muted">CC</span>
                  </span>
                )}
                {(state.external?.CBTC?.unlocked ?? 0) > 0 && (
                  <span>
                    {fmtAmount(state.external!.CBTC.unlocked)} <span className="text-muted">CBTC</span>
                  </span>
                )}
              </div>
            )}
            <IdentityMenu role={role} label={persona.label} />
          </div>
        </div>
        {/* mobile nav */}
        {!onboarding && (
          <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 md:hidden">
            {NAV[role].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "num whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px]",
                  isActive(path, n.href, role) ? "bg-ink font-semibold text-bg" : "text-ink2",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <div className="relative">
        <Glow className="left-1/2 top-[-14rem] h-[30rem] w-[56rem] -translate-x-1/2" intensity={0.1} />
        <main className="relative mx-auto max-w-[1280px] px-5 md:px-10">
          <div className="relative min-h-[calc(100dvh-4rem)] border-x border-line px-5 py-10 md:px-10 md:py-12">
            <Cross className="-left-[5px] -top-[5px]" />
            <Cross className="-right-[5px] -top-[5px]" />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function IdentityMenu({ role, label }: { role: PortalRole; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const wallet = useWallet();
  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", on);
    return () => window.removeEventListener("mousedown", on);
  }, [open]);
  const item = "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] text-ink2 transition-colors hover:bg-s2 hover:text-ink";
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-line-strong bg-s1 py-1 pl-1 pr-3 transition-colors hover:border-[#3b3e4e]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-bg"
          style={{ background: SUP_PERSONAS[role as SupRole].color }}
        >
          {label[0]}
        </span>
        <span className="num hidden text-[12px] sm:block">{label}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-[14px] border border-line-strong bg-s1 p-1.5 shadow-[var(--e-3)]"
        >
          <div className="px-3 pb-2 pt-1.5">
            <div className="text-[13px] font-medium">{label}</div>
            <div className="num text-[11px] text-muted">{SUP_PERSONAS[role as SupRole].role}</div>
            {wallet && <div className="num mt-1.5 truncate text-[11px] text-ok">Wallet {shortParty(wallet.partyId)}</div>}
          </div>
          <div className="my-1 border-t border-line" />
          <Link href={`/${role}/onboard`} className={item} onClick={() => setOpen(false)}>
            <RotateCcw size={14} /> Replay onboarding
          </Link>
          {wallet && (
            <button className={item} onClick={() => (setOpen(false), void disconnectWallet())}>
              <Unplug size={14} /> Disconnect wallet
            </button>
          )}
          <Link href="/start" className={item} onClick={() => setOpen(false)}>
            <LogOut size={14} /> Switch role
          </Link>
        </div>
      )}
    </div>
  );
}
