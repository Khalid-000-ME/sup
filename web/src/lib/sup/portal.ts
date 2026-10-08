import type { Trade } from "./client";
import type { PartyRef, TradeStage } from "./types";
import type { SupAction } from "./server";

/** One trade, flattened for the seller and buyer portals. */
export interface TradeRow {
  id: string;
  trade: Trade;
  bond: string;
  qty: number;
  amount: number;
  /** Display currency: "CashUSD" or "CC". */
  ccy: string;
  unit: number;
  counterparty: PartyRef;
  status: string;
  tone: "default" | "ok" | "warn" | "bad" | "accent";
  done: boolean;
  /** The single thing this party can do next, if anything. */
  next?: { label: string; action: SupAction; primary: boolean };
  at: number;
}

const FINAL: TradeStage[] = ["settled", "cancelled", "expired", "rejected"];

export function toRows(trades: Trade[], role: "seller" | "buyer"): TradeRow[] {
  const rows: TradeRow[] = [];
  for (const t of trades) {
    const src = t.proposal ?? t.escrow ?? t.receipt;
    if (!src) continue;
    const counterparty = role === "seller" ? src.buyer : src.seller;
    const done = FINAL.includes(t.stage);
    let status = "";
    let tone: TradeRow["tone"] = "default";
    let next: TradeRow["next"];

    const seller = role === "seller";
    switch (t.stage) {
      case "proposed":
        status = seller ? "Awaiting buyer" : "New offer";
        tone = "accent";
        if (!seller && t.proposal) next = { label: "Buy", action: { type: "buy", proposalCid: t.proposal.cid }, primary: true };
        if (seller && t.proposal) next = { label: "Withdraw", action: { type: "withdrawProposal", proposalCid: t.proposal.cid }, primary: false };
        break;
      case "accepted":
        status = seller ? "Buyer accepted" : "Accepted";
        tone = "warn";
        if (seller && t.escrow) next = { label: "Deliver bond", action: { type: "deliver", escrowCid: t.escrow.cid }, primary: true };
        if (!seller && t.escrow) next = { label: "Lock payment", action: { type: "lockPayment", escrowCid: t.escrow.cid }, primary: true };
        break;
      case "paymentLocked":
        status = seller ? "Buyer paid. Deliver the bond" : "Paid. Awaiting delivery";
        tone = "warn";
        if (seller && t.escrow) next = { label: "Deliver bond", action: { type: "deliver", escrowCid: t.escrow.cid }, primary: true };
        break;
      case "assetLocked":
        status = seller ? "Bond locked. Awaiting payment" : "Bond locked. Pay to complete";
        tone = "warn";
        if (!seller && t.escrow) next = { label: "Lock payment", action: { type: "lockPayment", escrowCid: t.escrow.cid }, primary: true };
        break;
      case "bothLocked":
        status = "Awaiting delivery confirmation";
        tone = "warn";
        break;
      case "readyToSettle":
        status = "Ready to settle";
        tone = "ok";
        if (t.escrow) next = { label: "Settle", action: { type: "settle", escrowCid: t.escrow.cid }, primary: true };
        break;
      case "settled":
        status = "Settled";
        tone = "ok";
        break;
      case "cancelled":
        status = "Cancelled";
        tone = "bad";
        break;
      case "expired":
        status = "Expired";
        break;
      case "rejected":
        status = "Delivery rejected";
        tone = "bad";
        break;
      default:
        status = t.stage;
    }
    rows.push({
      id: t.id,
      trade: t,
      bond: src.assetClass,
      qty: src.assetQuantity,
      amount: src.cashAmount,
      ccy: src.currency,
      unit: src.assetQuantity > 0 ? src.cashAmount / src.assetQuantity : 0,
      counterparty,
      status,
      tone,
      done,
      next,
      at: t.sortAt,
    });
  }
  return rows;
}

export const unitFmt = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: n < 1 ? 8 : n < 10 ? 4 : 2, minimumFractionDigits: 0 }).format(n);
