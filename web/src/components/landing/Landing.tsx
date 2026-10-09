"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { Glow } from "../ui/deco";
import Grainient from "../Grainient";
import { Card, CardGrid, Closing, Container, Footer, Framed, Heading, LANDING_LINKS, Nav } from "./parts";

/* ------------------------------------------------------------------- hero */

function Hero() {
  return (
    <div className="relative overflow-hidden">
      {/* mesh gradient sampled from the reference: blue body, lavender-pink glow, black falloff */}
      <div aria-hidden className="absolute inset-0">
        <Grainient
          color1="#e6c6ea"
          color2="#3f67c9"
          color3="#05060b"
          timeSpeed={0.18}
          colorBalance={0.0}
          warpStrength={1.1}
          warpFrequency={4.2}
          warpSpeed={1.4}
          warpAmplitude={60}
          blendAngle={-12}
          blendSoftness={0.55}
          rotationAmount={420}
          noiseScale={1.6}
          grainAmount={0.07}
          grainScale={2}
          contrast={1.25}
          gamma={1}
          saturation={1.05}
          zoom={0.85}
        />
        {/* keep the top and edges dark so the nav and headline stay legible */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--bg)_0%,rgba(8,8,12,0.55)_26%,transparent_55%,rgba(8,8,12,0.15)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,transparent_35%,rgba(8,8,12,0.7)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
      </div>
      <Container className="relative flex min-h-[100dvh] flex-col items-center justify-center pb-24 pt-40 text-center">
        <h1 className="rise font-pixel max-w-[17ch] text-[40px] leading-[1.08] tracking-[-0.01em] text-balance md:text-[68px]">
          Settlement that proves delivery without exposing the trade.
        </h1>
        <p
          className="rise mt-8 max-w-[44ch] text-[17px] leading-relaxed text-white md:text-[20px] [text-shadow:0_1px_18px_rgba(5,6,11,0.55)]"
          style={{ animationDelay: "0.08s" }}
        >
          Sup settles tokenized assets on Canton. Both legs lock and delivery clears atomically.
        </p>
        <div className="rise mt-11 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.16s" }}>
          <Link href="/start" className="btn btn-light num !px-6">
            Open the desk <ArrowRight size={15} />
          </Link>
          <a href="#problem" className="btn num !px-6">
            See why
          </a>
        </div>
      </Container>
    </div>
  );
}

/* ---------------------------------------------------------------- problem */

function Problem() {
  return (
    <Framed label="Problem" id="problem">
      <Heading eyebrow="The problem" title={<>A private trade shouldn&apos;t need a public audience.</>}>
        When two institutions trade a bond over the counter, someone has to confirm delivery before the money moves. Today that
        means telling that someone everything, or telling the whole market.
      </Heading>
      <div className="mt-14">
        <CardGrid cols={3}>
          <Card title="On paper, the agent sees everything" tag="today">
            To check one delivery reference, a settlement agent is handed the price, the size and both names. The trade leaks to the
            one party who only needed a receipt.
          </Card>
          <Card title="On a public chain, everyone does" tag="alternative">
            Offers and fills sit in the open before they settle. Large orders get front-run and counterparties are exposed to the
            whole market.
          </Card>
          <Card title="On Sup, each party sees its own part" tag="Sup">
            The agent sees one reference. Outsiders see nothing. The bond and the payment swap in a single transaction, or not at all.
          </Card>
        </CardGrid>
      </div>
      <Link href="/why" className="num reveal mt-8 inline-flex items-center gap-2 text-[13px] text-accent-soft transition-colors hover:text-white">
        Who this is for and why now <ArrowUpRight size={15} />
      </Link>
    </Framed>
  );
}

/* ------------------------------------------------------------- disclosure */

type Vis = "yes" | "no" | "optin";
const COLS = ["Buyer + seller", "Agent", "Auditor", "Outsider"] as const;

const ROWS: { field: string; note?: string; v: Vis[] }[] = [
  { field: "Asset class and quantity", v: ["yes", "no", "optin", "no"] },
  { field: "Price and currency", v: ["yes", "no", "optin", "no"] },
  { field: "Counterparty identity", v: ["yes", "yes", "optin", "no"] },
  { field: "Document hash", note: "the one thing the agent checks", v: ["yes", "yes", "no", "no"] },
  { field: "The locked legs", v: ["yes", "no", "no", "no"] },
  { field: "Settlement receipt", v: ["yes", "no", "optin", "no"] },
];

function Cell({ v }: { v: Vis }) {
  if (v === "yes")
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ok)_16%,transparent)] text-ok">
        <Eye size={14} />
      </span>
    );
  if (v === "optin")
    return (
      <span
        title="Visible only when the seller designates an auditor at proposal time"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-[var(--line-strong)] text-muted"
      >
        <Eye size={14} />
      </span>
    );
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center text-[#32343f]">
      <EyeOff size={14} />
    </span>
  );
}

function Disclosure() {
  return (
    <Framed label="Disclosure" id="disclosure">
      <Heading title={<>The agent confirms one fact. It should only see one fact.</>}>
        Here is who sees what on a single trade. This isn&apos;t a setting in our app. It is declared in the contract, and the
        Canton ledger simply never sends the rest.
      </Heading>

      <div className="reveal relative mt-14">
        <Glow className="right-[-3rem] top-6 h-[26rem] w-[26rem]" intensity={0.15} />
        <div className="relative overflow-hidden border border-line bg-s1">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[660px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="num px-6 py-4 text-[10px] uppercase tracking-[0.18em] text-muted">On the ledger</th>
                  {COLS.map((c) => (
                    <th key={c} className="num px-3 py-4 text-center text-[10px] uppercase tracking-[0.18em] text-muted">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.field} className="border-b border-line last:border-0">
                    <td className="px-6 py-4">
                      <div className="text-[14.5px] text-ink">{r.field}</div>
                      {r.note && <div className="mt-0.5 text-[12px] text-muted">{r.note}</div>}
                    </td>
                    {r.v.map((v, i) => (
                      <td key={i} className="px-3 py-4 text-center">
                        <Cell v={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-line bg-s2 px-6 py-4 text-[12.5px] text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-[var(--line-strong)]">
                <Eye size={10} />
              </span>
              Opt in, chosen by the seller per trade
            </span>
            <span>Visibility is declared in Daml and enforced by the protocol, not filtered in this interface.</span>
          </div>
        </div>
      </div>
    </Framed>
  );
}

/* -------------------------------------------------------------------- how */

function How() {
  return (
    <Framed label="How it works" id="how">
      <Heading eyebrow="How a trade works" title={<>Four steps. The contract refuses to skip any.</>}>
        Nothing here depends on trusting us. Each step is a Canton transaction, and the next step cannot happen until the one
        before it has.
      </Heading>
      <div className="mt-14">
        <CardGrid cols={4}>
          <Card title="Offer" tag="seller">
            The seller sends a private offer to one buyer: a bond, a quantity and a price. Nobody else is told it exists.
          </Card>
          <Card title="Pay" tag="buyer">
            The buyer accepts in one click. The payment is locked in escrow, not spent. It cannot move yet.
          </Card>
          <Card title="Confirm" tag="optional agent">
            An agent checks one delivery reference against a fingerprint on the ledger. It sees nothing else about the trade.
          </Card>
          <Card title="Settle" tag="atomic">
            The bond and the payment swap in a single transaction. Both arrive, or neither does. There is no half-trade.
          </Card>
        </CardGrid>
      </div>
      <Link href="/how" className="num reveal mt-8 inline-flex items-center gap-2 text-[13px] text-accent-soft transition-colors hover:text-white">
        Follow one trade step by step <ArrowUpRight size={15} />
      </Link>
    </Framed>
  );
}

/* ------------------------------------------------------------------ proof */

const TX = [
  { t: "EscrowTrade.SettleDvPExternal", k: "f", i: 0 },
  { t: "LockedAsset.Allocation_ExecuteTransfer", k: "f", i: 1 },
  { t: "create AssetToken            5 BOND-2031 to the buyer", k: "+", i: 2 },
  { t: "DvpLegAllocation.Allocation_ExecuteTransfer   (BitSafe registry)", k: "f", i: 1 },
  { t: "TransferRule.TransferRule_ExecuteAllocation", k: "f", i: 2 },
  { t: "create Holding               0.012 real CBTC to the seller", k: "+", i: 3 },
  { t: "create SettlementReceipt", k: "+", i: 1 },
];

const STATS = [
  { v: "38", l: "trades settled on DevNet" },
  { v: "10", l: "paid in real CBTC" },
  { v: "46", l: "contract rejection checks" },
  { v: "12", l: "contract templates" },
];

function Proof() {
  return (
    <Framed label="Proof" id="proof">
      <Heading eyebrow="Running on Canton DevNet" title={<>A real trade. Real CBTC. One transaction.</>}>
        A bond sold for CBTC through BitSafe&apos;s own registry, on the shared HackCanton node. Below is the actual event tree. The
        agent and an outside party both asked the node for this transaction and got nothing back.
      </Heading>

      <div className="reveal relative mt-14">
        <Glow className="bottom-[-7rem] left-[-5rem] h-[28rem] w-[34rem]" intensity={0.2} />
        <div className="relative overflow-hidden border border-[var(--line-strong)] bg-bg shadow-[var(--e-2)]">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            <code className="num truncate text-[11.5px] text-ink2">1220b7897407c4dcca746911ed4df6153b3d9ff330d519fab7d36c592e4d1f2fdc65</code>
            <span className="num ml-auto hidden text-[11px] text-muted sm:block">offset 2759757</span>
          </div>
          <div className="scroll-thin overflow-x-auto px-5 py-5">
            {TX.map((l, n) => (
              <div key={n} className="num whitespace-pre text-[12.5px] leading-[2]" style={{ paddingLeft: l.i * 20 }}>
                <span className={l.k === "+" ? "text-ok" : n === 0 ? "font-semibold text-accent" : "text-ink2"}>
                  {l.k === "+" ? "+ " : "ƒ "}
                  {l.t}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-line px-5 py-3.5 text-[12.5px] text-muted">
            Visible to the buyer and the seller. Read back as the agent, or as an unrelated party, the node returns nothing.
          </div>
        </div>
      </div>

      <div className="reveal mt-14 grid grid-cols-2 gap-px overflow-hidden border border-line bg-line md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.l} className="bg-bg px-6 py-7">
            <div className="num text-[34px] font-medium leading-none tracking-tight">{s.v}</div>
            <div className="num mt-2.5 text-[11px] uppercase tracking-[0.14em] text-muted">{s.l}</div>
          </div>
        ))}
      </div>
      <Link href="/proof" className="num reveal mt-8 inline-flex items-center gap-2 text-[13px] text-accent-soft transition-colors hover:text-white">
        More evidence and how to reproduce it <ArrowUpRight size={15} />
      </Link>
    </Framed>
  );
}

/* ----------------------------------------------------------------- assets */

function Assets() {
  return (
    <Framed label="Assets" id="assets">
      <Heading eyebrow="What it settles" title={<>Real tokens where they exist. Honest labels where they don&apos;t.</>}>
        Everything follows the Canton Token Standard, so any standard wallet can read these balances. We never present a test asset
        as something it is not.
      </Heading>
      <div className="mt-14">
        <CardGrid cols={3}>
          <Card title="CBTC" tag="real BitSafe CBTC">
            Pay in BitSafe&apos;s Bitcoin-backed token. It is locked through BitSafe&apos;s registry and delivered to the seller in
            the same transaction as the bond.
          </Card>
          <Card title="Canton Coin" tag="real DevNet coin">
            Price a trade in the network&apos;s own coin. The network&apos;s registry locks it and releases it at settlement.
          </Card>
          <Card title="Bonds" tag="test assets">
            Sellers define their own bonds. They are labelled test assets issued by demo parties, never presented as real securities.
          </Card>
        </CardGrid>
      </div>
    </Framed>
  );
}

/* ------------------------------------------------------------------- page */

export function Landing() {
  return (
    <div className="relative min-h-[100dvh]">
      <span aria-hidden className="grain pointer-events-none fixed inset-0 z-[60]" />
      <Nav links={LANDING_LINKS} overHero />
      <main>
        <Hero />
        <Problem />
        <Disclosure />
        <How />
        <Proof />
        <Assets />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
