/**
 * Sup end-to-end against a live Canton ledger:
 *   mint → propose → accept → lock both legs → approve condition → atomic DvP
 * plus the privacy assertions at every stage.
 *
 * Usage: npm run sup:e2e
 */
import { buildStandardView, buildSupState, getSupWorld, runSupAction, SUP_TEMPLATES } from "../src/lib/sup/server";
import { exerciseIn, submit } from "../src/lib/server/ledger";
import { NETWORK } from "../src/lib/server/config";
import type { SupRole } from "../src/lib/sup/personas";

const log = (...a: unknown[]) => console.log(...a);
function ok(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  log(`  ✔ ${msg}`);
}
/** Only the instruments this test trades: other bonds and currencies on the shared account must not move the totals. */
const sum = (xs: { quantity: number; label: string }[]) =>
  xs.filter((x) => x.label === "BOND-2031" || x.label === "CashUSD").reduce((s, x) => s + x.quantity, 0);

async function main() {
  const world = await getSupWorld();
  log(`network: ${NETWORK}`);
  log("parties:", Object.fromEntries(Object.entries(world.parties).map(([k, v]) => [k, v.slice(0, 26) + "…"])));

  const S = (r: SupRole) => buildSupState(r);
  // Deltas, so the script is repeatable on a ledger that already has state.
  const base = {
    sellerCash: sum((await S("seller")).cash),
    sellerAsset: sum((await S("seller")).assets),
    buyerAsset: sum((await S("buyer")).assets),
    buyerCash: sum((await S("buyer")).cash),
  };

  log("\n1. issue test asset and cash");
  await runSupAction("seller", { type: "faucet", asset: "asset", amount: 150 });
  await runSupAction("buyer", { type: "faucet", asset: "cash", amount: 100000 });

  log("\n2. seller proposes a private trade (100 units for 98,500, agent-gated)");
  const prop = await runSupAction("seller", {
    type: "propose",
    buyer: "buyer",
    assetQuantity: 100,
    cashAmount: 98500,
    withAgent: true,
    documentRef: "DOC-8841",
    withAuditor: true,
    expirySecs: 3600,
  });
  log("  ", prop.summary);
  const escrowId = (prop.data as { escrowId: string }).escrowId;
  const pick = <T extends { escrowId: string }>(xs: T[]) => xs.filter((x) => x.escrowId === escrowId);

  let sSeller = await S("seller"), sBuyer = await S("buyer"), sAgent = await S("agent"), sOut = await S("outsider");
  ok(pick(sSeller.proposals).length === 1, "seller sees its proposal");
  ok(pick(sBuyer.proposals).length === 1, "buyer sees the proposal");
  ok(pick(sAgent.proposals).length === 0, "settlement agent cannot see the proposal");
  ok(pick(sOut.proposals).length === 0, "outsider cannot see the proposal");

  log("\n3. buyer accepts");
  await runSupAction("buyer", { type: "accept", proposalCid: pick(sBuyer.proposals)[0].cid });

  sSeller = await S("seller"); sBuyer = await S("buyer"); sAgent = await S("agent");
  let sAud = await S("auditor"); sOut = await S("outsider");
  const escrowCid = pick(sSeller.escrows)[0].cid;
  ok(pick(sBuyer.escrows).length === 1, "buyer sees the active escrow");
  ok(pick(sAgent.escrows).length === 0, "agent cannot see the escrow trade (no price, no asset, no quantity)");
  ok(pick(sAgent.conditionRequests).length === 1, "agent sees only the condition request");
  ok(pick(sAgent.conditionRequests)[0].documentHash.length > 0, "agent sees the document hash it must check");
  ok(pick(sAud.escrows).length === 1, "auditor sees the escrow (opt-in observer)");
  ok(pick(sAud.conditionRequests).length === 0, "auditor does not see the condition request");
  ok(pick(sOut.escrows).length === 0, "outsider sees nothing");

  log("\n4. both legs locked");
  await runSupAction("seller", { type: "lockAsset", escrowCid });
  await runSupAction("buyer", { type: "lockPayment", escrowCid });

  sSeller = await S("seller"); sBuyer = await S("buyer"); sAgent = await S("agent"); sAud = await S("auditor");
  ok(pick(sSeller.locks).length === 2, "seller sees both locks (owns one, observes the other)");
  ok(pick(sBuyer.locks).length === 2, "buyer sees both locks");
  ok(pick(sAgent.locks).length === 0, "agent cannot see the locked legs");
  ok(pick(sAud.locks).length === 0, "auditor cannot see the locked legs");
  ok(sum(sSeller.assets) - base.sellerAsset === 50, "seller keeps 50 units of change");
  ok(sum(sBuyer.cash) - base.buyerCash === 1500, "buyer keeps 1,500 of change");

  log("\n4b. the same state, read ONLY through the Canton Token Standard interfaces");
  const stdSeller = await buildStandardView("seller");
  const stdBuyer = await buildStandardView("buyer");
  const stdAgent = await buildStandardView("agent");
  const stdOut = await buildStandardView("outsider");
  const lockedA = stdSeller.holdings.filter((h) => h.locked && h.lockContext?.includes(escrowId));
  ok(lockedA.length >= 1, "seller's locked asset is a standard Holding with a lock");
  ok(lockedA.some((h) => h.instrumentId === "BOND-2031" && h.amount === 100), "locked holding: instrument BOND-2031, amount 100");
  ok(lockedA.every((h) => h.lockHolders.length === 2), "lock is held by both principals");
  ok(stdSeller.allocations.some((a) => a.settlementRef === escrowId && a.transferLegId === "asset"), "asset leg is a standard Allocation");
  ok(stdBuyer.allocations.some((a) => a.settlementRef === escrowId && a.transferLegId === "payment"), "payment leg is a standard Allocation");
  ok(stdBuyer.holdings.some((h) => h.locked && h.instrumentId === "CashUSD" && h.amount === 98500), "locked payment: instrument CashUSD, amount 98,500");
  ok(stdAgent.holdings.length === 0 && stdAgent.allocations.length === 0, "settlement agent sees no holdings or allocations via the standard");
  ok(stdOut.holdings.length === 0 && stdOut.allocations.length === 0, "outsider sees no holdings or allocations via the standard");

  log("\n5. settlement is blocked by the CONTRACT until the condition is approved");
  // Bypass the app's own pre-check and submit straight to the ledger.
  {
    const assetLock = sSeller.locks.find((l) => l.escrowId === escrowId && l.kind === "asset");
    const payLock = sSeller.locks.find((l) => l.escrowId === escrowId && l.kind === "payment");
    ok(assetLock && payLock, "both locked legs are visible to the seller");
    try {
      await submit([world.parties.seller, world.parties.buyer], [
        exerciseIn(SUP_TEMPLATES.EscrowTrade, escrowCid, "SettleDvP", {
          lockedAssetCid: assetLock!.cid,
          lockedPaymentCid: payLock!.cid,
          approvalCid: null,
          settler: world.parties.seller,
        }),
      ]);
      throw new Error("the ledger accepted a settlement without the approval");
    } catch (e) {
      ok(/requires an approved settlement condition/i.test((e as Error).message), "the ledger itself rejects settlement without approval");
    }
    try {
      await runSupAction("seller", { type: "settle", escrowCid });
      throw new Error("should have failed");
    } catch (e) {
      ok(/approved/i.test((e as Error).message), "the app also refuses (defence in depth)");
    }
  }

  log("\n6. agent approves the document reference");
  const req = pick(sAgent.conditionRequests)[0];
  const appr = await runSupAction("agent", { type: "approve", requestCid: req.cid });
  log("  ", appr.summary);

  log("\n7. atomic delivery-versus-payment");
  // Approving a fully funded trade settles it in the same step (see runSupAction "approve").
  const auto = appr.data as { settled?: boolean; settleUpdateId?: string } | undefined;
  const settled = auto?.settled
    ? { summary: appr.summary, updateId: auto.settleUpdateId }
    : await runSupAction("buyer", { type: "settle", escrowCid });
  log("  ", settled.summary, "tx", settled.updateId?.slice(0, 14));

  sSeller = await S("seller"); sBuyer = await S("buyer"); sOut = await S("outsider"); sAud = await S("auditor");
  ok(sum(sBuyer.assets) - base.buyerAsset === 100, "buyer received 100 units");
  ok(sum(sSeller.cash) - base.sellerCash === 98500, "seller received 98,500");
  ok(pick(sSeller.escrows).length === 0, "escrow consumed");
  ok(pick(sSeller.locks).length === 0 && pick(sBuyer.locks).length === 0, "both locked legs consumed");
  ok(pick(sSeller.receipts).length === 1 && pick(sSeller.receipts)[0].outcome === "SettledDvP", "receipt records DvP settlement");
  ok(pick(sAud.receipts).length === 1, "auditor sees the receipt");
  ok(pick(sOut.receipts).length === 0, "outsider never sees the settlement");
  const after = await buildStandardView("buyer");
  ok(after.holdings.some((h) => !h.locked && h.instrumentId === "BOND-2031"), "buyer's delivered asset is a standard Holding");
  ok(!after.holdings.some((h) => h.locked && h.lockContext?.includes(escrowId)), "no locked holding remains for the trade");
  ok(!after.allocations.some((a) => a.settlementRef === escrowId), "both allocations were consumed by settlement");

  log(`\nALL CHECKS PASSED on ${NETWORK}`);
}

main().catch((e) => {
  console.error("\nFAILED:", e);
  process.exit(1);
});
