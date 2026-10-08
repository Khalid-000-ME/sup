import fs from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { ledgerUserId, partyNamespace } from "../server/auth";
import {
  SUP_DAR_PATH,
  SUP_PACKAGE_NAME,
  SUP_PARTY_BASE,
  isDevnet,
  LOCAL_APP_USER_ID,
} from "../server/config";
import {
  actAs,
  activeContracts,
  allocateParty,
  createIn,
  createUser,
  exerciseIn,
  getUser,
  grantRights,
  interfaceContracts,
  ledgerEnd,
  splitTemplate,
  updateById,
  ledgerVersion,
  listParties,
  listRights,
  submit,
  tidOf,
  uploadDar,
  type Command,
  type Contract,
  type Transaction,
} from "../server/ledger";
import { withDepth } from "../server/errors";
import { AMULET_INTERFACES, AMULET_REG, fundWithAmulet } from "./amulet";
import {
  UTILITY_REGISTRIES,
  acceptAllIncoming,
  allocate as registryAllocate,
  allocationContext,
  balance as registryBalance,
  withdraw as registryWithdraw,
  type Registry,
} from "./registry";
import {
  SUP_ORDER,
  SUP_PERSONAS,
  ASSET_CLASS,
  CASH_CURRENCY,
  CUSTODY_ROLES,
  type SupRole,
} from "./personas";
import { addBond, findBond, getDocRef, listBonds, logEvent, setDocRef } from "./store";
import type { PartyRef as SharedPartyRef, TxEvent, TxView } from "../shared/types";
import type {
  SupActionResult,
  StandardAllocation,
  StandardHolding,
  StandardView,
  SupState,
  ConditionRequestView,
  ConditionResultView,
  EscrowView,
  Holding,
  LockView,
  PartyRef,
  ProposalView,
  ReceiptView,
} from "./types";

// ---------------------------------------------------------------- template ids

const T = {
  AssetToken: tidOf(SUP_PACKAGE_NAME, "Sup.Assets", "AssetToken"),
  CashToken: tidOf(SUP_PACKAGE_NAME, "Sup.Assets", "CashToken"),
  Custody: tidOf(SUP_PACKAGE_NAME, "Sup.Escrow", "Custody"),
  CustodyInvite: tidOf(SUP_PACKAGE_NAME, "Sup.Escrow", "CustodyInvite"),
  TradeProposal: tidOf(SUP_PACKAGE_NAME, "Sup.Escrow", "TradeProposal"),
  EscrowTrade: tidOf(SUP_PACKAGE_NAME, "Sup.Escrow", "EscrowTrade"),
  LockedAsset: tidOf(SUP_PACKAGE_NAME, "Sup.Escrow", "LockedAsset"),
  LockedPayment: tidOf(SUP_PACKAGE_NAME, "Sup.Escrow", "LockedPayment"),
  ConditionRequest: tidOf(SUP_PACKAGE_NAME, "Sup.Escrow", "ConditionRequest"),
  ConditionApproval: tidOf(SUP_PACKAGE_NAME, "Sup.Escrow", "ConditionApproval"),
  ConditionRejection: tidOf(SUP_PACKAGE_NAME, "Sup.Escrow", "ConditionRejection"),
  SettlementReceipt: tidOf(SUP_PACKAGE_NAME, "Sup.Escrow", "SettlementReceipt"),
};

export class SupError extends Error {}

const dec = (n: number) => n.toFixed(10);
const num = (v: unknown) => Number(v);
const ms = (v: unknown) => Date.parse(String(v));
const str = (v: unknown) => String(v);
const optStr = (v: unknown) => (v === null || v === undefined ? undefined : String(v));
const EPS = 1e-9;
/**
 * Registries whose tokens Sup settles but does not issue: Canton Coin, CBTC, cETH.
 * Payment in one of these is an external Allocation; payment in CashUSD is a Sup lock.
 */
const EXTERNALS: Registry[] = [AMULET_REG, ...UTILITY_REGISTRIES];
const externalBySymbol = (id: string) => EXTERNALS.find((r) => r.symbol === id);
const externalByKey = (k: string) => EXTERNALS.find((r) => r.key === k);
/** Display name for an instrument id: the DSO's "Amulet" is Canton Coin. */
const ccy = (c: string) => externalBySymbol(c)?.label ?? c;
const BOND_LABEL = ASSET_CLASS;

export const supPartyName = (role: SupRole) =>
  SUP_PERSONAS[role].name.replace(/^sup/, SUP_PARTY_BASE);

// ---------------------------------------------------------------- world

export interface SupWorld {
  parties: Record<SupRole, string>;
  roleOf: (party: string) => SupRole | undefined;
  ref: (party: string) => PartyRef;
  network: "local" | "devnet";
}

declare global {
  var __supWorld: Promise<SupWorld> | undefined;
}

export function getSupWorld(): Promise<SupWorld> {
  if (!globalThis.__supWorld) {
    globalThis.__supWorld = bootstrap().catch((e) => {
      globalThis.__supWorld = undefined;
      throw e;
    });
  }
  return globalThis.__supWorld;
}

function makeWorld(parties: Record<SupRole, string>): SupWorld {
  const byParty = new Map<string, SupRole>(SUP_ORDER.map((r) => [parties[r], r]));
  return {
    parties,
    network: isDevnet ? "devnet" : "local",
    roleOf: (p) => byParty.get(p),
    ref: (p) => {
      const role = byParty.get(p);
      return { party: p, role, name: role ? SUP_PERSONAS[role].label : p.split("::")[0] };
    },
  };
}

export async function readSupDar(): Promise<Uint8Array> {
  return fs.readFile(SUP_DAR_PATH).catch(() => {
    throw new Error(`Sup DAR not found at ${SUP_DAR_PATH}. Run "npm run sup:build" first.`);
  });
}

export interface SupDevnetStatus {
  namespace: string;
  parties: { role: SupRole; name: string; party?: string; canActAs: boolean }[];
  missing: SupRole[];
  noRights: SupRole[];
}

export async function supDevnetStatus(): Promise<SupDevnetStatus> {
  const [userId, namespace] = await Promise.all([ledgerUserId(), partyNamespace()]);
  const rights = await listRights(userId);
  const parties = SUP_ORDER.map((role) => {
    const local = `${namespace}${supPartyName(role)}`;
    const match = rights.find((r) => r.party === local || r.party.startsWith(`${local}::`));
    return { role, name: supPartyName(role), party: match?.party, canActAs: match?.canActAs ?? false };
  });
  return {
    namespace,
    parties,
    missing: parties.filter((p) => !p.party).map((p) => p.role),
    noRights: parties.filter((p) => p.party && !p.canActAs).map((p) => p.role),
  };
}

async function bootstrap(): Promise<SupWorld> {
  const world = isDevnet ? await bootstrapDevnet() : await bootstrapLocal();
  for (const role of CUSTODY_ROLES) await ensureCustody(world, role);
  return world;
}

async function bootstrapLocal(): Promise<SupWorld> {
  await uploadDar(await readSupDar());
  const existing = await listParties();
  const parties = {} as Record<SupRole, string>;
  for (const role of SUP_ORDER) {
    const hint = supPartyName(role);
    const found = existing.find((p) => p.party.startsWith(`${hint}::`));
    parties[role] = found ? found.party : await allocateParty(hint);
  }
  const rights = SUP_ORDER.map((r) => actAs(parties[r]));
  if (await getUser(LOCAL_APP_USER_ID)) await grantRights(LOCAL_APP_USER_ID, rights);
  else await createUser(LOCAL_APP_USER_ID, rights);
  return makeWorld(parties);
}

async function bootstrapDevnet(): Promise<SupWorld> {
  const status = await supDevnetStatus();
  if (status.missing.length || status.noRights.length) {
    const lines: string[] = [];
    if (status.missing.length)
      lines.push(
        `Missing Sup parties on the shared node: ${status.missing.map(supPartyName).join(", ")}. ` +
          `Create them in the Node Console with exactly those names.`,
      );
    if (status.noRights.length)
      lines.push(`No can-act-as for: ${status.noRights.map(supPartyName).join(", ")}.`);
    lines.push(`Run "npm run sup:devnet" for the full checklist.`);
    throw new Error(lines.join(" "));
  }
  const parties = {} as Record<SupRole, string>;
  for (const p of status.parties) parties[p.role] = p.party!;
  return makeWorld(parties);
}

/** The issuer that co-signs custody for each role. */
const custodyIssuer = (role: SupRole): SupRole => (role === "seller" ? "assetIssuer" : "cashIssuer");

async function ensureCustody(world: SupWorld, role: SupRole): Promise<void> {
  const owner = world.parties[role];
  const issuer = world.parties[custodyIssuer(role)];
  const acs = await acsFor(owner);
  if (acs.some((c) => c.name === "Custody" && c.payload.owner === owner && c.payload.issuer === issuer)) return;
  let invite = acs.find((c) => c.name === "CustodyInvite" && c.payload.owner === owner && c.payload.issuer === issuer)?.contractId;
  if (!invite) {
    const tx = await submit(issuer, [createIn(T.CustodyInvite, { issuer, owner })]);
    for (const e of tx.events)
      if ("CreatedEvent" in e && e.CreatedEvent.templateId.endsWith(":CustodyInvite")) invite = e.CreatedEvent.contractId;
  }
  if (!invite) throw new Error(`Could not create a custody invite for ${role}`);
  await submit(owner, [exerciseIn(T.CustodyInvite, invite, "AcceptCustody")]);
}

const acsFor = (party: string, offset?: number) => activeContracts(party, offset, undefined, SUP_PACKAGE_NAME);

async function custodyCid(world: SupWorld, role: SupRole): Promise<string> {
  const owner = world.parties[role];
  const issuer = world.parties[custodyIssuer(role)];
  const acs = await acsFor(owner);
  const c = acs.find((x) => x.name === "Custody" && x.payload.owner === owner && x.payload.issuer === issuer);
  if (!c) throw new SupError(`${SUP_PERSONAS[role].label} has no custody account.`);
  return c.contractId;
}

// ---------------------------------------------------------------- state

function parse(world: SupWorld, party: string, contracts: Contract[]) {
  const assets: Holding[] = [];
  const cash: Holding[] = [];
  const proposals: ProposalView[] = [];
  const escrows: EscrowView[] = [];
  const locks: LockView[] = [];
  const conditionRequests: ConditionRequestView[] = [];
  const conditionResults: ConditionResultView[] = [];
  const receipts: ReceiptView[] = [];

  const optParty = (v: unknown): PartyRef | undefined =>
    v === null || v === undefined ? undefined : world.ref(String(v));

  for (const c of contracts) {
    const p = c.payload;
    switch (c.name) {
      case "AssetToken":
        if (p.owner === party) assets.push({ cid: c.contractId, quantity: num(p.quantity), label: str(p.assetClass) });
        break;
      case "CashToken":
        if (p.owner === party) cash.push({ cid: c.contractId, quantity: num(p.amount), label: str(p.currency) });
        break;
      case "TradeProposal":
        proposals.push({
          cid: c.contractId,
          escrowId: str(p.escrowId),
          seller: world.ref(str(p.seller)),
          buyer: world.ref(str(p.buyer)),
          agent: optParty(p.settlementAgent),
          auditor: optParty(p.auditor),
          assetClass: str((p.assetDescriptor as Record<string, unknown>).classId),
          assetQuantity: num(p.assetQuantity),
          currency: ccy(str((p.cashDescriptor as Record<string, unknown>).currency)),
          cashAmount: num(p.cashAmount),
          documentHash: optStr(p.documentHash),
          expiry: ms(p.expiry),
          proposedAt: ms(p.proposedAt),
          mine: p.seller === party,
        });
        break;
      case "EscrowTrade":
        escrows.push({
          cid: c.contractId,
          escrowId: str(p.escrowId),
          seller: world.ref(str(p.seller)),
          buyer: world.ref(str(p.buyer)),
          agent: optParty(p.settlementAgent),
          auditor: optParty(p.auditor),
          assetClass: str((p.assetDescriptor as Record<string, unknown>).classId),
          assetQuantity: num(p.assetQuantity),
          currency: ccy(str((p.cashDescriptor as Record<string, unknown>).currency)),
          cashAmount: num(p.cashAmount),
          documentHash: optStr(p.documentHash),
          expiry: ms(p.expiry),
          acceptedAt: ms(p.acceptedAt),
        });
        break;
      case "LockedAsset":
        locks.push({
          cid: c.contractId,
          escrowId: str(p.escrowId),
          kind: "asset",
          quantity: num(p.quantity),
          label: str(p.assetClass),
          lockedAt: ms(p.lockedAt),
          expiry: ms(p.expiry),
        });
        break;
      case "LockedPayment":
        locks.push({
          cid: c.contractId,
          escrowId: str(p.escrowId),
          kind: "payment",
          quantity: num(p.amount),
          label: str(p.currency),
          lockedAt: ms(p.lockedAt),
          expiry: ms(p.expiry),
        });
        break;
      case "ConditionRequest":
        conditionRequests.push({
          cid: c.contractId,
          escrowId: str(p.escrowId),
          seller: world.ref(str(p.seller)),
          buyer: world.ref(str(p.buyer)),
          documentHash: str(p.documentHash),
          requestedAt: ms(p.requestedAt),
          expiry: ms(p.expiry),
        });
        break;
      case "ConditionApproval":
        conditionResults.push({
          cid: c.contractId,
          escrowId: str(p.escrowId),
          documentHash: str(p.documentHash),
          approved: true,
          at: ms(p.approvedAt),
        });
        break;
      case "ConditionRejection":
        conditionResults.push({
          cid: c.contractId,
          escrowId: str(p.escrowId),
          documentHash: str(p.documentHash),
          approved: false,
          reason: str(p.reason),
          at: ms(p.rejectedAt),
        });
        break;
      case "SettlementReceipt":
        receipts.push({
          cid: c.contractId,
          escrowId: str(p.escrowId),
          seller: world.ref(str(p.seller)),
          buyer: world.ref(str(p.buyer)),
          assetClass: str(p.assetClass),
          assetQuantity: num(p.assetQuantity),
          currency: ccy(str(p.currency)),
          cashAmount: num(p.cashAmount),
          outcome: str(p.outcome) as ReceiptView["outcome"],
          settledAt: ms(p.settledAt),
        });
        break;
    }
  }
  const desc = (a: { quantity: number }, b: { quantity: number }) => b.quantity - a.quantity;
  assets.sort(desc);
  cash.sort(desc);
  proposals.sort((a, b) => b.proposedAt - a.proposedAt);
  escrows.sort((a, b) => b.acceptedAt - a.acceptedAt);
  return { assets, cash, proposals, escrows, locks, conditionRequests, conditionResults, receipts };
}

export async function buildSupState(role: SupRole): Promise<SupState> {
  const world = await getSupWorld();
  const party = world.parties[role];
  const offset = await ledgerEnd();
  const [contracts, version] = await Promise.all([acsFor(party, offset), ledgerVersion()]);
  const parsed = parse(world, party, contracts);
  const custodyReady = CUSTODY_ROLES.includes(role)
    ? contracts.some((c) => c.name === "Custody" && c.payload.owner === party)
    : true;

  // Real Canton Coin (DevNet): payment locks created by the Amulet registry are
  // standard Allocations, not Sup contracts, so they come from the interface query.
  let amulet: SupState["amulet"];
  let external: SupState["external"];
  if (world.network === "devnet") {
    const externals = await externalAllocations(party, offset);
    for (const a of externals) {
      parsed.locks.push({
        cid: a.cid,
        escrowId: a.ref,
        kind: a.legId === "asset" ? "asset" : "payment",
        quantity: a.amount,
        label: ccy(a.instrument),
        lockedAt: a.requestedAt,
        expiry: a.settleBefore,
        external: true,
      });
    }
    if (CUSTODY_ROLES.includes(role)) {
      amulet = await registryBalance(AMULET_REG, party).catch(() => undefined);
      external = {};
      await Promise.all(
        UTILITY_REGISTRIES.map(async (r) => {
          const b = await registryBalance(r, party).catch(() => undefined);
          if (b && external) external[r.symbol] = b;
        }),
      );
    }
  }
  return {
    serverNow: Date.now(),
    role,
    party,
    ledger: { offset, version, network: world.network },
    custodyReady,
    ...parsed,
    contractCount: contracts.length,
    amulet,
    external,
  };
}

interface AllocationViewShape {
  allocation: {
    settlement: { settlementRef: { id: string }; requestedAt: string; settleBefore: string };
    transferLegId: string;
    transferLeg: { sender: string; receiver: string; amount: string; instrumentId: { id: string } };
  };
}

interface ExternalAllocation {
  cid: string;
  template: string;
  ref: string;
  legId: string;
  amount: number;
  instrument: string;
  sender: string;
  receiver: string;
  requestedAt: number;
  settleBefore: number;
}

/** Standard Allocations visible to `party` that were NOT created by Sup (i.e. an external registry's). */
async function externalAllocations(party: string, offset?: number): Promise<ExternalAllocation[]> {
  const all = await interfaceContracts(party, AMULET_INTERFACES.allocation, offset);
  return all
    .filter((a) => !a.template.startsWith("Sup.Escrow:"))
    .map((a) => {
      const al = (a.view as unknown as AllocationViewShape).allocation;
      return {
        cid: a.contractId,
        template: a.template,
        ref: String(al.settlement.settlementRef.id),
        legId: String(al.transferLegId),
        amount: Number(al.transferLeg.amount),
        instrument: String(al.transferLeg.instrumentId.id),
        sender: String(al.transferLeg.sender),
        receiver: String(al.transferLeg.receiver),
        requestedAt: Date.parse(al.settlement.requestedAt),
        settleBefore: Date.parse(al.settlement.settleBefore),
      };
    });
}

// ---------------------------------------------------------------- Canton Token Standard view

/** Standard interface ids, by package name (resolved by the node). */
const HOLDING_IFACE = "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding";
const ALLOCATION_IFACE = "#splice-api-token-allocation-v1:Splice.Api.Token.AllocationV1:Allocation";

/**
 * Reads this party's tokens through the standard `Holding` and `Allocation`
 * interfaces only — no Sup template knowledge — exactly as a generic CIP-56
 * wallet or explorer would.
 */
export async function buildStandardView(role: SupRole): Promise<StandardView> {
  const world = await getSupWorld();
  const party = world.parties[role];
  const offset = await ledgerEnd();
  const [holdings, allocations] = await Promise.all([
    interfaceContracts(party, HOLDING_IFACE, offset),
    interfaceContracts(party, ALLOCATION_IFACE, offset),
  ]);
  const ref = (v: unknown) => world.ref(String(v));
  const asNum = (v: unknown) => Number(v);

  const hs: StandardHolding[] = holdings.map((h) => {
    const v = h.view as {
      owner: string;
      instrumentId: { admin: string; id: string };
      amount: string;
      lock: { holders: string[]; expiresAt?: string | null; context?: string | null } | null;
    };
    return {
      cid: h.contractId,
      implementedBy: h.template,
      owner: ref(v.owner),
      instrumentAdmin: ref(v.instrumentId.admin),
      instrumentId: v.instrumentId.id,
      amount: asNum(v.amount),
      locked: v.lock !== null && v.lock !== undefined,
      lockHolders: (v.lock?.holders ?? []).map(ref),
      lockContext: v.lock?.context ?? undefined,
      lockExpiresAt: v.lock?.expiresAt ? ms(v.lock.expiresAt) : undefined,
    };
  });

  const as: StandardAllocation[] = allocations.map((a) => {
    const v = a.view as {
      allocation: {
        settlement: { executor: string; settlementRef: { id: string }; settleBefore: string };
        transferLegId: string;
        transferLeg: { sender: string; receiver: string; amount: string; instrumentId: { admin: string; id: string } };
      };
    };
    const al = v.allocation;
    return {
      cid: a.contractId,
      implementedBy: a.template,
      settlementRef: al.settlement.settlementRef.id,
      transferLegId: al.transferLegId,
      sender: ref(al.transferLeg.sender),
      receiver: ref(al.transferLeg.receiver),
      amount: asNum(al.transferLeg.amount),
      instrumentId: al.transferLeg.instrumentId.id,
      instrumentAdmin: ref(al.transferLeg.instrumentId.admin),
      executor: ref(al.settlement.executor),
      settleBefore: ms(al.settlement.settleBefore),
    };
  });

  hs.sort((x, y) => Number(x.locked) - Number(y.locked) || y.amount - x.amount);
  return {
    holdings: hs,
    allocations: as,
    interfaces: {
      holding: "splice-api-token-holding-v1 · Splice.Api.Token.HoldingV1",
      allocation: "splice-api-token-allocation-v1 · Splice.Api.Token.AllocationV1",
    },
  };
}

// ---------------------------------------------------------------- transactions & activity

/** A committed transaction as one party sees it: only the events delivered to that party. */
export async function buildSupTx(role: SupRole, updateId: string): Promise<TxView | null> {
  const world = await getSupWorld();
  const tx = await updateById(world.parties[role], updateId);
  if (!tx) return null;
  const pref = (p: string): SharedPartyRef => ({ party: p, name: world.ref(p).name });
  const events: TxEvent[] = withDepth(tx).map(({ ev, depth }) => {
    if ("CreatedEvent" in ev) {
      const c = ev.CreatedEvent;
      return {
        kind: "created",
        template: splitTemplate(c.templateId).name,
        contractId: c.contractId,
        signatories: c.signatories.map(pref),
        observers: c.observers.map(pref),
        payload: c.createArgument,
        depth,
      };
    }
    if ("ExercisedEvent" in ev) {
      const x = ev.ExercisedEvent;
      return {
        kind: "exercised",
        template: splitTemplate(x.templateId).name,
        contractId: x.contractId,
        choice: x.choice,
        consuming: x.consuming,
        actingParties: x.actingParties.map(pref),
        payload: x.choiceArgument && typeof x.choiceArgument === "object" ? (x.choiceArgument as Record<string, unknown>) : undefined,
        depth,
      };
    }
    const a = ev.ArchivedEvent;
    return { kind: "archived", template: splitTemplate(a.templateId).name, contractId: a.contractId, depth };
  });
  return { updateId: tx.updateId, offset: tx.offset, effectiveAt: Date.parse(tx.effectiveAt), viewer: role, events, eventCount: events.length };
}


// ---------------------------------------------------------------- read cache

/**
 * Every open page polls its party's state. Without a cache, upstream ledger calls grow with
 * the number of visitors; with it they are bounded by (parties x 1 / TTL). Concurrent callers
 * share one in-flight request, and any action clears the cache so a write is never read stale.
 */
const READ_TTL_MS = 1500;
declare global {
  var __supReads: Map<string, { at: number; value: Promise<unknown> }> | undefined;
}
const reads = () => (globalThis.__supReads ??= new Map());

function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = reads().get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<T>;
  const value = load().catch((e) => {
    reads().delete(key);
    throw e;
  });
  reads().set(key, { at: Date.now(), value });
  return value;
}
export const clearReadCache = () => reads().clear();

export const getSupState = (role: SupRole) => cached(`state:${role}`, READ_TTL_MS, () => buildSupState(role));
export const getStandardView = (role: SupRole) => cached(`std:${role}`, 3 * READ_TTL_MS, () => buildStandardView(role));

// ---------------------------------------------------------------- actions

const roleEnum = z.enum(["assetIssuer", "cashIssuer", "seller", "buyer", "agent", "auditor", "outsider"]);

export const supActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("faucet"),
    asset: z.enum(["asset", "cash", "amulet"]),
    amount: z.number().positive(),
    /** Which bond to issue (asset only). Defaults to the first registered bond. */
    assetClass: z.string().max(24).optional(),
  }),
  z.object({
    type: z.literal("createBond"),
    symbol: z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,19}$/, "Use 3-20 capitals, digits or dashes, e.g. TBILL-2027"),
    name: z.string().min(2).max(60),
    faceValue: z.number().positive(),
    couponPct: z.number().min(0).max(100),
    maturity: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    description: z.string().max(200),
  }),
  z.object({ type: z.literal("buy"), proposalCid: z.string().min(1) }),
  /** Accept pending standard transfers (for example a faucet payout) of an external instrument. */
  z.object({ type: z.literal("claim"), instrument: z.enum(["cbtc", "ceth"]) }),
  z.object({ type: z.literal("deliver"), escrowCid: z.string().min(1) }),
  z.object({
    type: z.literal("propose"),
    buyer: roleEnum,
    assetClass: z.string().max(24).optional(),
    assetQuantity: z.number().positive(),
    cashAmount: z.number().positive(),
    /** "test" = the CashUSD test token; "amulet" = real Canton Coin (DevNet). */
    payment: z.enum(["test", "amulet", "cbtc", "ceth"]).optional(),
    withAgent: z.boolean(),
    documentRef: z.string().max(120).optional(),
    withAuditor: z.boolean(),
    expirySecs: z.number().int().min(30),
  }),
  z.object({ type: z.literal("accept"), proposalCid: z.string().min(1) }),
  z.object({ type: z.literal("rejectProposal"), proposalCid: z.string().min(1) }),
  z.object({ type: z.literal("withdrawProposal"), proposalCid: z.string().min(1) }),
  z.object({ type: z.literal("lockAsset"), escrowCid: z.string().min(1) }),
  z.object({ type: z.literal("lockPayment"), escrowCid: z.string().min(1) }),
  z.object({ type: z.literal("approve"), requestCid: z.string().min(1), documentRef: z.string().max(120).optional() }),
  z.object({ type: z.literal("reject"), requestCid: z.string().min(1), reason: z.string().min(1).max(200) }),
  z.object({ type: z.literal("settle"), escrowCid: z.string().min(1) }),
  z.object({ type: z.literal("cancel"), escrowCid: z.string().min(1) }),
  z.object({ type: z.literal("reclaim"), lockCid: z.string().min(1) }),
  z.object({ type: z.literal("closeExpired"), escrowCid: z.string().min(1) }),
]);
export type SupAction = z.infer<typeof supActionSchema>;

function rootResults(tx: Transaction): unknown[] {
  return withDepth(tx)
    .filter((x) => x.depth === 0 && "ExercisedEvent" in x.ev)
    .map((x) => (x.ev as { ExercisedEvent: { exerciseResult: unknown } }).ExercisedEvent.exerciseResult);
}

const result = (tx: Transaction, summary: string, data?: unknown): SupActionResult => ({
  ok: true,
  updateId: tx.updateId,
  offset: tx.offset,
  summary,
  data,
});

function requireRole(role: SupRole, allowed: SupRole[], what: string) {
  if (!allowed.includes(role)) throw new SupError(`${SUP_PERSONAS[role].label} cannot ${what}.`);
}

/** Merge holdings until one covers `need`, then return its contract id. */
async function ensureHolding(
  world: SupWorld,
  role: SupRole,
  kind: "AssetToken" | "CashToken",
  need: number,
  instrument: string,
): Promise<string> {
  const party = world.parties[role];
  const acs = await acsFor(party);
  const field = kind === "AssetToken" ? "quantity" : "amount";
  const holds = acs
    .filter(
      (c) =>
        c.name === kind &&
        c.payload.owner === party &&
        c.payload[kind === "AssetToken" ? "assetClass" : "currency"] === instrument,
    )
    .map((c) => ({ cid: c.contractId, amount: Number(c.payload[field]) }))
    .sort((a, b) => b.amount - a.amount);
  const total = holds.reduce((s, h) => s + h.amount, 0);
  const label = instrument;
  if (total + EPS < need)
    throw new SupError(`Insufficient ${label}: you hold ${total.toLocaleString()}, need ${need.toLocaleString()}. Add funds first.`);
  const fit = [...holds].reverse().find((h) => h.amount + EPS >= need);
  if (fit) return fit.cid;
  let cur = holds[0];
  for (const next of holds.slice(1)) {
    const tid = kind === "AssetToken" ? T.AssetToken : T.CashToken;
    const tx = await submit(party, [exerciseIn(tid, cur.cid, `${kind}_Merge`, { otherCid: next.cid })]);
    cur = { cid: rootResults(tx)[0] as string, amount: cur.amount + next.amount };
    if (cur.amount + EPS >= need) break;
  }
  return cur.cid;
}

function findEscrow(contracts: Contract[], cid: string): Contract {
  const c = contracts.find((x) => x.contractId === cid && x.name === "EscrowTrade");
  if (!c) throw new SupError("Trade not found or not visible to you.");
  return c;
}

async function runSupActionInner(role: SupRole, action: SupAction): Promise<SupActionResult> {
  const world = await getSupWorld();
  const party = world.parties[role];

  switch (action.type) {
    case "faucet": {
      if (role === "assetIssuer" || role === "cashIssuer")
        throw new SupError("Issuers mint to others; pick the seller or the buyer.");
      if (action.asset === "amulet") {
        requireRole(role, ["seller", "buyer"], "receive Canton Coin");
        if (action.amount > 5000) throw new SupError("Canton Coin faucet limit is 5,000 per request.");
        const funded = await fundWithAmulet(party, action.amount);
        return {
          ok: true,
          updateId: funded.updateIds[funded.updateIds.length - 1],
          summary: `Received ${action.amount.toLocaleString()} real Canton Coin via the standard TransferFactory`,
          data: { updateIds: funded.updateIds },
        };
      }
      const isAsset = action.asset === "asset";
      const bondClass = action.assetClass ?? listBonds()[0].symbol;
      if (isAsset && !findBond(bondClass)) throw new SupError(`Unknown bond ${bondClass}. Create it first.`);
      const issuer = world.parties[isAsset ? "assetIssuer" : "cashIssuer"];
      const cmd = isAsset
        ? createIn(T.AssetToken, {
            issuer,
            owner: party,
            assetClass: bondClass,
            quantity: dec(action.amount),
            metadataHash: "ISIN-TEST-0001",
          })
        : createIn(T.CashToken, { issuer, owner: party, currency: CASH_CURRENCY, amount: dec(action.amount) });
      const tx = await submit(issuer, [cmd]);
      return result(
        tx,
        `Issued ${action.amount.toLocaleString()} ${isAsset ? bondClass : CASH_CURRENCY} to ${SUP_PERSONAS[role].label}`,
      );
    }

    case "propose": {
      requireRole(role, ["seller"], "propose a trade");
      if (action.buyer === role) throw new SupError("The seller cannot be the buyer.");
      const bond = findBond(action.assetClass ?? listBonds()[0].symbol);
      if (!bond) throw new SupError(`Unknown bond ${action.assetClass}. Create it under Bonds first.`);
      const now = Date.now();
      const escrowId = `TRADE-${randomBytes(3).toString("hex").toUpperCase()}`;
      const payReg = action.payment && action.payment !== "test" ? externalByKey(action.payment) : undefined;
      const cashDescriptor = payReg
        ? { issuer: await payReg.admin(), currency: payReg.symbol }
        : { issuer: world.parties.cashIssuer, currency: CASH_CURRENCY };
      const docRef = action.withAgent ? (action.documentRef?.trim() || `DOC-${randomBytes(2).toString("hex").toUpperCase()}`) : undefined;
      // Only a hash of the reference goes on the ledger.
      const documentHash = docRef ? createHash("sha256").update(docRef, "utf8").digest("hex").slice(0, 32) : null;
      const tx = await submit(party, [
        createIn(T.TradeProposal, {
          escrowId,
          seller: party,
          buyer: world.parties[action.buyer],
          settlementAgent: action.withAgent ? world.parties.agent : null,
          auditor: action.withAuditor ? world.parties.auditor : null,
          assetDescriptor: { issuer: world.parties.assetIssuer, symbol: bond.symbol, classId: bond.symbol },
          assetQuantity: dec(action.assetQuantity),
          cashDescriptor,
          cashAmount: dec(action.cashAmount),
          documentHash,
          expiry: new Date(now + action.expirySecs * 1000).toISOString(),
          proposedAt: new Date(now).toISOString(),
        }),
      ]);
      if (docRef) setDocRef(escrowId, docRef);
      return result(tx, `Private offer ${escrowId} sent to ${SUP_PERSONAS[action.buyer].label}`, { escrowId, docRef });
    }

    case "claim": {
      requireRole(role, ["seller", "buyer"], "claim tokens");
      const reg = externalByKey(action.instrument)!;
      const r = await acceptAllIncoming(reg, party);
      if (!r.accepted) throw new SupError(`No pending ${reg.label} transfer for you yet. Request it from the issuer's faucet first.`);
      return { ok: true, updateId: r.updateIds[r.updateIds.length - 1], summary: `Received ${r.amount} real ${reg.label}`, data: r };
    }

    case "createBond": {
      requireRole(role, ["seller"], "create a bond");
      if (new Date(action.maturity).getTime() < Date.now()) throw new SupError("Maturity must be in the future.");
      const bond = addBond({
        symbol: action.symbol,
        name: action.name,
        faceValue: action.faceValue,
        couponPct: action.couponPct,
        maturity: action.maturity,
        description: action.description,
      });
      return { ok: true, summary: `Created ${bond.symbol}. Issue units to start selling it.`, data: { symbol: bond.symbol } };
    }

    case "buy": {
      requireRole(role, ["buyer"], "buy");
      const prop = (await acsFor(party)).find((c) => c.contractId === action.proposalCid && c.name === "TradeProposal");
      if (!prop) throw new SupError("That offer is no longer available.");
      const need = Number(prop.payload.cashAmount);
      const currency = str((prop.payload.cashDescriptor as Record<string, unknown>).currency);
      // Check funds before accepting, so a failed buy never leaves a half-open trade.
      const payExt = externalBySymbol(currency);
      const have = payExt
        ? (await registryBalance(payExt, party)).unlocked
        : (await acsFor(party))
              .filter((c) => c.name === "CashToken" && c.payload.owner === party && c.payload.currency === currency)
              .reduce((t, c) => t + Number(c.payload.amount), 0);
      if (have + EPS < need)
        throw new SupError(`You hold ${have.toLocaleString()} ${ccy(currency)} and this costs ${need.toLocaleString()}. Add funds first.`);
      const acc = await runSupAction(role, { type: "accept", proposalCid: action.proposalCid });
      const escrowCid = (acc.data as { escrowCid: string }).escrowCid;
      const pay = await runSupAction(role, { type: "lockPayment", escrowCid });
      const auto = await trySettleById(str(prop.payload.escrowId));
      return {
        ok: true,
        updateId: auto.result?.updateId ?? pay.updateId,
        summary: auto.result ? "Bought. The bond was already locked, so the trade settled." : "Bought. Your payment is locked until the seller delivers.",
        data: { escrowCid, settled: Boolean(auto.result) },
      };
    }

    case "deliver": {
      requireRole(role, ["seller"], "deliver");
      const esc = findEscrow(await acsFor(party), action.escrowCid);
      const locked = await runSupAction(role, { type: "lockAsset", escrowCid: action.escrowCid });
      const auto = await trySettleById(str(esc.payload.escrowId));
      return {
        ok: true,
        updateId: auto.result?.updateId ?? locked.updateId,
        summary: auto.result
          ? "Delivered. Payment was locked, so the trade settled."
          : esc.payload.settlementAgent
            ? "Bond locked. Waiting for the settlement agent to confirm delivery."
            : "Bond locked. Waiting for the buyer's payment.",
        data: { settled: Boolean(auto.result), settleError: auto.error },
      };
    }

    case "accept": {
      const tx = await submit(party, [exerciseIn(T.TradeProposal, action.proposalCid, "AcceptTrade")]);
      const res = rootResults(tx)[0] as { _1: string; _2: string | null };
      return result(tx, `Trade accepted — escrow is now active`, { escrowCid: res?._1 });
    }

    case "rejectProposal": {
      const tx = await submit(party, [exerciseIn(T.TradeProposal, action.proposalCid, "RejectProposal")]);
      return result(tx, "Proposal rejected");
    }

    case "withdrawProposal": {
      const tx = await submit(party, [exerciseIn(T.TradeProposal, action.proposalCid, "WithdrawProposal")]);
      return result(tx, "Proposal withdrawn");
    }

    case "lockAsset": {
      requireRole(role, ["seller"], "lock the asset leg");
      const acs = await acsFor(party);
      const escrow = findEscrow(acs, action.escrowCid);
      const qty = Number(escrow.payload.assetQuantity);
      const custody = await custodyCid(world, "seller");
      const assetClass = str((escrow.payload.assetDescriptor as Record<string, unknown>).classId);
      const assetCid = await ensureHolding(world, "seller", "AssetToken", qty, assetClass);
      const tx = await submit(party, [
        exerciseIn(T.Custody, custody, "LockAssetLeg", { escrowCid: action.escrowCid, assetCid }),
      ]);
      return result(tx, `Locked ${qty.toLocaleString()} ${assetClass} into escrow`);
    }

    case "lockPayment": {
      requireRole(role, ["buyer"], "lock the payment leg");
      const acs = await acsFor(party);
      const escrow = findEscrow(acs, action.escrowCid);
      const amount = Number(escrow.payload.cashAmount);
      const lockExt = externalBySymbol(str((escrow.payload.cashDescriptor as Record<string, unknown>).currency));
      if (lockExt) {
        const alloc = await registryAllocate(lockExt, {
          buyer: party,
          seller: world.parties.seller,
          escrowId: str(escrow.payload.escrowId),
          amount,
          settleBefore: ms(escrow.payload.expiry),
        });
        return {
          ok: true,
          updateId: alloc.updateId,
          summary: `Allocated ${amount.toLocaleString()} real ${lockExt.label} to this settlement via its registry`,
          data: { allocationCid: alloc.allocationCid },
        };
      }
      const custody = await custodyCid(world, "buyer");
      const currency = str((escrow.payload.cashDescriptor as Record<string, unknown>).currency);
      const cashCid = await ensureHolding(world, "buyer", "CashToken", amount, currency);
      const tx = await submit(party, [
        exerciseIn(T.Custody, custody, "LockPaymentLeg", { escrowCid: action.escrowCid, cashCid }),
      ]);
      return result(tx, `Locked ${amount.toLocaleString()} ${currency} into escrow`);
    }

    case "approve": {
      requireRole(role, ["agent"], "approve settlement conditions");
      const req = (await acsFor(party)).find((c) => c.contractId === action.requestCid && c.name === "ConditionRequest");
      if (!req) throw new SupError("That request is no longer open.");
      if (action.documentRef !== undefined) {
        const seen = createHash("sha256").update(action.documentRef.trim(), "utf8").digest("hex").slice(0, 32);
        if (seen !== str(req.payload.documentHash))
          throw new SupError("That reference does not match the one committed on the ledger. Ask the seller to resend it.");
      }
      const tx = await submit(party, [exerciseIn(T.ConditionRequest, action.requestCid, "ApproveCondition")]);
      // Both principals' authority is already held by this server, so once the agent
      // approves, a fully funded trade settles in the same breath.
      const auto = await trySettleById(str(req.payload.escrowId));
      return {
        ...result(tx, auto.result ? "Approved. Both legs were locked, so the trade settled." : "Approved. Settlement is unblocked."),
        data: { settleUpdateId: auto.result?.updateId, settled: Boolean(auto.result) },
      };
    }

    case "reject": {
      requireRole(role, ["agent"], "reject settlement conditions");
      const tx = await submit(party, [
        exerciseIn(T.ConditionRequest, action.requestCid, "RejectCondition", { reason: action.reason }),
      ]);
      return result(tx, "Condition rejected");
    }

    case "settle": {
      requireRole(role, ["seller", "buyer"], "settle a trade");
      const acs = await acsFor(party);
      const escrow = findEscrow(acs, action.escrowCid);
      const escrowId = str(escrow.payload.escrowId);
      const lockedAsset = acs.find((c) => c.name === "LockedAsset" && c.payload.escrowId === escrowId);
      const lockedPayment = acs.find((c) => c.name === "LockedPayment" && c.payload.escrowId === escrowId);
      const settleExt = externalBySymbol(str((escrow.payload.cashDescriptor as Record<string, unknown>).currency));
      const externalPay = settleExt
        ? (await externalAllocations(party)).find((a) => a.ref === escrowId && a.legId === "payment")
        : undefined;
      if (!lockedAsset) throw new SupError("The seller has not locked the asset leg yet.");
      if (settleExt ? !externalPay : !lockedPayment) throw new SupError("The buyer has not locked the payment leg yet.");
      const needsCondition = escrow.payload.settlementAgent !== null && escrow.payload.documentHash !== null;
      let approvalCid: string | null = null;
      if (needsCondition) {
        const approval = acs.find((c) => c.name === "ConditionApproval" && c.payload.escrowId === escrowId);
        if (!approval) throw new SupError("The settlement agent has not approved the condition yet.");
        approvalCid = approval.contractId;
      }
      if (settleExt && externalPay) {
        // Payment leg is an external registry's Allocation: it needs that registry's
        // choice context and its contracts disclosed to this transaction.
        const ctx = await allocationContext(settleExt, externalPay.cid, "execute-transfer");
        const txExt = await submit(
          [world.parties.seller, world.parties.buyer],
          [
            exerciseIn(T.EscrowTrade, action.escrowCid, "SettleDvPExternal", {
              lockedAssetCid: lockedAsset.contractId,
              paymentAllocationCid: externalPay.cid,
              paymentExtraArgs: { context: ctx.context, meta: { values: {} } },
              approvalCid,
              settler: party,
            }),
          ],
          { disclosed: ctx.disclosed },
        );
        return result(
          txExt,
          `Settled atomically — ${BOND_LABEL} delivered to the buyer and real ${settleExt.label} delivered to the seller, in one transaction`,
        );
      }
      // Both principals' authority is required to release the locked legs.
      const tx = await submit([world.parties.seller, world.parties.buyer], [
        exerciseIn(T.EscrowTrade, action.escrowCid, "SettleDvP", {
          lockedAssetCid: lockedAsset.contractId,
          lockedPaymentCid: lockedPayment!.contractId,
          approvalCid,
          settler: party,
        }),
      ]);
      return result(
        tx,
        `Settled atomically — asset delivered to the buyer, cash delivered to the seller, in one transaction`,
      );
    }

    case "cancel": {
      requireRole(role, ["seller", "buyer"], "cancel a trade");
      const acs = await acsFor(party);
      const escrow = findEscrow(acs, action.escrowCid);
      const escrowId = str(escrow.payload.escrowId);
      const lockedAsset = acs.find((c) => c.name === "LockedAsset" && c.payload.escrowId === escrowId);
      const lockedPayment = acs.find((c) => c.name === "LockedPayment" && c.payload.escrowId === escrowId);
      const cancelExt = externalBySymbol(str((escrow.payload.cashDescriptor as Record<string, unknown>).currency));
      if (cancelExt) {
        // The payment lock belongs to the issuer's registry: the buyer releases it first.
        const ext = (await externalAllocations(world.parties.buyer)).find((a) => a.ref === escrowId && a.legId === "payment");
        if (ext) await registryWithdraw(cancelExt, world.parties.buyer, ext.cid);
      }
      const tx = await submit([world.parties.seller, world.parties.buyer], [
        exerciseIn(T.EscrowTrade, action.escrowCid, "CancelByAgreement", {
          lockedAssetCid: lockedAsset?.contractId ?? null,
          lockedPaymentCid: lockedPayment?.contractId ?? null,
        }),
      ]);
      return result(tx, "Trade cancelled by agreement — any locked legs returned");
    }

    case "reclaim": {
      const acs = await acsFor(party);
      const lock = acs.find((c) => c.contractId === action.lockCid);
      if (!lock) {
        // Not a Sup contract: it may be the buyer's external (Canton Coin) allocation.
        const ext = (await externalAllocations(party)).find((a) => a.cid === action.lockCid && a.sender === party);
        if (!ext) throw new SupError("Lock not found.");
        const reg = externalBySymbol(ext.instrument);
        if (!reg) throw new SupError("Unknown payment instrument.");
        const w = await registryWithdraw(reg, party, ext.cid);
        return { ok: true, updateId: w.updateId, summary: `Withdrew your ${reg.label} allocation. The funds are unlocked again` };
      }
      const isAsset = lock.name === "LockedAsset";
      const tx = await submit(party, [
        exerciseIn(
          isAsset ? T.LockedAsset : T.LockedPayment,
          action.lockCid,
          isAsset ? "ReturnAssetOnExpiry" : "ReturnPaymentOnExpiry",
        ),
      ]);
      return result(tx, `Reclaimed your ${isAsset ? "asset" : "payment"} after expiry`);
    }

    case "closeExpired": {
      requireRole(role, ["seller", "buyer"], "close an expired trade");
      const tx = await submit(party, [
        exerciseIn(T.EscrowTrade, action.escrowCid, "CloseExpired", { closer: party }),
      ]);
      return result(tx, "Expired trade closed");
    }
  }
}

// ---------------------------------------------------------------- orchestration + tx log

/** Settles a fully funded trade, if it is ready. "Not ready" is expected and is not an error. */
async function trySettleById(escrowId: string): Promise<{ result?: SupActionResult; error?: string }> {
  try {
    const world = await getSupWorld();
    const esc = (await acsFor(world.parties.seller)).find((c) => c.name === "EscrowTrade" && c.payload.escrowId === escrowId);
    if (!esc) return {};
    return { result: await runSupAction("seller", { type: "settle", escrowCid: esc.contractId }) };
  } catch (e) {
    if (e instanceof SupError) return {};
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const EVENT_LABEL: Partial<Record<SupAction["type"], string>> = {
  propose: "Offer sent",
  accept: "Offer accepted",
  rejectProposal: "Offer declined",
  withdrawProposal: "Offer withdrawn",
  lockAsset: "Bond locked",
  lockPayment: "Payment locked",
  approve: "Delivery confirmed",
  reject: "Delivery rejected",
  settle: "Settled",
  cancel: "Cancelled",
  closeExpired: "Expired and closed",
};

/** The trade a given action touches, resolved before it runs (settlement archives the contracts). */
async function escrowIdFor(world: SupWorld, role: SupRole, action: SupAction): Promise<string | undefined> {
  const party = world.parties[role];
  const acs = await acsFor(party);
  const byCid = (cid: string) => acs.find((c) => c.contractId === cid);
  switch (action.type) {
    case "accept":
    case "rejectProposal":
    case "withdrawProposal":
      return optStr(byCid(action.proposalCid)?.payload.escrowId);
    case "lockAsset":
    case "lockPayment":
    case "settle":
    case "cancel":
    case "closeExpired":
      return optStr(byCid(action.escrowCid)?.payload.escrowId);
    case "approve":
    case "reject":
      return optStr(byCid(action.requestCid)?.payload.escrowId);
    default:
      return undefined;
  }
}

export async function runSupAction(role: SupRole, action: SupAction): Promise<SupActionResult> {
  const label = EVENT_LABEL[action.type];
  if (!label) return runSupActionInner(role, action).finally(clearReadCache);
  const world = await getSupWorld();
  const known = action.type === "propose" ? undefined : await escrowIdFor(world, role, action).catch(() => undefined);
  // Ordered by when each step began: an approval that settles the trade must come before the settlement.
  const startedAt = Date.now();
  const res = await runSupActionInner(role, action).finally(clearReadCache);
  const escrowId = action.type === "propose" ? (res.data as { escrowId?: string } | undefined)?.escrowId : known;
  if (escrowId && res.updateId) {
    logEvent({ escrowId, label, updateId: res.updateId, offset: res.offset ?? 0, at: startedAt, by: role });
  }
  return res;
}

export { getDocRef };
export { T as SUP_TEMPLATES };
export const supCommands = { createIn, exerciseIn } as { [k: string]: unknown } & {
  createIn: (t: string, a: Record<string, unknown>) => Command;
  exerciseIn: (t: string, c: string, ch: string, a?: Record<string, unknown>) => Command;
};
