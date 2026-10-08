import { accessToken } from "../server/auth";
import { isDevnet } from "../server/config";
import type { Registry } from "./registry";
import {
  exerciseIn,
  interfaceContracts,
  submit,
  type DisclosedContract,
  type Transaction,
} from "../server/ledger";

/**
 * Real Canton Coin (Amulet) through the Canton Token Standard registry.
 *
 * Every step here is a standard CIP-56 interaction against the DSO's registry,
 * reached through the validator's scan-proxy: faucet, TransferFactory (+accept),
 * AllocationFactory and the Allocation choice contexts. Nothing is simulated.
 * Only available on DevNet (the local sandbox has no Amulet).
 */

export class AmuletError extends Error {}

const VALIDATOR_API =
  process.env.VALIDATOR_API ?? "https://validator-api-http.validator.hackcanton-01.devnet.naas.noders.services";
const SCAN_PROXY = `${VALIDATOR_API}/api/validator/v0/scan-proxy`;
const WALLET = `${VALIDATOR_API}/api/validator/v0/wallet`;

const I = {
  holding: "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding",
  allocation: "#splice-api-token-allocation-v1:Splice.Api.Token.AllocationV1:Allocation",
  allocationFactory: "#splice-api-token-allocation-instruction-v1:Splice.Api.Token.AllocationInstructionV1:AllocationFactory",
  transferFactory: "#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory",
  transferInstruction: "#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction",
};

export const AMULET_INSTRUMENT = "Amulet";
export const dec = (n: number) => n.toFixed(10);

function requireDevnet() {
  if (!isDevnet) {
    throw new AmuletError(
      "Real Canton Coin is only available on Canton DevNet. Run against the DevNet node (SUP_NETWORK=devnet) to use it.",
    );
  }
}

/** The result of the first exercised choice in a transaction. */
function exerciseResultOf(tx: Transaction): unknown {
  for (const e of tx.events) if ("ExercisedEvent" in e) return e.ExercisedEvent.exerciseResult;
  return undefined;
}

interface Tagged {
  tag?: string;
  value?: { transferInstructionCid?: string; allocationCid?: string };
}

async function api<T = unknown>(method: "GET" | "POST", url: string, body?: unknown): Promise<T> {
  requireDevnet();
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as { error?: unknown };
  if (!r.ok) {
    const detail = typeof j.error === "string" ? j.error : JSON.stringify(j).slice(0, 240);
    throw new AmuletError(`Canton Coin registry call failed (${r.status}): ${detail}`);
  }
  return j as T;
}

declare global {
  var __dsoParty: Promise<string> | undefined;
}

/** The DSO party administers the Amulet instrument: it is the instrument's `admin`. */
export function dsoParty(): Promise<string> {
  globalThis.__dsoParty ??= api<{ dso_party_id: string }>("GET", `${SCAN_PROXY}/dso-party-id`)
    .then((r) => r.dso_party_id)
    .catch((e) => {
      globalThis.__dsoParty = undefined;
      throw e;
    });
  return globalThis.__dsoParty;
}

/** The party of the wallet this ledger user owns (where the DevNet faucet pays out). */
export async function walletParty(): Promise<string> {
  const s = await api<{ party_id: string; user_onboarded: boolean }>("GET", `${WALLET}/user-status`);
  if (!s.user_onboarded) throw new AmuletError("Your DevNet wallet is not onboarded. Open the Wallet UI and click “Onboard yourself”.");
  return s.party_id;
}

export async function walletBalance(): Promise<number> {
  const b = await api<{ effective_unlocked_qty: string }>("GET", `${WALLET}/balance`);
  return Number(b.effective_unlocked_qty);
}

/** DevNet faucet. Returns the new wallet balance. */
export async function tapFaucet(amount: number): Promise<number> {
  await api("POST", `${WALLET}/tap`, { amount: dec(amount) });
  return walletBalance();
}

interface RegistryContext {
  choiceContext: { choiceContextData: unknown; disclosedContracts: DisclosedContract[] };
  factoryId: string;
}

interface Holding {
  cid: string;
  amount: number;
  locked: boolean;
}

/** A party's Amulet holdings, read through the standard Holding interface. */
export async function amuletHoldings(party: string): Promise<Holding[]> {
  const dso = await dsoParty();
  const hs = await interfaceContracts(party, I.holding);
  return hs
    .map((h) => {
      const v = h.view as { owner: string; instrumentId: { admin: string; id: string }; amount: string; lock: unknown };
      return { cid: h.contractId, owner: v.owner, admin: v.instrumentId.admin, id: v.instrumentId.id, amount: Number(v.amount), locked: v.lock !== null };
    })
    .filter((h) => h.owner === party && h.admin === dso && h.id === AMULET_INSTRUMENT)
    .map(({ cid, amount, locked }) => ({ cid, amount, locked }));
}

export async function amuletBalance(party: string): Promise<{ unlocked: number; locked: number }> {
  const hs = await amuletHoldings(party);
  return {
    unlocked: hs.filter((h) => !h.locked).reduce((s, h) => s + h.amount, 0),
    locked: hs.filter((h) => h.locked).reduce((s, h) => s + h.amount, 0),
  };
}

/** Pick unlocked holdings, largest first, until `need` is covered. */
function cover(holdings: Holding[], need: number): string[] {
  const free = holdings.filter((h) => !h.locked).sort((a, b) => b.amount - a.amount);
  const picked: string[] = [];
  let sum = 0;
  for (const h of free) {
    picked.push(h.cid);
    sum += h.amount;
    if (sum >= need) return picked;
  }
  throw new AmuletError(`Insufficient Canton Coin: have ${sum.toLocaleString()}, need ${need.toLocaleString()}.`);
}

const noMeta = { values: {} };

/**
 * Fund `receiver` with real Canton Coin: faucet → standard TransferFactory from the
 * wallet party → standard TransferInstruction_Accept by the receiver.
 */
export async function fundWithAmulet(receiver: string, amount: number): Promise<{ updateIds: string[] }> {
  requireDevnet();
  const sender = await walletParty();
  const dso = await dsoParty();
  const updateIds: string[] = [];

  // keep the wallet topped up (the faucet pays a fixed multiple, so loop until covered)
  for (let i = 0; i < 4 && (await walletBalance()) < amount + 50; i++) await tapFaucet(amount);
  if ((await walletBalance()) < amount) throw new AmuletError("The DevNet faucet did not fund the wallet.");

  const holdings = await amuletHoldings(sender);
  const now = Date.now();
  const transfer = {
    sender,
    receiver,
    amount: dec(amount),
    instrumentId: { admin: dso, id: AMULET_INSTRUMENT },
    requestedAt: new Date(now - 60_000).toISOString(),
    executeBefore: new Date(now + 3600_000).toISOString(),
    inputHoldingCids: cover(holdings, amount),
    meta: noMeta,
  };
  const reg = await api<RegistryContext>("POST", `${SCAN_PROXY}/registry/transfer-instruction/v1/transfer-factory`, {
    choiceArguments: { expectedAdmin: dso, transfer, extraArgs: { context: { values: {} }, meta: noMeta } },
    excludeDebugFields: true,
  });
  const tx = await submit(
    sender,
    [
      exerciseIn(I.transferFactory, reg.factoryId, "TransferFactory_Transfer", {
        expectedAdmin: dso,
        transfer,
        extraArgs: { context: reg.choiceContext.choiceContextData, meta: noMeta },
      }),
    ],
    { disclosed: reg.choiceContext.disclosedContracts },
  );
  updateIds.push(tx.updateId);

  const out = (exerciseResultOf(tx) as { output?: Tagged } | undefined)?.output;
  if (out?.tag === "TransferInstructionResult_Pending" && out.value?.transferInstructionCid) {
    const instrCid = out.value.transferInstructionCid;
    const ctx = await api<{ choiceContextData: unknown; disclosedContracts: DisclosedContract[] }>(
      "POST",
      `${SCAN_PROXY}/registry/transfer-instruction/v1/${instrCid}/choice-contexts/accept`,
      { meta: {} },
    );
    const accepted = await submit(
      receiver,
      [exerciseIn(I.transferInstruction, instrCid, "TransferInstruction_Accept", { extraArgs: { context: ctx.choiceContextData, meta: noMeta } })],
      { disclosed: ctx.disclosedContracts },
    );
    updateIds.push(accepted.updateId);
  } else if (out?.tag === "TransferInstructionResult_Failed") {
    throw new AmuletError("The registry rejected the Canton Coin transfer.");
  }
  return { updateIds };
}

/**
 * The buyer's payment lock: a standard Allocation from the Amulet registry for the
 * payment leg of settlement `escrowId` (buyer → seller).
 */
export async function allocateAmulet(args: {
  buyer: string;
  seller: string;
  escrowId: string;
  amount: number;
  settleBefore: number;
}): Promise<{ updateId: string; allocationCid?: string }> {
  const dso = await dsoParty();
  const holdings = await amuletHoldings(args.buyer);
  const now = Date.now();
  const allocation = {
    settlement: {
      executor: args.seller,
      settlementRef: { id: args.escrowId, cid: null },
      requestedAt: new Date(now - 60_000).toISOString(),
      allocateBefore: new Date(args.settleBefore).toISOString(),
      settleBefore: new Date(args.settleBefore).toISOString(),
      meta: noMeta,
    },
    transferLegId: "payment",
    transferLeg: {
      sender: args.buyer,
      receiver: args.seller,
      amount: dec(args.amount),
      instrumentId: { admin: dso, id: AMULET_INSTRUMENT },
      meta: noMeta,
    },
  };
  const choice = {
    expectedAdmin: dso,
    allocation,
    requestedAt: new Date(now - 30_000).toISOString(),
    inputHoldingCids: cover(holdings, args.amount),
  };
  const reg = await api<RegistryContext>("POST", `${SCAN_PROXY}/registry/allocation-instruction/v1/allocation-factory`, {
    choiceArguments: { ...choice, extraArgs: { context: { values: {} }, meta: noMeta } },
    excludeDebugFields: true,
  });
  const tx = await submit(
    args.buyer,
    [exerciseIn(I.allocationFactory, reg.factoryId, "AllocationFactory_Allocate", { ...choice, extraArgs: { context: reg.choiceContext.choiceContextData, meta: noMeta } })],
    { disclosed: reg.choiceContext.disclosedContracts },
  );
  const out = (exerciseResultOf(tx) as { output?: Tagged } | undefined)?.output;
  if (out?.tag === "AllocationInstructionResult_Failed") throw new AmuletError("The registry rejected the Canton Coin allocation.");
  return { updateId: tx.updateId, allocationCid: out?.value?.allocationCid };
}

/** Choice context + disclosed contracts the registry needs to execute (or withdraw) an allocation. */
export async function allocationContext(
  allocationCid: string,
  kind: "execute-transfer" | "withdraw" | "cancel",
): Promise<{ context: unknown; disclosed: DisclosedContract[] }> {
  const ctx = await api<{ choiceContextData: unknown; disclosedContracts: DisclosedContract[] }>(
    "POST",
    `${SCAN_PROXY}/registry/allocations/v1/${allocationCid}/choice-contexts/${kind}`,
    { meta: {} },
  );
  return { context: ctx.choiceContextData, disclosed: ctx.disclosedContracts };
}

/** Withdraw the buyer's own allocation through the registry, unlocking the Canton Coin. */
export async function withdrawAllocation(sender: string, allocationCid: string): Promise<{ updateId: string }> {
  const ctx = await allocationContext(allocationCid, "withdraw");
  const tx = await submit(
    sender,
    [exerciseIn(I.allocation, allocationCid, "Allocation_Withdraw", { extraArgs: { context: ctx.context, meta: noMeta } })],
    { disclosed: ctx.disclosed },
  );
  return { updateId: tx.updateId };
}

/** Canton Coin as a registry, for the generic settlement code (scan-proxy, our ledger token). */
export const AMULET_REG: Registry = {
  key: "amulet",
  symbol: AMULET_INSTRUMENT,
  label: "CC",
  tracks: "CC",
  admin: dsoParty,
  call: <T,>(path: string, body?: unknown) => api<T>(body === undefined ? "GET" : "POST", `${SCAN_PROXY}${path}`, body),
};

export { I as AMULET_INTERFACES };
