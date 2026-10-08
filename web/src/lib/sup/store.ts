/**
 * Off-ledger application data for Sup.
 *
 * What lives here is deliberately not ledger state:
 *  - bond metadata (name, coupon, maturity). The ledger only knows the bond's class id.
 *  - the delivery reference a seller must hand to the settlement agent. Only its hash
 *    is on the ledger, so this is the one place the original is kept for its seller.
 *  - a per-trade log of the transaction ids this server submitted, so a trade page can
 *    list its transactions without scanning the whole ledger.
 *
 * It is a single JSON file, which is right for one server process. A multi-instance
 * deployment would move this to a real database.
 */
import fs from "node:fs";
import path from "node:path";
import type { SupRole } from "./personas";

export interface Bond {
  /** Ledger asset class id, e.g. BOND-2031. Immutable once issued. */
  symbol: string;
  name: string;
  /** Face value per unit, in the quote currency. */
  faceValue: number;
  couponPct: number;
  /** ISO date, YYYY-MM-DD. */
  maturity: string;
  description: string;
  createdAt: number;
}

export interface TradeEvent {
  escrowId: string;
  label: string;
  updateId: string;
  offset: number;
  at: number;
  by: SupRole;
}

interface StoreData {
  bonds: Bond[];
  docRefs: Record<string, string>;
  events: TradeEvent[];
  onboarded: Partial<Record<SupRole, number>>;
}

/** Set SUP_DATA_DIR to a mounted disk on hosts whose filesystem is wiped on restart. */
const FILE = path.join(process.env.SUP_DATA_DIR ?? path.join(process.cwd(), ".data"), "sup-store.json");

/**
 * The demo bonds are built in, so a host that wipes its disk on restart still shows a
 * populated market. (Their units already exist on the ledger.)
 */
const DEMO_BONDS: Omit<Bond, "createdAt">[] = [
  {
    symbol: "BOND-2031",
    name: "Sup Treasury Bond 2031",
    faceValue: 1000,
    couponPct: 4.25,
    maturity: "2031-06-30",
    description: "Test bond issued by the bond registry. Not a real security.",
  },
  {
    symbol: "TBILL-2027",
    name: "Treasury Bill 2027",
    faceValue: 1000,
    couponPct: 3.75,
    maturity: "2027-09-30",
    description: "Short-dated test bill. Not a real security.",
  },
  {
    symbol: "GREEN-2029",
    name: "Green Infrastructure 2029",
    faceValue: 500,
    couponPct: 5.1,
    maturity: "2029-03-31",
    description: "Test green bond funding grid storage.",
  },
];

const DEFAULTS = (): StoreData => ({
  bonds: DEMO_BONDS.map((b) => ({ ...b, createdAt: 0 })),
  docRefs: {},
  events: [],
  onboarded: {},
});

declare global {
  var __supStore: { data: StoreData; mtime: number } | undefined;
}

/**
 * The file is shared with scripts that run in other processes (seeding, e2e), so the
 * cached copy is dropped whenever the file's modification time changes.
 */
function load(): StoreData {
  let mtime = 0;
  try {
    mtime = fs.statSync(FILE).mtimeMs;
  } catch {
    /* no file yet */
  }
  const cached = globalThis.__supStore;
  if (cached && cached.mtime === mtime) return cached.data;
  let data = DEFAULTS();
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<StoreData>;
    data = { ...data, ...raw, bonds: raw.bonds?.length ? raw.bonds : data.bonds };
  } catch {
    /* first run, or unreadable: start from defaults */
  }
  globalThis.__supStore = { data, mtime };
  return data;
}

function save() {
  const data = load();
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
  globalThis.__supStore = { data, mtime: fs.statSync(FILE).mtimeMs };
}

export const listBonds = (): Bond[] => load().bonds;
export const findBond = (symbol: string): Bond | undefined => load().bonds.find((b) => b.symbol === symbol);

export function addBond(b: Omit<Bond, "createdAt">): Bond {
  const d = load();
  if (d.bonds.some((x) => x.symbol === b.symbol)) throw new Error(`A bond ${b.symbol} already exists.`);
  const bond = { ...b, createdAt: Date.now() };
  d.bonds.push(bond);
  save();
  return bond;
}

/** For test cleanup only. Units already issued stay on the ledger. */
export function removeBond(symbol: string) {
  const d = load();
  d.bonds = d.bonds.filter((b) => b.symbol !== symbol);
  save();
}

export function setDocRef(escrowId: string, ref: string) {
  load().docRefs[escrowId] = ref;
  save();
}
export const getDocRef = (escrowId: string): string | undefined => load().docRefs[escrowId];

export function logEvent(e: TradeEvent) {
  const d = load();
  if (d.events.some((x) => x.updateId === e.updateId && x.escrowId === e.escrowId)) return;
  d.events.push(e);
  if (d.events.length > 2000) d.events.splice(0, d.events.length - 2000);
  save();
}
export const eventsFor = (escrowId: string): TradeEvent[] =>
  load()
    .events.filter((e) => e.escrowId === escrowId)
    .sort((a, b) => a.at - b.at);

export function markOnboarded(role: SupRole) {
  load().onboarded[role] = Date.now();
  save();
}
export const onboardedAt = (role: SupRole): number | undefined => load().onboarded[role];
