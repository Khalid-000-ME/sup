"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { useCallback } from "react";
import type { SupRole } from "./personas";
import { syncClock } from "../client/hooks";
import type { SupAction } from "./server";
import type { StandardView, SupActionResult, SupState, ConditionResultView, EscrowView, LockView, ProposalView, ReceiptView, TradeStage } from "./types";

export class ApiError extends Error {}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error ?? `Request failed (${r.status})`);
  return j as T;
}

export function useSupState(role: SupRole) {
  return useSWR<SupState, ApiError>(`/api/sup/state?as=${role}`, async (u: string) => {
    const s = await getJson<SupState>(u);
    syncClock(s.serverNow);
    return s;
  }, {
    refreshInterval: 1500,
    keepPreviousData: true,
    dedupingInterval: 400,
  });
}

export function useStandardView(role: SupRole) {
  return useSWR<StandardView, ApiError>(`/api/sup/standard?as=${role}`, getJson, {
    refreshInterval: 2500,
    keepPreviousData: true,
  });
}

const ACCESS_KEY = "sup.access";
const readAccess = () => {
  try {
    return localStorage.getItem(ACCESS_KEY) ?? "";
  } catch {
    return "";
  }
};

export async function postSup(role: SupRole, action: SupAction): Promise<SupActionResult> {
  const send = (code: string) =>
    fetch("/api/sup/action", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(code ? { "x-sup-access": code } : {}) },
      body: JSON.stringify({ as: role, action }),
    });
  let r = await send(readAccess());
  // A public deployment protects writes with an access code: ask for it once, then remember it.
  if (r.status === 401) {
    const j = (await r.clone().json().catch(() => ({}))) as { access?: boolean };
    if (j.access) {
      const code = window.prompt("This demo needs an access code to make changes. Enter it:") ?? "";
      if (code) {
        try {
          localStorage.setItem(ACCESS_KEY, code);
        } catch {
          /* storage unavailable: the code just will not persist */
        }
        r = await send(code);
      }
    }
  }
  const j = (await r.json().catch(() => ({}))) as SupActionResult;
  if (!r.ok || !j.ok) throw new ApiError(j.error ?? `Action failed (${r.status})`);
  return j;
}

export function useRefreshSup() {
  return useCallback(() => globalMutate((k) => typeof k === "string" && k.startsWith("/api/sup")), []);
}

// ---------------------------------------------------------------- trade model

export interface Trade {
  id: string;
  proposal?: ProposalView;
  escrow?: EscrowView;
  assetLock?: LockView;
  paymentLock?: LockView;
  condition?: ConditionResultView;
  conditionPending: boolean;
  receipt?: ReceiptView;
  stage: TradeStage;
  /** 0-based index into STAGE_STEPS */
  step: number;
  needsCondition: boolean;
  sortAt: number;
}

export const STAGE_STEPS = ["Proposed", "Accepted", "Asset locked", "Payment locked", "Condition", "Settled"] as const;

export const STAGE_LABEL: Record<TradeStage, string> = {
  proposed: "Awaiting buyer",
  accepted: "Escrow active",
  assetLocked: "Asset locked",
  paymentLocked: "Payment locked",
  bothLocked: "Awaiting condition",
  readyToSettle: "Ready to settle",
  settled: "Settled",
  cancelled: "Cancelled",
  expired: "Expired",
  rejected: "Condition rejected",
  pendingApproval: "Awaiting your approval",
  conditionHandled: "Approved",
};

export const STAGE_TONE: Record<TradeStage, "default" | "ok" | "warn" | "bad" | "veil"> = {
  proposed: "veil",
  accepted: "veil",
  assetLocked: "warn",
  paymentLocked: "warn",
  bothLocked: "warn",
  readyToSettle: "ok",
  settled: "ok",
  cancelled: "bad",
  expired: "default",
  rejected: "bad",
  pendingApproval: "warn",
  conditionHandled: "ok",
};

export function buildTrades(s: SupState, now: number): Trade[] {
  const ids = new Set<string>();
  s.proposals.forEach((x) => ids.add(x.escrowId));
  s.escrows.forEach((x) => ids.add(x.escrowId));
  s.locks.forEach((x) => ids.add(x.escrowId));
  s.conditionRequests.forEach((x) => ids.add(x.escrowId));
  s.conditionResults.forEach((x) => ids.add(x.escrowId));
  s.receipts.forEach((x) => ids.add(x.escrowId));

  const out: Trade[] = [];
  for (const id of ids) {
    const proposal = s.proposals.find((x) => x.escrowId === id);
    const escrow = s.escrows.find((x) => x.escrowId === id);
    const assetLock = s.locks.find((x) => x.escrowId === id && x.kind === "asset");
    const paymentLock = s.locks.find((x) => x.escrowId === id && x.kind === "payment");
    const condition = s.conditionResults.find((x) => x.escrowId === id);
    const conditionPending = s.conditionRequests.some((x) => x.escrowId === id) && !condition;
    const receipt = s.receipts.find((x) => x.escrowId === id);
    const needsCondition = Boolean(
      (escrow?.agent && escrow?.documentHash) ||
        (proposal?.agent && proposal?.documentHash) ||
        conditionPending ||
        condition,
    );

    let stage: TradeStage;
    let step = 0;
    if (receipt) {
      stage = receipt.outcome === "SettledDvP" ? "settled" : receipt.outcome === "CancelledByAgreement" ? "cancelled" : "expired";
      step = 5;
    } else if (condition && !condition.approved) {
      stage = "rejected";
      step = 4;
    } else if (escrow) {
      const expired = now >= escrow.expiry;
      if (assetLock && paymentLock) {
        if (!needsCondition || condition?.approved) {
          stage = "readyToSettle";
          step = 4;
        } else {
          stage = "bothLocked";
          step = 4;
        }
      } else if (assetLock) {
        stage = "assetLocked";
        step = 2;
      } else if (paymentLock) {
        stage = "paymentLocked";
        step = 3;
      } else {
        stage = "accepted";
        step = 1;
      }
      if (expired && stage !== "readyToSettle") stage = "expired";
    } else if (proposal) {
      stage = "proposed";
      step = 0;
    } else if (conditionPending) {
      // No escrow visible: this viewer only holds the condition leg.
      stage = "pendingApproval";
      step = 4;
    } else if (condition) {
      stage = condition.approved ? "conditionHandled" : "rejected";
      step = 4;
    } else {
      stage = "expired";
      step = 5;
    }

    out.push({
      id,
      proposal,
      escrow,
      assetLock,
      paymentLock,
      condition,
      conditionPending,
      receipt,
      stage,
      step,
      needsCondition,
      sortAt: escrow?.acceptedAt ?? proposal?.proposedAt ?? receipt?.settledAt ?? 0,
    });
  }
  return out.sort((a, b) => b.sortAt - a.sortAt);
}
