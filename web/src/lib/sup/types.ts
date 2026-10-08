import type { SupRole } from "./personas";

export interface PartyRef {
  party: string;
  role?: SupRole;
  name: string;
}

export interface Holding {
  cid: string;
  quantity: number;
  label: string;
}

export type TradeStage =
  | "proposed"
  | "accepted"
  | "assetLocked"
  | "paymentLocked"
  | "bothLocked"
  | "readyToSettle"
  | "settled"
  | "cancelled"
  | "expired"
  | "rejected"
  // Seen by a party that only holds the condition leg (the settlement agent):
  // it genuinely cannot observe the escrow, so it cannot know the trade stage.
  | "pendingApproval"
  | "conditionHandled";

export interface ProposalView {
  cid: string;
  escrowId: string;
  seller: PartyRef;
  buyer: PartyRef;
  agent?: PartyRef;
  auditor?: PartyRef;
  assetClass: string;
  assetQuantity: number;
  currency: string;
  cashAmount: number;
  documentHash?: string;
  expiry: number;
  proposedAt: number;
  mine: boolean;
}

export interface EscrowView {
  cid: string;
  escrowId: string;
  seller: PartyRef;
  buyer: PartyRef;
  agent?: PartyRef;
  auditor?: PartyRef;
  assetClass: string;
  assetQuantity: number;
  currency: string;
  cashAmount: number;
  documentHash?: string;
  expiry: number;
  acceptedAt: number;
}

export interface LockView {
  cid: string;
  escrowId: string;
  kind: "asset" | "payment";
  quantity: number;
  label: string;
  lockedAt: number;
  expiry: number;
  /** True when the lock is an Allocation created by an external registry (real Canton Coin). */
  external?: boolean;
}

export interface ConditionRequestView {
  cid: string;
  escrowId: string;
  seller: PartyRef;
  buyer: PartyRef;
  documentHash: string;
  requestedAt: number;
  expiry: number;
}

export interface ConditionResultView {
  cid: string;
  escrowId: string;
  documentHash: string;
  approved: boolean;
  reason?: string;
  at: number;
}

export interface ReceiptView {
  cid: string;
  escrowId: string;
  seller: PartyRef;
  buyer: PartyRef;
  assetClass: string;
  assetQuantity: number;
  currency: string;
  cashAmount: number;
  outcome: "SettledDvP" | "CancelledByAgreement" | "ExpiredUnsettled";
  settledAt: number;
}

export interface SupState {
  serverNow: number;
  role: SupRole;
  party: string;
  ledger: { offset: number; version: string; network: "local" | "devnet" };
  custodyReady: boolean;
  assets: Holding[];
  cash: Holding[];
  proposals: ProposalView[];
  escrows: EscrowView[];
  locks: LockView[];
  conditionRequests: ConditionRequestView[];
  conditionResults: ConditionResultView[];
  receipts: ReceiptView[];
  contractCount: number;
  /** Real Canton Coin held by this party (DevNet only), read through the standard Holding interface. */
  amulet?: { unlocked: number; locked: number };
  /** Real CBTC and cETH held by this party, from their issuers' registries (DevNet). */
  external?: Record<string, { unlocked: number; locked: number }>;
  /** Seller only: the original delivery reference for each of their trades. */
  docRefs?: Record<string, string>;
  /** Off-ledger bond registry, attached by /api/sup/state. */
  bonds?: BondMeta[];
  onboardedAt?: number | null;
}

export interface BondMeta {
  symbol: string;
  name: string;
  faceValue: number;
  couponPct: number;
  maturity: string;
  description: string;
  createdAt: number;
}

export interface SupActionResult {
  ok: boolean;
  error?: string;
  updateId?: string;
  offset?: number;
  summary?: string;
  data?: unknown;
}

/** A token as seen through the Canton Token Standard `Holding` interface. */
export interface StandardHolding {
  cid: string;
  /** The concrete Sup template implementing the interface. */
  implementedBy: string;
  owner: PartyRef;
  instrumentAdmin: PartyRef;
  instrumentId: string;
  amount: number;
  locked: boolean;
  lockHolders: PartyRef[];
  lockContext?: string;
  lockExpiresAt?: number;
}

/** One leg of a settlement as seen through the standard `Allocation` interface. */
export interface StandardAllocation {
  cid: string;
  implementedBy: string;
  settlementRef: string;
  transferLegId: string;
  sender: PartyRef;
  receiver: PartyRef;
  amount: number;
  instrumentId: string;
  instrumentAdmin: PartyRef;
  executor: PartyRef;
  settleBefore: number;
}

export interface StandardView {
  holdings: StandardHolding[];
  allocations: StandardAllocation[];
  /** The standard interface package ids this view was read through. */
  interfaces: { holding: string; allocation: string };
}
