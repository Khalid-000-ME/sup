"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardGrid, Closing, Container, Framed, Heading, PageFrame } from "./parts";

const Src = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-soft underline-offset-2 hover:underline">
    {children} <ArrowUpRight size={12} />
  </a>
);

/* ------------------------------------------------------------------- /why */

export function WhyPage() {
  return (
    <PageFrame>
      <Container className="pb-4 pt-14">
        <p className="num text-[10px] uppercase tracking-[0.22em] text-accent">Why Sup</p>
        <h1 className="font-display mt-5 max-w-[18ch] text-[40px] font-light leading-[1.05] tracking-[-0.025em] md:text-[60px]">
          Who needs this, and why now.
        </h1>
      </Container>

      <Framed label="Who">
        <Heading eyebrow="Who it is for" title={<>Teams that move large bonds one-to-one.</>}>
          Not retail, and not an exchange. People who trade a block with one named counterparty and need a third party to confirm the
          delivery.
        </Heading>
        <div className="mt-14">
          <CardGrid cols={3}>
            <Card title="Credit and bond desks" tag="trades">
              Dealers and asset managers that sell blocks over the counter. They want the trade confirmed without telling the whole
              market, or even the agent, what the price was.
            </Card>
            <Card title="Fund administrators and custodians" tag="settlement agents">
              They confirm delivery today by receiving the full trade. With Sup they receive one reference and a fingerprint, and
              can still sign off.
            </Card>
            <Card title="Collateral and treasury teams" tag="tokenized assets">
              Teams moving tokenized collateral between counterparties, where payment and delivery must either both happen or
              neither.
            </Card>
          </CardGrid>
        </div>
      </Framed>

      <Framed label="Scale">
        <Heading eyebrow="The size of it" title={<>A very large market that still settles by trust.</>}>
          US corporate debt outstanding is about $12.1 trillion, and trading averages roughly $67 billion a day (
          <Src href="https://www.sifma.org/research/statistics/us-corporate-bonds-statistics">SIFMA</Src>). Every one of those trades
          ends in a delivery that someone has to confirm, and the more of it moves onto tokenized rails, the more that confirmation
          step matters.
        </Heading>
        <div className="mt-14">
          <CardGrid cols={3}>
            <Card title="$12.1T" tag="US corporate debt outstanding">
              As of Q2 2026, per SIFMA.
            </Card>
            <Card title="$66.7B / day" tag="average daily trading">
              SIFMA, year to date through September 2026.
            </Card>
            <Card title="3 years" tag="SEC relief for a tokenization pilot">
              In December 2025 the SEC let DTC pilot a tokenization service for three years without enforcement action.
            </Card>
          </CardGrid>
        </div>
      </Framed>

      <Framed label="Now">
        <Heading eyebrow="Why now" title={<>The assets are moving onto Canton. The privacy problem comes with them.</>}>
          The infrastructure for tokenized bonds exists. What is missing is a settlement step that doesn&apos;t expose the trade.
        </Heading>
        <div className="mt-14">
          <CardGrid cols={3}>
            <Card title="Treasuries are being tokenized on Canton" tag="infrastructure">
              On December 17, 2025 DTCC announced a partnership with Digital Asset to tokenize a subset of US Treasuries held at its DTC
              subsidiary on the Canton Network (<Src href="https://www.winstontaylor.com/insights/dtcc-partners-with-digital-asset-to-tokenize-dtc-custodied-us-treasury-securities">summary</Src>).
            </Card>
            <Card title="Assets from different issuers can settle together" tag="standard">
              The Canton Token Standard lets Canton Coin, CBTC and Sup&apos;s own tokens move in one atomic transaction. Our demo
              settles bonds against real CBTC and real Canton Coin.
            </Card>
            <Card title="Leakage is measured, not hypothetical" tag="evidence">
              A 2026 Tradeweb paper on US credit finds that all-to-all RFQ trading leaks more information than comparable bilateral
              trades (<Src href="https://www.tradeweb.com/newsroom/media-center/insights/blog/information-leakage-in-us-credit-evidence-from-all-to-all-rfqs/">Tradeweb</Src>). It is a platform operator&apos;s paper, so treat it as indicative.
            </Card>
          </CardGrid>
        </div>
      </Framed>

      <Framed label="Canton">
        <Heading eyebrow="Why Canton" title={<>Privacy that the ledger enforces, not the app.</>}>
          On a public chain, &ldquo;the agent shouldn&apos;t see the price&rdquo; is a request. On Canton it is a property of the contract.
        </Heading>
        <div className="mt-14">
          <CardGrid cols={3}>
            <Card title="Sub-transaction privacy" tag="privacy">
              A party receives only the parts of a transaction it is entitled to. The agent never receives the price because the
              protocol never sends it.
            </Card>
            <Card title="Atomic multi-party settlement" tag="settlement">
              The bond and the payment from two different issuers settle in one transaction, with no moment where one side holds
              both.
            </Card>
            <Card title="Institutional counterparties" tag="network">
              Canton is built for regulated participants, and it is where DTCC and others are already running tokenization pilots.
            </Card>
          </CardGrid>
        </div>
      </Framed>
      <Closing />
    </PageFrame>
  );
}

/* ------------------------------------------------------------------- /how */

const STEPS: { n: string; who: string; title: string; ledger: string; sees: string }[] = [
  {
    n: "01",
    who: "Seller",
    title: "Defines a bond and sends a private offer",
    ledger: "A TradeProposal is created for one named buyer, with an expiry.",
    sees: "Seller and buyer only.",
  },
  {
    n: "02",
    who: "Buyer",
    title: "Buys in one click",
    ledger: "The offer becomes an EscrowTrade and the payment is locked: a Sup lock for CashUSD, or the issuer's own registry allocation for CBTC and Canton Coin.",
    sees: "Seller and buyer. The funds are checked before anything is accepted.",
  },
  {
    n: "03",
    who: "Seller",
    title: "Delivers the bond",
    ledger: "The bond is locked as a standard Allocation. Nothing has moved to the other side yet.",
    sees: "Seller and buyer.",
  },
  {
    n: "04",
    who: "Agent (optional)",
    title: "Confirms one reference",
    ledger: "A ConditionRequest carries only a fingerprint of the delivery reference. The agent re-computes it from what the seller gave them.",
    sees: "The agent sees a trade id, two names and the fingerprint. Not the price, the asset or the quantity.",
  },
  {
    n: "05",
    who: "Contract",
    title: "Settles atomically",
    ledger: "SettleDvPExternal executes both allocations in a single transaction and writes a receipt. If anything is missing, nothing happens.",
    sees: "Seller and buyer. An outsider or the agent gets nothing back from the node.",
  },
  {
    n: "06",
    who: "Anyone involved",
    title: "Verifies it",
    ledger: "Each step is its own transaction. Read it back from the node as the signed-in party.",
    sees: "Only parties to the trade can retrieve it.",
  },
];

export function HowPage() {
  return (
    <PageFrame>
      <Container className="pb-4 pt-14">
        <p className="num text-[10px] uppercase tracking-[0.22em] text-accent">How it works</p>
        <h1 className="font-display mt-5 max-w-[18ch] text-[40px] font-light leading-[1.05] tracking-[-0.025em] md:text-[60px]">
          One trade, step by step.
        </h1>
      </Container>

      <Framed label="Steps">
        <div className="reveal overflow-hidden border border-line">
          {STEPS.map((s) => (
            <div key={s.n} className="grid gap-4 border-b border-line bg-bg p-6 last:border-0 md:grid-cols-[5rem_12rem_1fr_1fr] md:gap-8">
              <span className="num text-[13px] text-muted">{s.n}</span>
              <div>
                <div className="num text-[10px] uppercase tracking-[0.18em] text-accent">{s.who}</div>
                <div className="font-display mt-1.5 text-[18px] font-medium leading-snug tracking-tight">{s.title}</div>
              </div>
              <div>
                <div className="num mb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted">On the ledger</div>
                <p className="text-[14px] leading-relaxed text-ink2">{s.ledger}</p>
              </div>
              <div>
                <div className="num mb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted">Who sees it</div>
                <p className="text-[14px] leading-relaxed text-ink2">{s.sees}</p>
              </div>
            </div>
          ))}
        </div>
      </Framed>

      <Framed label="Guarantees">
        <Heading eyebrow="What the contract enforces" title={<>Rules that hold even if our app is bypassed.</>}>
          These are Daml rules, checked by the Canton participant. Our own end-to-end tests submit the forbidden action straight to
          the ledger and assert that it is refused.
        </Heading>
        <div className="mt-14">
          <CardGrid cols={3}>
            <Card title="No settlement without confirmation" tag="agent">
              If a trade asks for an agent, settlement is rejected until the matching approval exists. The button being hidden is
              not what protects it.
            </Card>
            <Card title="Both legs or neither" tag="atomic">
              The bond and the payment are released by one choice. A failed leg fails the whole transaction.
            </Card>
            <Card title="Expiry returns everything" tag="safety">
              If a trade never settles, each side reclaims its own locked leg after the expiry. Nothing is held hostage.
            </Card>
          </CardGrid>
        </div>
        <p className="reveal mt-8 max-w-[62ch] text-[14px] leading-relaxed text-muted">
          Where the browser fits: the Sup server submits each action as the signed-in party to a Canton participant on DevNet. It
          holds those parties&apos; credentials, so this prototype is custodial. A production version would have each party sign with
          their own key.
        </p>
        <Link href="/proof" className="num reveal mt-8 inline-flex items-center gap-2 text-[13px] text-accent-soft transition-colors hover:text-white">
          See the transactions <ArrowUpRight size={15} />
        </Link>
      </Framed>
      <Closing />
    </PageFrame>
  );
}

/* ----------------------------------------------------------------- /proof */

const SETTLEMENTS = [
  {
    asset: "Bond for real CBTC",
    id: "1220b7897407c4dcca746911ed4df6153b3d9ff330d519fab7d36c592e4d1f2fdc65",
    offset: "2759757",
    note: "5 TBILL-2027 for 0.012 CBTC through BitSafe's registry",
  },
  {
    asset: "Bond for real CBTC",
    id: "12205c7602ce6fb4fbe56a6a4298fbb15b25d6d698e6e38ac67ef8d4d75bc2ccfb44",
    offset: "2759620",
    note: "5 BOND-2031 for 0.01 CBTC, seller with no wallet received it",
  },
  {
    asset: "Bond for real Canton Coin",
    id: "12203a6f3f48c035828dc668a048d931baa41c56c6b13aa3024d8573098f5ca64f6f",
    offset: "2705360",
    note: "100 BOND-2031 for 250 Canton Coin, agent-approved",
  },
  {
    asset: "Bond for CashUSD (test token)",
    id: "1220e29ea001adb969b7f0cd6c6af282162c08ea134d4e7637c8ba35f83c1090d150",
    offset: "2760237",
    note: "One-click buy then deliver",
  },
];

export function ProofPage() {
  return (
    <PageFrame>
      <Container className="pb-4 pt-14">
        <p className="num text-[10px] uppercase tracking-[0.22em] text-accent">Proof</p>
        <h1 className="font-display mt-5 max-w-[18ch] text-[40px] font-light leading-[1.05] tracking-[-0.025em] md:text-[60px]">
          What ran, and how to run it yourself.
        </h1>
      </Container>

      <Framed label="Ledger">
        <Heading eyebrow="On Canton DevNet" title={<>Real settlements on the shared HackCanton node.</>}>
          Each transaction below can be read back from the node as a party to the trade. These are private contracts, so a public
          block explorer will not show them, and that is deliberate.
        </Heading>
        <div className="reveal mt-14 overflow-hidden border border-line">
          {SETTLEMENTS.map((s) => (
            <div key={s.id} className="grid gap-3 border-b border-line bg-bg p-5 last:border-0 md:grid-cols-[13rem_1fr] md:gap-8">
              <div>
                <div className="num text-[10px] uppercase tracking-[0.18em] text-accent">{s.asset}</div>
                <div className="num mt-1.5 text-[12px] text-muted">offset {s.offset}</div>
              </div>
              <div className="min-w-0">
                <code className="num block break-all text-[12px] text-ink2">{s.id}</code>
                <p className="mt-1.5 text-[13.5px] text-muted">{s.note}</p>
              </div>
            </div>
          ))}
        </div>
      </Framed>

      <Framed label="Tests">
        <Heading eyebrow="Reproducible" title={<>Checks that fail if the privacy or atomicity breaks.</>}>
          The same properties are asserted three ways: in Daml, against the live ledger, and in the browser.
        </Heading>
        <div className="mt-14">
          <CardGrid cols={3}>
            <Card title="Daml Script" tag="14 scripts, 46 rejection checks">
              Every forbidden action (settling without approval, wrong allocation, wrong party) is attempted and must be refused.
            </Card>
            <Card title="Live-ledger suites" tag="4 end-to-end runs on DevNet">
              Test tokens, real Canton Coin, real CBTC, and the portal flows, each asserting what the agent and an outsider can see.
            </Card>
            <Card title="Run them" tag="npm run">
              <code className="num text-[12.5px] leading-7 text-ink2">
                sup:e2e · sup:e2e:amulet
                <br />
                sup:e2e:cbtc · sup:e2e:portal
              </code>
            </Card>
          </CardGrid>
        </div>
      </Framed>

      <Framed label="Limits">
        <Heading eyebrow="Honest scope" title={<>What this prototype is not.</>} />
        <div className="mt-14">
          <CardGrid cols={3}>
            <Card title="Custodial demo parties" tag="trust">
              The server holds the seven demo parties&apos; credentials. Production would use per-party signing.
            </Card>
            <Card title="Test bonds" tag="assets">
              Bonds and CashUSD are test assets issued by demo parties. Canton Coin and CBTC are real DevNet tokens with no market value.
            </Card>
            <Card title="Small CBTC amounts" tag="faucet">
              BitSafe&apos;s DevNet faucet pays 0.01 to 1 CBTC per request, so trades are priced in hundredths of a coin.
            </Card>
          </CardGrid>
        </div>
      </Framed>
      <Closing />
    </PageFrame>
  );
}
