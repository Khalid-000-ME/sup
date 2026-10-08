import { accessToken, ledgerUserId } from "./auth";
import { isDevnet, LEDGER_URL, LOCAL_APP_USER_ID, SUP_PACKAGE_NAME } from "./config";

/** The ledger user id to submit commands as: JWT `sub` on DevNet, our own user locally. */
export async function appUserId(): Promise<string> {
  return isDevnet ? ledgerUserId() : LOCAL_APP_USER_ID;
}

export class LedgerError extends Error {
  status: number;
  raw: unknown;
  constructor(message: string, status: number, raw?: unknown) {
    super(message);
    this.status = status;
    this.raw = raw;
  }
}

/** Pulls a readable message out of a Canton/Daml error payload. */
function readableError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const b = body as { cause?: string; code?: string };
  const cause = b.cause ?? "";
  const assertion = cause.match(/AssertionFailed:\s*([^\n"\\]+)/);
  if (assertion) return assertion[1].trim();
  const notVisible = cause.match(/not visible|CONTRACT_NOT_FOUND|Contract could not be found/i);
  if (notVisible) return "Contract is not visible to this party or no longer active";
  if (b.code && b.code !== "NA") return `${b.code}: ${cause.slice(0, 280)}`;
  return cause ? cause.slice(0, 280) : fallback;
}

async function call<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown, binary?: Uint8Array): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": binary ? "application/octet-stream" : "application/json",
  };
  const token = await accessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${LEDGER_URL}${path}`, {
      method,
      headers,
      body: binary ? Buffer.from(binary) : body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    const hint = isDevnet
      ? `Cannot reach the HackCanton DevNet participant at ${LEDGER_URL}.`
      : `Canton ledger unreachable at ${LEDGER_URL}. Start it with "npm run ledger".`;
    throw new LedgerError(hint, 503, e);
  }
  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  if (!res.ok) {
    if (res.status === 401) {
      throw new LedgerError("DevNet rejected the access token (401). Check your credentials in web/.env.local.", 401, json);
    }
    if (res.status === 403) {
      throw new LedgerError(
        `DevNet denied this operation (403). Tenant tokens cannot allocate parties, manage users or upload DARs — use the Node Console. Path: ${path}`,
        403,
        json,
      );
    }
    throw new LedgerError(readableError(json, `Ledger API ${res.status}`), res.status, json);
  }
  return json as T;
}

// ---------- low-level types ----------

export interface CreatedEvent {
  offset: number;
  nodeId: number;
  contractId: string;
  templateId: string;
  createArgument: Record<string, unknown>;
  signatories: string[];
  observers: string[];
  createdAt: string;
  packageName: string;
}

export interface ExercisedEvent {
  offset: number;
  nodeId: number;
  contractId: string;
  templateId: string;
  choice: string;
  choiceArgument: unknown;
  actingParties: string[];
  consuming: boolean;
  lastDescendantNodeId: number;
  exerciseResult: unknown;
  witnessParties: string[];
}

export interface ArchivedEvent {
  offset: number;
  nodeId: number;
  contractId: string;
  templateId: string;
  witnessParties: string[];
}

export type LedgerEvent = { CreatedEvent: CreatedEvent } | { ExercisedEvent: ExercisedEvent } | { ArchivedEvent: ArchivedEvent };

export interface Transaction {
  updateId: string;
  commandId?: string;
  effectiveAt: string;
  offset: number;
  events: LedgerEvent[];
  recordTime?: string;
}

export interface Contract {
  contractId: string;
  /** "Module:Entity" with the package id stripped. */
  template: string;
  /** Entity name only, e.g. "CallOffer". */
  name: string;
  payload: Record<string, unknown>;
  signatories: string[];
  observers: string[];
  createdAt: string;
}

export function splitTemplate(templateId: string): { template: string; name: string } {
  const i = templateId.indexOf(":");
  const t = i >= 0 ? templateId.slice(i + 1) : templateId;
  return { template: t, name: t.split(":").pop() ?? t };
}

// ---------- commands ----------

export type Command =
  | { CreateCommand: { templateId: string; createArguments: Record<string, unknown> } }
  | { ExerciseCommand: { templateId: string; contractId: string; choice: string; choiceArgument: Record<string, unknown> } };

/** Fully-qualified template id for any package: `#<pkg>:<Module>:<Entity>`. */
export const tidOf = (pkg: string, module: string, entity: string) => `#${pkg}:${module}:${entity}`;

export const createIn = (templateId: string, args: Record<string, unknown>): Command => ({
  CreateCommand: { templateId, createArguments: args },
});

export const exerciseIn = (
  templateId: string,
  contractId: string,
  choice: string,
  choiceArgument: Record<string, unknown> = {},
): Command => ({ ExerciseCommand: { templateId, contractId, choice, choiceArgument } });

const wildcard = { cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } }] };

function eventFormat(parties: string[]) {
  return { filtersByParty: Object.fromEntries(parties.map((p) => [p, wildcard])), verbose: true };
}

function transactionFormat(parties: string[]) {
  return { eventFormat: eventFormat(parties), transactionShape: "TRANSACTION_SHAPE_LEDGER_EFFECTS" };
}

/** A contract the submitter cannot see but is explicitly allowed to use (e.g. the DSO's AmuletRules). */
export interface DisclosedContract {
  templateId: string;
  contractId: string;
  createdEventBlob: string;
  synchronizerId: string;
}

let commandSeq = 0;
function commandId(): string {
  commandSeq += 1;
  return `vc-${Date.now().toString(36)}-${commandSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Submit commands and wait for the committed transaction.
 * `actAs` may be a single party or several (some Daml choices require the
 * authority of more than one party, e.g. a mutual cancellation).
 */
export async function submit(
  actAs: string | string[],
  commands: Command[],
  opts: { disclosed?: DisclosedContract[]; readAs?: string[] } = {},
): Promise<Transaction> {
  const parties = Array.isArray(actAs) ? actAs : [actAs];
  const res = await call<{ transaction: Transaction }>("POST", "/v2/commands/submit-and-wait-for-transaction", {
    commands: {
      commands,
      commandId: commandId(),
      userId: await appUserId(),
      actAs: parties,
      readAs: opts.readAs ?? [],
      ...(opts.disclosed?.length ? { disclosedContracts: opts.disclosed } : {}),
    },
    transactionFormat: transactionFormat(parties),
  });
  return res.transaction;
}

/** Created contract ids (in order) for a given template entity within a transaction. */
export function createdIds(tx: Transaction, entity: string): string[] {
  const out: string[] = [];
  for (const e of tx.events) {
    if ("CreatedEvent" in e && splitTemplate(e.CreatedEvent.templateId).name === entity) out.push(e.CreatedEvent.contractId);
  }
  return out;
}

// ---------- queries ----------

export async function ledgerEnd(): Promise<number> {
  const r = await call<{ offset: number }>("GET", "/v2/state/ledger-end");
  return r.offset;
}

export async function ledgerVersion(): Promise<string> {
  const r = await call<{ version: string }>("GET", "/v2/version");
  return r.version;
}

type AcsItem = { contractEntry: { JsActiveContract?: { createdEvent: CreatedEvent } } };

export async function activeContracts(
  party: string,
  offset?: number,
  templateId?: string,
  packageName: string = SUP_PACKAGE_NAME,
): Promise<Contract[]> {
  const at = offset ?? (await ledgerEnd());
  const filters = templateId
    ? { cumulative: [{ identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob: false } } } }] }
    : wildcard;
  const items = await call<AcsItem[]>("POST", "/v2/state/active-contracts", {
    eventFormat: { filtersByParty: { [party]: filters }, verbose: true },
    activeAtOffset: at,
  });
  const out: Contract[] = [];
  for (const it of items) {
    const ev = it.contractEntry.JsActiveContract?.createdEvent;
    if (!ev || ev.packageName !== packageName) continue;
    const { template, name } = splitTemplate(ev.templateId);
    out.push({
      contractId: ev.contractId,
      template,
      name,
      payload: ev.createArgument,
      signatories: ev.signatories,
      observers: ev.observers,
      createdAt: ev.createdAt,
    });
  }
  return out;
}

export interface InterfaceContract {
  contractId: string;
  /** Concrete template implementing the interface, e.g. "Sup.Assets:AssetToken". */
  template: string;
  /** Package id of the implementing package. */
  implementationPackageId?: string;
  view: Record<string, unknown>;
}

/**
 * ACS filtered by an *interface*, returning each contract's interface view.
 * This is how a generic wallet/explorer reads tokens it has no template knowledge of.
 */
export async function interfaceContracts(party: string, interfaceId: string, offset?: number): Promise<InterfaceContract[]> {
  const at = offset ?? (await ledgerEnd());
  const items = await call<
    {
      contractEntry: {
        JsActiveContract?: {
          createdEvent: CreatedEvent & {
            interfaceViews?: { viewStatus?: { code?: number }; viewValue?: Record<string, unknown>; implementationPackageId?: string }[];
          };
        };
      };
    }[]
  >("POST", "/v2/state/active-contracts", {
    activeAtOffset: at,
    eventFormat: {
      filtersByParty: {
        [party]: {
          cumulative: [{ identifierFilter: { InterfaceFilter: { value: { interfaceId, includeInterfaceView: true, includeCreatedEventBlob: false } } } }],
        },
      },
      verbose: true,
    },
  });
  const out: InterfaceContract[] = [];
  for (const it of items) {
    const ev = it.contractEntry.JsActiveContract?.createdEvent;
    const v = ev?.interfaceViews?.find((x) => x.viewValue && (x.viewStatus?.code ?? 0) === 0);
    if (!ev || !v?.viewValue) continue;
    out.push({
      contractId: ev.contractId,
      template: splitTemplate(ev.templateId).template,
      implementationPackageId: v.implementationPackageId,
      view: v.viewValue,
    });
  }
  return out;
}

export interface UpdatesPage {
  updates: Transaction[];
  nextPageToken?: string;
}


export async function updateById(party: string, updateId: string): Promise<Transaction | null> {
  try {
    const res = await call<{ update: { Transaction?: { value: Transaction } } }>("POST", "/v2/updates/update-by-id", {
      updateId,
      updateFormat: { includeTransactions: transactionFormat([party]) },
    });
    return res.update?.Transaction?.value ?? null;
  } catch (e) {
    if (e instanceof LedgerError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

// ---------- admin ----------

export interface PartyDetails {
  party: string;
  isLocal: boolean;
}

export async function listParties(): Promise<PartyDetails[]> {
  const out: PartyDetails[] = [];
  let token = "";
  // The shared DevNet node hosts many teams' parties, so page through them all.
  for (let i = 0; i < 50; i++) {
    const q = token ? `?pageToken=${encodeURIComponent(token)}` : "";
    const r = await call<{ partyDetails?: PartyDetails[]; nextPageToken?: string }>("GET", `/v2/parties${q}`);
    out.push(...(r.partyDetails ?? []));
    token = r.nextPageToken ?? "";
    if (!token) break;
  }
  return out;
}

export async function allocateParty(hint: string): Promise<string> {
  const r = await call<{ partyDetails: PartyDetails }>("POST", "/v2/parties", { partyIdHint: hint, identityProviderId: "" });
  return r.partyDetails.party;
}

export async function uploadDar(bytes: Uint8Array): Promise<void> {
  await call("POST", "/v2/dars", undefined, bytes);
}

export async function getUser(id: string): Promise<boolean> {
  try {
    await call("GET", `/v2/users/${encodeURIComponent(id)}`);
    return true;
  } catch (e) {
    if (e instanceof LedgerError && e.status === 404) return false;
    throw e;
  }
}

type Right = { kind: { CanActAs: { value: { party: string } } } } | { kind: { CanReadAs: { value: { party: string } } } };

export async function createUser(id: string, rights: Right[]): Promise<void> {
  await call("POST", "/v2/users", {
    user: { id, primaryParty: "", isDeactivated: false, metadata: { resourceVersion: "", annotations: {} }, identityProviderId: "" },
    rights,
  });
}

export interface PartyRight {
  party: string;
  canActAs: boolean;
  canReadAs: boolean;
}

/**
 * Parties this ledger user holds rights on. On the shared DevNet node
 * `GET /v2/parties` is forbidden for tenant tokens, so this is how we
 * discover our own party ids.
 */
export async function listRights(userId: string): Promise<PartyRight[]> {
  const r = await call<{ rights?: Record<string, { value?: { party?: string } }>[] | { kind?: Record<string, { value?: { party?: string } }> }[] }>(
    "GET",
    `/v2/users/${encodeURIComponent(userId)}/rights`,
  );
  const map = new Map<string, PartyRight>();
  for (const entry of (r.rights ?? []) as { kind?: Record<string, { value?: { party?: string } }> }[]) {
    const kind = entry.kind ?? {};
    for (const [k, v] of Object.entries(kind)) {
      const party = v?.value?.party;
      if (!party) continue;
      const cur = map.get(party) ?? { party, canActAs: false, canReadAs: false };
      if (k === "CanActAs") cur.canActAs = true;
      if (k === "CanReadAs") cur.canReadAs = true;
      map.set(party, cur);
    }
  }
  return [...map.values()];
}

export async function grantRights(id: string, rights: Right[]): Promise<void> {
  await call("POST", `/v2/users/${encodeURIComponent(id)}/rights`, { userId: id, identityProviderId: "", rights });
}

export const actAs = (party: string): Right => ({ kind: { CanActAs: { value: { party } } } });
