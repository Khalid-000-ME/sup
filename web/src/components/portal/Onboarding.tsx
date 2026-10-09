"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, CircleAlert, Coins, ExternalLink, KeyRound, Wallet } from "lucide-react";
import { Glow, Mark } from "../ui/deco";
import { Spinner } from "../ui";
import { SUP_PERSONAS, type SupRole } from "@/lib/sup/personas";
import { useSupState } from "@/lib/sup/client";
import { connectWallet, shortParty, useWallet } from "@/lib/client/wallet";
import { fmt, fmtAmount } from "@/lib/shared/format";
import { CopyText, Field, Label } from "./kit";
import { useAct } from "./useAct";
import type { PortalRole } from "./PortalShell";

interface Check {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
}

type StepKey = "signin" | "verify" | "bond" | "fund" | "ready";

const STEPS: Record<PortalRole, { key: StepKey; label: string }[]> = {
  seller: [
    { key: "signin", label: "Sign in" },
    { key: "verify", label: "Verify" },
    { key: "bond", label: "First bond" },
    { key: "ready", label: "Ready" },
  ],
  buyer: [
    { key: "signin", label: "Sign in" },
    { key: "verify", label: "Verify" },
    { key: "fund", label: "Fund" },
    { key: "ready", label: "Ready" },
  ],
  agent: [
    { key: "signin", label: "Sign in" },
    { key: "verify", label: "Verify" },
    { key: "ready", label: "Ready" },
  ],
};

const HEAD: Record<PortalRole, string> = {
  seller: "Set up your selling desk",
  buyer: "Set up your buying desk",
  agent: "Set up your confirmation desk",
};

export function Onboarding({ role }: { role: PortalRole }) {
  const router = useRouter();
  const steps = STEPS[role];
  const [idx, setIdx] = useState(0);
  const [reached, setReached] = useState(0);
  const [verified, setVerified] = useState(false);

  const go = useCallback(
    (i: number) => {
      setIdx(i);
      setReached((r) => Math.max(r, i));
    },
    [setIdx, setReached],
  );
  const next = useCallback(() => go(Math.min(idx + 1, steps.length - 1)), [go, idx, steps.length]);
  const key = steps[idx].key;

  return (
    <div className="relative mx-auto max-w-[640px] pb-10 pt-4">
      <Glow className="left-1/2 top-10 h-[24rem] w-[40rem] -translate-x-1/2" intensity={0.16} />
      <div className="relative">
        <Mark size={44} className="mx-auto mb-6 text-white" />
        <h1 className="font-display text-center text-[30px] font-light tracking-[-0.02em] md:text-[38px]">{HEAD[role]}</h1>

        <div role="tablist" aria-label="Onboarding steps" className="mx-auto mt-9 flex items-center justify-center gap-1.5">
          {steps.map((s, i) => {
            const state = i < idx ? "done" : i === idx ? "active" : "todo";
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={i === idx}
                disabled={i > reached}
                onClick={() => setIdx(i)}
                className={clsx(
                  "num flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] transition-colors",
                  state === "active" && "border-accent bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-ink",
                  state === "done" && "border-line-strong text-ink2 hover:text-ink",
                  state === "todo" && "border-line text-muted",
                )}
              >
                {state === "done" ? <Check size={12} className="text-ok" /> : <span className="text-muted">{i + 1}</span>}
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="relative mt-8 overflow-hidden rounded-[20px] border border-line-strong bg-s1 shadow-[var(--e-2)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={key}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="p-7 md:p-9"
            >
              {key === "signin" && <SignIn role={role} onDone={next} />}
              {key === "verify" && <Verify role={role} onDone={() => (setVerified(true), next())} verified={verified} />}
              {key === "bond" && <FirstBond onDone={next} />}
              {key === "fund" && <Fund onDone={next} />}
              {key === "ready" && <Ready role={role} onOpen={(to) => router.push(to)} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StepTitle({ title, body }: { title: string; body?: ReactNode }) {
  return (
    <div className="mb-7">
      <h2 className="font-display text-[24px] font-light tracking-tight">{title}</h2>
      {body && <p className="mt-2 text-[14px] leading-relaxed text-ink2">{body}</p>}
    </div>
  );
}

/* --------------------------------------------------------------- sign in */

function SignIn({ role, onDone }: { role: PortalRole; onDone: () => void }) {
  const p = SUP_PERSONAS[role as SupRole];
  const wallet = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connect() {
    setErr(null);
    setConnecting(true);
    try {
      await connectWallet();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not connect a wallet.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <>
      <StepTitle title={`Sign in as ${p.label.toLowerCase()}`} />
      <button
        onClick={onDone}
        className="group flex w-full items-center gap-4 border border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-bg" style={{ background: p.color }}>
          {p.label[0]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Continue as {p.label}</span>
          <span className="num mt-0.5 block text-[11.5px] text-muted">One click. No wallet needed.</span>
        </span>
        <ArrowRight size={17} className="shrink-0 text-accent transition-transform group-hover:translate-x-0.5" />
      </button>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted">
        {wallet ? (
          <span className="num inline-flex items-center gap-2 text-ok">
            <Wallet size={14} /> Wallet connected {shortParty(wallet.partyId)}
          </span>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            className="num inline-flex items-center gap-2 text-ink2 transition-colors hover:text-ink disabled:opacity-60"
          >
            {connecting ? <Spinner /> : <Wallet size={14} />} Use a Canton wallet instead
          </button>
        )}
        <span className="flex items-center gap-2">
          <KeyRound size={13} /> A wallet only identifies you. Trades are submitted by the {p.label.toLowerCase()} desk.
        </span>
      </div>
      {err && (
        <p className="mt-4 flex gap-2.5 border border-[color-mix(in_srgb,var(--bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] p-3 text-[13px]">
          <CircleAlert size={15} className="mt-0.5 shrink-0 text-bad" /> {err}
        </p>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- verify */

function Verify({ role, onDone, verified }: { role: PortalRole; onDone: () => void; verified: boolean }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shown, setShown] = useState(0);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    fetch("/api/sup/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ as: role }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Verification failed");
        if (live) setChecks(j.checks as Check[]);
      })
      .catch((e) => live && setErr(e instanceof Error ? e.message : "Verification failed"));
    return () => {
      live = false;
    };
  }, [role, attempt]);

  const retry = () => {
    setErr(null);
    setChecks(null);
    setShown(0);
    setAttempt((n) => n + 1);
  };

  // reveal the results one by one so the checks read as a sequence, not a wall
  useEffect(() => {
    if (!checks || shown >= checks.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 420);
    return () => clearTimeout(t);
  }, [checks, shown]);

  const allShown = checks && shown >= checks.length;
  const allOk = !!checks?.every((c) => c.ok);

  return (
    <>
      <StepTitle title="Checking your connection to Canton" body="Each check queries the ledger as your party." />
      <ul className="space-y-2.5">
        {err && (
          <li className="flex items-start gap-3 rounded-[12px] border border-[color-mix(in_srgb,var(--bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] p-4 text-[13.5px]">
            <CircleAlert size={17} className="mt-0.5 shrink-0 text-bad" /> {err}
          </li>
        )}
        {!checks && !err && (
          <li className="flex items-center gap-3 rounded-[12px] border border-line bg-bg p-4 text-[13.5px] text-ink2">
            <Spinner /> Contacting the participant…
          </li>
        )}
        {checks?.slice(0, shown).map((c) => (
          <motion.li
            key={c.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-[12px] border border-line bg-bg p-4"
          >
            <span
              className={clsx(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                c.ok ? "bg-[color-mix(in_srgb,var(--ok)_18%,transparent)] text-ok" : "bg-[color-mix(in_srgb,var(--bad)_18%,transparent)] text-bad",
              )}
            >
              {c.ok ? <Check size={13} /> : <CircleAlert size={13} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px]">{c.label}</span>
              <span className="num mt-0.5 block truncate text-[11.5px] text-muted">{c.detail}</span>
            </span>
          </motion.li>
        ))}
      </ul>
      <div className="mt-7 flex justify-end gap-2.5">
        {(err || (allShown && !allOk)) && (
          <button className="btn num !px-5" onClick={retry}>
            Try again
          </button>
        )}
        <button
          className="btn btn-primary num !px-5"
          disabled={!allShown || !allOk}
          onClick={onDone}
        >
          Continue <ArrowRight size={15} />
        </button>
      </div>
      {verified && <span className="sr-only">Previously verified</span>}
    </>
  );
}

/* -------------------------------------------------------------- first bond */

function FirstBond({ onDone }: { onDone: () => void }) {
  const { data } = useSupState("seller");
  const { act, busy } = useAct("seller");
  const bonds = data?.bonds ?? [];
  const [pick, setPick] = useState<string | null>(null);
  const [qty, setQty] = useState("100");
  const sel = pick ?? bonds[0]?.symbol;
  const held = (sym: string) => data?.assets.filter((a) => a.label === sym).reduce((s, a) => s + a.quantity, 0) ?? 0;
  const n = Number(qty);

  return (
    <>
      <StepTitle title="Pick a bond to sell" body="Issue some units to your account now, or skip and define your own bond later." />
      <div className="space-y-2">
        {bonds.map((b) => (
          <button
            key={b.symbol}
            onClick={() => setPick(b.symbol)}
            className={clsx(
              "flex w-full items-center gap-3 rounded-[12px] border p-4 text-left transition-colors",
              sel === b.symbol ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : "border-line bg-bg hover:border-line-strong",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="num block text-[14px] font-semibold">{b.symbol}</span>
              <span className="mt-0.5 block text-[12.5px] text-ink2">
                {b.name} · {b.couponPct}% · matures {b.maturity}
              </span>
            </span>
            <span className="num text-[12px] text-muted">{fmt(held(b.symbol), 0)} held</span>
          </button>
        ))}
      </div>
      <div className="mt-5">
        <Field label="Units to issue">
          <input className="input num" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))} />
        </Field>
      </div>
      <div className="mt-7 flex justify-between gap-2.5">
        <button className="btn num !px-5" onClick={onDone}>
          Skip for now
        </button>
        <button
          className="btn btn-primary num !px-5"
          disabled={!sel || !(n > 0) || busy !== null}
          onClick={async () => {
            const r = await act("issue", { type: "faucet", asset: "asset", amount: n, assetClass: sel }, { quiet: true });
            if (r) onDone();
          }}
        >
          {busy ? <Spinner /> : <Coins size={15} />} Issue and continue
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ fund */

function Fund({ onDone }: { onDone: () => void }) {
  const { data } = useSupState("buyer");
  const { act, busy } = useAct("buyer");
  const cash = data?.cash.reduce((s, h) => s + h.quantity, 0) ?? 0;
  const devnet = data?.ledger.network === "devnet";
  const cbtc = data?.external?.CBTC?.unlocked ?? 0;
  return (
    <>
      <StepTitle title="Add funds to pay with" body="Pay in any of these. Add whichever you plan to use." />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border border-line bg-bg p-4">
          <Label>CashUSD</Label>
          <div className="num mt-2 text-[22px] font-medium">{fmt(cash, 0)}</div>
          <div className="mt-0.5 text-[12px] text-muted">test stablecoin</div>
          <button
            className="btn btn-sm num mt-4 w-full"
            disabled={busy !== null}
            onClick={() => act("cash", { type: "faucet", asset: "cash", amount: 100000 })}
          >
            {busy === "cash" ? <Spinner /> : <Coins size={13} />} Add 100,000
          </button>
        </div>
        <div className={clsx("border border-line bg-bg p-4", !devnet && "opacity-60")}>
          <Label>Canton Coin</Label>
          <div className="num mt-2 text-[22px] font-medium">{fmt(data?.amulet?.unlocked ?? 0, 0)}</div>
          <div className="mt-0.5 text-[12px] text-muted">real DevNet coin</div>
          <button
            className="btn btn-sm num mt-4 w-full"
            disabled={busy !== null || !devnet}
            onClick={() => act("cc", { type: "faucet", asset: "amulet", amount: 1000 })}
          >
            {busy === "cc" ? <Spinner /> : <Coins size={13} />} Add 1,000 CC
          </button>
        </div>
        <div className={clsx("border border-line bg-bg p-4", !devnet && "opacity-60")}>
          <Label>CBTC</Label>
          <div className="num mt-2 text-[22px] font-medium">{fmtAmount(cbtc)}</div>
          <div className="mt-0.5 text-[12px] text-muted">real BitSafe CBTC</div>
          <a
            href="https://cbtc-faucet.bitsafe.finance/"
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm num mt-4 w-full"
          >
            Open faucet <ExternalLink size={12} />
          </a>
          <button
            className="num mt-2 w-full text-[11.5px] text-ink2 transition-colors hover:text-ink disabled:opacity-60"
            disabled={busy !== null || !devnet}
            onClick={() => act("cbtc", { type: "claim", instrument: "cbtc" })}
          >
            {busy === "cbtc" ? "Checking…" : "I requested it, claim now"}
          </button>
        </div>
      </div>
      {devnet && data?.party && (
        <p className="mt-4 text-[12px] text-muted">
          Faucet recipient party:{" "}
          <CopyText text={data.party} shown={shortParty(data.party)} className="text-ink2" />. Pick the Devnet tab.
        </p>
      )}
      <div className="mt-7 flex justify-end">
        <button className="btn btn-primary num !px-5" onClick={onDone}>
          Continue <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- ready */

function Ready({ role, onOpen }: { role: PortalRole; onOpen: (to: string) => void }) {
  const copy: Record<PortalRole, { body: string; to: string; cta: string }> = {
    seller: { body: "Your desk is live. Create a proposal and your buyer sees it immediately.", to: "/seller", cta: "Open my trades" },
    buyer: { body: "Your desk is live. Open offers appear on the market ranked by price.", to: "/buyer", cta: "Open the market" },
    agent: { body: "You will see a delivery reference and two names for each trade. Nothing else.", to: "/agent", cta: "Open confirmations" },
  };
  const c = copy[role];
  return (
    <div className="py-4 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ok)_16%,transparent)] text-ok"
      >
        <Check size={26} />
      </motion.div>
      <h2 className="font-display mt-6 text-[26px] font-light tracking-tight">You are connected</h2>
      <p className="mx-auto mt-3 max-w-[40ch] text-[14.5px] text-ink2">{c.body}</p>
      <button className="btn btn-primary num mt-8 !px-6" onClick={() => onOpen(c.to)}>
        {c.cta} <ArrowRight size={15} />
      </button>
    </div>
  );
}
