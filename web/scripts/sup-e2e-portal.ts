/**
 * Portal flows against the live ledger:
 *   custom bond -> issue -> offer -> one-click buy -> one-click deliver (auto-settles)
 *   agent path: delivery reference must match the on-ledger hash, then approval auto-settles
 *
 * Usage: npm run sup:e2e:portal
 */
import { buildSupState, getDocRef, getSupWorld, runSupAction } from "../src/lib/sup/server";
import { eventsFor, findBond, removeBond } from "../src/lib/sup/store";

const log = (...a: unknown[]) => console.log(...a);
function ok(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  log(`  ✔ ${msg}`);
}
async function fails(p: Promise<unknown>, re: RegExp, msg: string) {
  try {
    await p;
  } catch (e) {
    ok(re.test((e as Error).message), `${msg} (${(e as Error).message.slice(0, 90)})`);
    return;
  }
  throw new Error(`ASSERTION FAILED: expected rejection: ${msg}`);
}

async function main() {
  await getSupWorld();
  const symbol = `T${Date.now().toString(36).toUpperCase().slice(-5)}-27`;

  log(`\n1. seller defines a new bond ${symbol} and issues units`);
  await runSupAction("seller", {
    type: "createBond",
    symbol,
    name: "E2E Note 2027",
    faceValue: 500,
    couponPct: 3.5,
    maturity: "2027-12-31",
    description: "created by the portal e2e",
  });
  ok(findBond(symbol), "bond is in the registry");
  await fails(
    runSupAction("seller", { type: "createBond", symbol, name: "dup", faceValue: 1, couponPct: 1, maturity: "2030-01-01", description: "" }),
    /already exists/,
    "duplicate symbol is refused",
  );
  await fails(runSupAction("seller", { type: "faucet", asset: "asset", amount: 10, assetClass: "NOPE-1" }), /Unknown bond/, "unknown bond cannot be issued");
  await runSupAction("seller", { type: "faucet", asset: "asset", amount: 200, assetClass: symbol });
  const held = (await buildSupState("seller")).assets.filter((a) => a.label === symbol).reduce((t, a) => t + a.quantity, 0);
  ok(held >= 200, `seller holds ${held} ${symbol}, separate from BOND-2031`);
  await runSupAction("buyer", { type: "faucet", asset: "cash", amount: 5000 });

  log("\n2. no agent: offer -> buy (one click) -> deliver (one click) settles");
  const p1 = await runSupAction("seller", {
    type: "propose", buyer: "buyer", assetClass: symbol, assetQuantity: 50, cashAmount: 4000,
    withAgent: false, withAuditor: false, expirySecs: 1800,
  });
  const id1 = (p1.data as { escrowId: string }).escrowId;
  const prop = (await buildSupState("buyer")).proposals.find((x) => x.escrowId === id1)!;
  ok(prop.assetClass === symbol, "the offer carries the chosen bond");
  await fails(
    runSupAction("buyer", { type: "buy", proposalCid: prop.cid }).then(() => runSupAction("buyer", { type: "buy", proposalCid: prop.cid })),
    /no longer available/,
    "an offer cannot be bought twice",
  );
  const sellerView = await buildSupState("seller");
  const esc1 = sellerView.escrows.find((x) => x.escrowId === id1)!;
  ok(esc1 && sellerView.locks.some((l) => l.escrowId === id1 && l.kind === "payment"), "buy accepted and locked payment in one action");
  const del = await runSupAction("seller", { type: "deliver", escrowCid: esc1.cid });
  log("  ", del.summary);
  ok((del.data as { settled: boolean }).settled, "deliver locked the bond and settled atomically");
  const after = await buildSupState("buyer");
  ok(after.receipts.some((r) => r.escrowId === id1 && r.outcome === "SettledDvP"), "receipt written");
  ok(after.assets.some((a) => a.label === symbol && a.quantity >= 50), `buyer now holds ${symbol}`);
  const ev = eventsFor(id1).map((e) => e.label);
  ok(["Offer sent", "Offer accepted", "Payment locked", "Bond locked", "Settled"].every((l) => ev.includes(l)), `tx log: ${ev.join(" > ")}`);
  ok(new Set(eventsFor(id1).map((e) => e.updateId)).size === eventsFor(id1).length, "every logged transaction id is distinct");

  log("\n3. with agent: reference must match, approval settles");
  const p2 = await runSupAction("seller", {
    type: "propose", buyer: "buyer", assetClass: symbol, assetQuantity: 20, cashAmount: 1500,
    withAgent: true, documentRef: "CUSTODY-7741", withAuditor: false, expirySecs: 1800,
  });
  const id2 = (p2.data as { escrowId: string }).escrowId;
  ok(getDocRef(id2) === "CUSTODY-7741", "seller's reference is kept for the seller");
  const prop2 = (await buildSupState("buyer")).proposals.find((x) => x.escrowId === id2)!;
  await runSupAction("buyer", { type: "buy", proposalCid: prop2.cid });
  const esc2 = (await buildSupState("seller")).escrows.find((x) => x.escrowId === id2)!;
  const d2 = await runSupAction("seller", { type: "deliver", escrowCid: esc2.cid });
  ok(!(d2.data as { settled: boolean }).settled, "with an agent, delivery alone does not settle");
  const req = (await buildSupState("agent")).conditionRequests.find((x) => x.escrowId === id2)!;
  await fails(runSupAction("agent", { type: "approve", requestCid: req.cid, documentRef: "WRONG-REF" }), /does not match/, "a wrong reference cannot be approved");
  const ap = await runSupAction("agent", { type: "approve", requestCid: req.cid, documentRef: "CUSTODY-7741" });
  log("  ", ap.summary);
  ok((ap.data as { settled: boolean }).settled, "the right reference approves and the trade settles");
  ok((await buildSupState("buyer")).receipts.some((r) => r.escrowId === id2 && r.outcome === "SettledDvP"), "receipt written");

  log("\n4. funds are checked before anything is accepted");
  const p3 = await runSupAction("seller", {
    type: "propose", buyer: "buyer", assetClass: symbol, assetQuantity: 1, cashAmount: 99_000_000,
    withAgent: false, withAuditor: false, expirySecs: 600,
  });
  const id3 = (p3.data as { escrowId: string }).escrowId;
  const prop3 = (await buildSupState("buyer")).proposals.find((x) => x.escrowId === id3)!;
  await fails(runSupAction("buyer", { type: "buy", proposalCid: prop3.cid }), /Add funds first/, "an unaffordable offer is refused up front");
  ok((await buildSupState("buyer")).proposals.some((x) => x.escrowId === id3), "the offer is still open, nothing half-created");
  await runSupAction("seller", { type: "withdrawProposal", proposalCid: (await buildSupState("seller")).proposals.find((x) => x.escrowId === id3)!.cid });

  removeBond(symbol); // keep the demo registry free of test bonds
  log("\nALL CHECKS PASSED");
}
main().catch((e) => {
  console.error("\nFAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
