"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { motion } from "motion/react";
import { ArrowRight, Coins } from "lucide-react";
import { Spinner } from "../ui";
import { EmptyState, Label, Modal, PageHeader, Panel, Pill, Segmented, Skeleton } from "./kit";
import { useAct } from "./useAct";
import { Portfolio } from "./Portfolio";
import { PriceBoard } from "./PriceBoard";
import { buildTrades, useSupState } from "@/lib/sup/client";
import { toRows, unitFmt, type TradeRow } from "@/lib/sup/portal";
import { useNow } from "@/lib/client/hooks";
import { countdown, fmtAmount } from "@/lib/shared/format";

export function BuyerMarket() {
  const router = useRouter();
  const { data: state } = useSupState("buyer");
  const now = useNow(1000);
  const [ccy, setCcy] = useState<string>("CashUSD");
  const [buying, setBuying] = useState<TradeRow | null>(null);
  const devnet = state?.ledger.network === "devnet";

  const offers = useMemo(() => {
    if (!state) return [];
    return toRows(buildTrades(state, now), "buyer").filter((r) => r.trade.stage === "proposed" && r.trade.proposal && r.trade.proposal.expiry > now);
  }, [state, now]);

  const board = useMemo(() => offers.filter((o) => o.ccy === ccy).sort((a, b) => a.unit - b.unit), [offers, ccy]);
  const best = useMemo(() => {
    const m: Record<string, number> = {};
    board.forEach((o) => (m[o.bond] = Math.min(m[o.bond] ?? Infinity, o.unit)));
    return m;
  }, [board]);
  const counts = (c: string) => offers.filter((o) => o.ccy === c).length;
  // CashUSD always; the real-token currencies when on DevNet or when an offer exists in them
  // cETH is configured but there is no way to obtain any yet, so its tab only appears if an offer exists
  const currencies = ["CashUSD", "CC", "CBTC", "cETH"].filter((c) => c === "CashUSD" || counts(c) > 0 || (devnet && c !== "cETH"));
  const other = currencies.find((c) => c !== ccy && counts(c) > 0);
  const meta = (sym: string) => state?.bonds?.find((b) => b.symbol === sym);

  return (
    <>
      <PageHeader
        title="Market"
        sub="Open offers, ranked by price per unit. Pick one and buy it."
        actions={
          <Segmented
            value={ccy}
            onChange={setCcy}
            options={currencies.map((c) => ({ value: c, label: `${c === "CC" ? "Canton Coin" : c} ${counts(c)}` }))}
          />
        }
      />

      <PriceBoard />
      <Portfolio role="buyer" />

      <Panel>
        {!state ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : board.length === 0 ? (
          <EmptyState
            title={`No offers in ${ccy === "CC" ? "Canton Coin" : ccy}`}
            body={other ? `There are ${counts(other)} offers in ${other === "CC" ? "Canton Coin" : other}.` : "Offers appear here the moment a seller sends one."}
            action={
              other ? (
                <button className="btn num !px-5" onClick={() => setCcy(other)}>
                  Show {other === "CC" ? "Canton Coin" : other} offers
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="num hidden grid-cols-[2.5rem_1.6fr_1fr_1fr_1fr_6.5rem] items-center gap-4 border-b border-line px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-muted md:grid">
              <span>#</span>
              <span>Bond</span>
              <span className="text-right">Units</span>
              <span className="text-right">Per unit</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            <ul>
              {board.map((o, i) => {
                const m = meta(o.bond);
                const isBest = best[o.bond] === o.unit;
                const vsFace = m && ccy === "CashUSD" ? ((m.faceValue - o.unit) / m.faceValue) * 100 : null;
                return (
                  <motion.li
                    key={o.id}
                    layout="position"
                    className="grid grid-cols-2 items-center gap-x-4 gap-y-2 border-b border-line px-5 py-4 last:border-0 hover:bg-s2 md:grid-cols-[2.5rem_1.6fr_1fr_1fr_1fr_6.5rem]"
                  >
                    <span className={clsx("num hidden text-[13px] md:block", i === 0 ? "text-accent" : "text-muted")}>{i + 1}</span>
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="num text-[14px] font-semibold">{o.bond}</span>
                        {isBest && <Pill tone="ok">Best price</Pill>}
                      </div>
                      <div className="mt-1 text-[12.5px] text-muted">
                        {m ? `${m.name} · ${m.couponPct}% · ${m.maturity.slice(0, 7)}` : o.counterparty.name}
                        {o.trade.proposal && <span className="num"> · expires {countdown(o.trade.proposal.expiry - now)}</span>}
                      </div>
                    </div>
                    <span className="num text-[14px] md:text-right">
                      <span className="text-muted md:hidden">Units </span>
                      {fmtAmount(o.qty)}
                    </span>
                    <span className="num text-[14px] md:text-right">
                      {unitFmt(o.unit)}
                      {vsFace !== null && (
                        <span className={clsx("ml-1.5 text-[11px]", vsFace > 0 ? "text-ok" : "text-muted")}>
                          {vsFace > 0 ? "−" : "+"}
                          {Math.abs(vsFace).toFixed(1)}%
                        </span>
                      )}
                    </span>
                    <span className="num text-[14px] md:text-right">{fmtAmount(o.amount)}</span>
                    <div className="col-span-2 md:col-span-1 md:text-right">
                      <button className="btn btn-primary btn-sm num w-full md:w-auto" onClick={() => setBuying(o)}>
                        Buy
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
      {board.length > 0 && ccy === "CashUSD" && (
        <p className="num mt-3 text-[11.5px] text-muted">Percentages compare the unit price with the bond&apos;s face value.</p>
      )}

      <BuyModal row={buying} onClose={() => setBuying(null)} onDone={(id) => router.push(`/buyer/trades/${id}`)} />
    </>
  );
}

function BuyModal({ row, onClose, onDone }: { row: TradeRow | null; onClose: () => void; onDone: (id: string) => void }) {
  const { data: state } = useSupState("buyer");
  const { act, busy } = useAct("buyer");
  const cur = row?.ccy ?? "CashUSD";
  const isCC = cur === "CC";
  const isReal = cur === "CBTC" || cur === "cETH";
  const have = isCC
    ? (state?.amulet?.unlocked ?? 0)
    : isReal
      ? (state?.external?.[cur]?.unlocked ?? 0)
      : (state?.cash.reduce((s, h) => s + h.quantity, 0) ?? 0);
  const short = row ? have < row.amount : false;

  return (
    <Modal open={!!row} onClose={onClose} title="Confirm purchase" width={460}>
      {row && (
        <>
          <div className="rounded-[14px] border border-line bg-bg p-5">
            <Label>You are buying</Label>
            <div className="num mt-2 text-[22px] font-medium">
              {fmtAmount(row.qty)} <span className="text-ink2">{row.bond}</span>
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
              <div>
                <Label>You pay</Label>
                <div className="num mt-1.5 text-[20px]">
                  {fmtAmount(row.amount)} <span className="text-muted">{row.ccy}</span>
                </div>
              </div>
              <div className="text-right">
                <Label>Balance after</Label>
                <div className={clsx("num mt-1.5 text-[14px]", short && "text-bad")}>{fmtAmount(have - row.amount)}</div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
            Your payment is locked, not spent. It moves to {row.counterparty.name} only when the bond is delivered, in one atomic
            transaction.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {short && isReal ? (
              <button
                className="btn num !px-5"
                disabled={busy !== null}
                onClick={() => act("fund", { type: "claim", instrument: cur === "CBTC" ? "cbtc" : "ceth" })}
              >
                {busy === "fund" ? <Spinner /> : <Coins size={14} />} Claim {cur} from the faucet
              </button>
            ) : short ? (
              <button
                className="btn num !px-5"
                disabled={busy !== null}
                onClick={() => act("fund", isCC ? { type: "faucet", asset: "amulet", amount: 1000 } : { type: "faucet", asset: "cash", amount: 100000 })}
              >
                {busy === "fund" ? <Spinner /> : <Coins size={14} />} Add {isCC ? "1,000 CC" : "100,000 CashUSD"}
              </button>
            ) : (
              <span />
            )}
            <button
              className="btn btn-primary num ml-auto !px-5"
              disabled={short || busy !== null}
              onClick={async () => {
                const r = await act("buy", { type: "buy", proposalCid: row.trade.proposal!.cid });
                if (r) {
                  onClose();
                  onDone(row.id);
                }
              }}
            >
              {busy === "buy" ? <Spinner /> : <ArrowRight size={14} />} {busy === "buy" ? "Buying…" : "Confirm purchase"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
