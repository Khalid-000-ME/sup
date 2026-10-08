import { exerciseIn, interfaceContracts, submit, type DisclosedContract, type Transaction } from "../server/ledger";

/**
 * Canton Token Standard (CIP-56) registries Sup can settle against: Canton Coin (the DSO's
 * registry), BitSafe's CBTC and onRails' cETH (Digital Asset Utility registry). They all
 * expose the same registry API and the same standard choices, so one implementation of
 * "allocate, execute, withdraw, accept" serves every instrument.
 *
 * A registry only differs in where it lives and how it is reached:
 *   - Canton Coin goes through our validator's scan-proxy, with our ledger token.
 *   - Utility registries are public. No credential is ever sent to them: our ledger token
 *     must not leave for a third-party host.
 */
export class RegistryError extends Error {}

export interface Registry {
  key: "amulet" | "cbtc" | "ceth";
  /** The on-ledger instrument id. */
  symbol: string;
  /** What the app shows: "CC" for Amulet, otherwise the symbol. */
  label: string;
  /** What it is priced against on the market board, if anything. */
  tracks?: "BTC" | "ETH" | "CC";
  admin: () => Promise<string>;
  call: <T = unknown>(path: string, body?: unknown) => Promise<T>;
}

const UTILITIES_API =
  process.env.UTILITIES_API ?? "https://api.utilities.digitalasset-dev.com/api/token-standard/v0/registrars";

function utilityRegistry(key: "cbtc" | "ceth", symbol: string, admin: string, tracks: "BTC" | "ETH"): Registry {
  const base = `${UTILITIES_API}/${admin}`;
  return {
    key,
    symbol,
    label: symbol,
    tracks,
    admin: async () => admin,
    async call<T>(path: string, body?: unknown): Promise<T> {
      const r = await fetch(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: unknown };
      if (!r.ok) {
        const detail = typeof j.error === "string" ? j.error : JSON.stringify(j).slice(0, 240);
        throw new RegistryError(`${symbol} registry call failed (${r.status}): ${detail}`);
      }
      return j as T;
    },
  };
}

/**
 * DevNet identifiers, from the issuers' own documentation: BitSafe's CBTC testnet guide
 * and onRails' cETH identifiers page. Override with CBTC_ADMIN / CETH_ADMIN.
 */
export const UTILITY_REGISTRIES: Registry[] = [
  utilityRegistry(
    "cbtc",
    "CBTC",
    process.env.CBTC_ADMIN ?? "cbtc-network::12202a83c6f4082217c175e29bc53da5f2703ba2675778ab99217a5a881a949203ff",
    "BTC",
  ),
  utilityRegistry(
    "ceth",
    "cETH",
    process.env.CETH_ADMIN ?? "rails-cethMain-1-dev::12200b6de051e66bacd250de4bc76292e9d0ef71b478d7c11e49799b8e26f853493e",
    "ETH",
  ),
];

export interface DisclosedContext {
  choiceContextData: unknown;
  disclosedContracts: DisclosedContract[];
}

const I = {
  holding: "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding",
  allocation: "#splice-api-token-allocation-v1:Splice.Api.Token.AllocationV1:Allocation",
  allocationFactory: "#splice-api-token-allocation-instruction-v1:Splice.Api.Token.AllocationInstructionV1:AllocationFactory",
  transferInstruction: "#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction",
};
const noMeta = { values: {} };
const dec = (n: number) => n.toFixed(10);

function exerciseResultOf(tx: Transaction): unknown {
  for (const e of tx.events) if ("ExercisedEvent" in e) return e.ExercisedEvent.exerciseResult;
  return undefined;
}

// ---------------------------------------------------------------- holdings

export interface RegistryHolding {
  cid: string;
  amount: number;
  locked: boolean;
}

export async function holdings(reg: Registry, party: string): Promise<RegistryHolding[]> {
  const admin = await reg.admin();
  const hs = await interfaceContracts(party, I.holding);
  return hs
    .map((h) => {
      const v = h.view as { owner: string; instrumentId: { admin: string; id: string }; amount: string; lock: unknown };
      return { cid: h.contractId, owner: v.owner, admin: v.instrumentId.admin, id: v.instrumentId.id, amount: Number(v.amount), locked: v.lock !== null };
    })
    // Only holdings this party owns: a pending offer also exposes the sender's locked holding to the receiver.
    .filter((h) => h.owner === party && h.admin === admin && h.id === reg.symbol)
    .map(({ cid, amount, locked }) => ({ cid, amount, locked }));
}

export async function balance(reg: Registry, party: string): Promise<{ unlocked: number; locked: number }> {
  const hs = await holdings(reg, party);
  return {
    unlocked: hs.filter((h) => !h.locked).reduce((s, h) => s + h.amount, 0),
    locked: hs.filter((h) => h.locked).reduce((s, h) => s + h.amount, 0),
  };
}

/** Unlocked holdings, largest first, until `need` is covered. */
function cover(hs: RegistryHolding[], need: number, symbol: string): string[] {
  const free = hs.filter((h) => !h.locked).sort((a, b) => b.amount - a.amount);
  const picked: string[] = [];
  let sum = 0;
  for (const h of free) {
    picked.push(h.cid);
    sum += h.amount;
    if (sum >= need - 1e-12) return picked;
  }
  throw new RegistryError(`Insufficient ${symbol}: have ${sum}, need ${need}.`);
}

// ---------------------------------------------------------------- incoming transfers

export interface IncomingTransfer {
  cid: string;
  sender: string;
  amount: number;
  status: string;
}

/** Pending standard transfer offers addressed to `party` in this instrument (e.g. a faucet payout). */
export async function incomingTransfers(reg: Registry, party: string): Promise<IncomingTransfer[]> {
  const admin = await reg.admin();
  const items = await interfaceContracts(party, I.transferInstruction);
  return items
    .map((c) => ({
      cid: c.contractId,
      v: c.view as {
        transfer: { sender: string; receiver: string; amount: string; instrumentId: { admin: string; id: string } };
        status: { tag: string };
      },
    }))
    .filter(({ v }) => v.transfer.receiver === party && v.transfer.instrumentId.admin === admin && v.transfer.instrumentId.id === reg.symbol)
    .map(({ cid, v }) => ({ cid, sender: v.transfer.sender, amount: Number(v.transfer.amount), status: v.status.tag }));
}

export async function acceptTransfer(reg: Registry, receiver: string, instructionCid: string): Promise<{ updateId: string }> {
  const ctx = await reg.call<DisclosedContext>(`/registry/transfer-instruction/v1/${instructionCid}/choice-contexts/accept`, { meta: {} });
  const tx = await submit(
    receiver,
    [exerciseIn(I.transferInstruction, instructionCid, "TransferInstruction_Accept", { extraArgs: { context: ctx.choiceContextData, meta: noMeta } })],
    { disclosed: ctx.disclosedContracts },
  );
  return { updateId: tx.updateId };
}

/** Accept every pending offer for `party` in this instrument. */
export async function acceptAllIncoming(reg: Registry, party: string): Promise<{ accepted: number; amount: number; updateIds: string[] }> {
  const pending = (await incomingTransfers(reg, party)).filter((t) => t.status === "TransferPendingReceiverAcceptance");
  const updateIds: string[] = [];
  let amount = 0;
  for (const t of pending) {
    updateIds.push((await acceptTransfer(reg, party, t.cid)).updateId);
    amount += t.amount;
  }
  return { accepted: pending.length, amount, updateIds };
}

// ---------------------------------------------------------------- settlement legs

interface Tagged {
  tag?: string;
  value?: { allocationCid?: string };
}

/** The buyer's payment lock: a standard Allocation from this registry for settlement `escrowId`. */
export async function allocate(
  reg: Registry,
  args: { buyer: string; seller: string; escrowId: string; amount: number; settleBefore: number },
): Promise<{ updateId: string; allocationCid?: string }> {
  const admin = await reg.admin();
  const hs = await holdings(reg, args.buyer);
  const now = Date.now();
  const choice = {
    expectedAdmin: admin,
    allocation: {
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
        instrumentId: { admin, id: reg.symbol },
        meta: noMeta,
      },
    },
    requestedAt: new Date(now - 30_000).toISOString(),
    inputHoldingCids: cover(hs, args.amount, reg.symbol),
  };
  const ctx = await reg.call<{ choiceContext: DisclosedContext; factoryId: string }>("/registry/allocation-instruction/v1/allocation-factory", {
    choiceArguments: { ...choice, extraArgs: { context: { values: {} }, meta: noMeta } },
    excludeDebugFields: true,
  });
  const tx = await submit(
    args.buyer,
    [exerciseIn(I.allocationFactory, ctx.factoryId, "AllocationFactory_Allocate", { ...choice, extraArgs: { context: ctx.choiceContext.choiceContextData, meta: noMeta } })],
    { disclosed: ctx.choiceContext.disclosedContracts },
  );
  const out = (exerciseResultOf(tx) as { output?: Tagged } | undefined)?.output;
  if (out?.tag === "AllocationInstructionResult_Failed") throw new RegistryError(`The ${reg.symbol} registry rejected the allocation.`);
  return { updateId: tx.updateId, allocationCid: out?.value?.allocationCid };
}

/** Choice context and disclosed contracts the registry needs to execute (or withdraw) an allocation. */
export async function allocationContext(
  reg: Registry,
  allocationCid: string,
  kind: "execute-transfer" | "withdraw" | "cancel",
): Promise<{ context: unknown; disclosed: DisclosedContract[] }> {
  const ctx = await reg.call<DisclosedContext>(`/registry/allocations/v1/${allocationCid}/choice-contexts/${kind}`, { meta: {} });
  return { context: ctx.choiceContextData, disclosed: ctx.disclosedContracts };
}

/** The sender withdraws their own allocation, unlocking the funds. */
export async function withdraw(reg: Registry, sender: string, allocationCid: string): Promise<{ updateId: string }> {
  const ctx = await allocationContext(reg, allocationCid, "withdraw");
  const tx = await submit(
    sender,
    [exerciseIn(I.allocation, allocationCid, "Allocation_Withdraw", { extraArgs: { context: ctx.context, meta: noMeta } })],
    { disclosed: ctx.disclosed },
  );
  return { updateId: tx.updateId };
}
