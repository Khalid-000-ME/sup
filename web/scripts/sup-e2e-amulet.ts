/**
 * Sup settling a trade in REAL Canton Coin (Amulet) on DevNet:
 *
 *   faucet → standard TransferFactory → accept   (buyer is funded with real CC)
 *   propose in CC → accept → lock bond → allocate CC via the Amulet registry
 *   agent approves → SettleDvPExternal: bond allocation + Amulet allocation, one transaction
 *
 * Usage: npm run sup:e2e:amulet     (DevNet only)
 */
import { buildStandardView, buildSupState, getSupWorld, runSupAction, SUP_TEMPLATES } from "../src/lib/sup/server";
import { exerciseIn, submit } from "../src/lib/server/ledger";
import { amuletBalance } from "../src/lib/sup/amulet";
import { isDevnet, NETWORK } from "../src/lib/server/config";
import type { SupRole } from "../src/lib/sup/personas";

const log = (...a: unknown[]) => console.log(...a);
function ok(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  log(`  ✔ ${msg}`);
}

async function main() {
  if (!isDevnet) {
    console.error(`Real Canton Coin needs DevNet; SUP_NETWORK is "${NETWORK}".`);
    process.exit(1);
  }
  const world = await getSupWorld();
  const S = (r: SupRole) => buildSupState(r);
  const PRICE = 250;

  log("\n1. fund the buyer with REAL Canton Coin (faucet → TransferFactory → accept)");
  const before = {
    buyer: (await amuletBalance(world.parties.buyer)).unlocked,
    seller: (await amuletBalance(world.parties.seller)).unlocked,
  };
  const funded = await runSupAction("buyer", { type: "faucet", asset: "amulet", amount: 1000 });
  log("  ", funded.summary);
  const afterFund = (await amuletBalance(world.parties.buyer)).unlocked;
  ok(afterFund - before.buyer >= 999.99, "buyer received 1,000 real CC from the wallet via the standard transfer");

  await runSupAction("seller", { type: "faucet", asset: "asset", amount: 100 });

  log(`\n2. seller proposes 100 BOND-2031 for ${PRICE} CC (agent-gated, auditor disclosed)`);
  const prop = await runSupAction("seller", {
    type: "propose",
    buyer: "buyer",
    assetQuantity: 100,
    cashAmount: PRICE,
    payment: "amulet",
    withAgent: true,
    documentRef: "DOC-CC-1",
    withAuditor: true,
    expirySecs: 3600,
  });
  const escrowId = (prop.data as { escrowId: string }).escrowId;
  log("  ", prop.summary);
  const mine = <T extends { escrowId: string }>(xs: T[]) => xs.filter((x) => x.escrowId === escrowId);

  let sBuyer = await S("buyer");
  await runSupAction("buyer", { type: "accept", proposalCid: mine(sBuyer.proposals)[0].cid });
  const sSeller = await S("seller");
  const escrowCid = mine(sSeller.escrows)[0].cid;
  ok(mine(sSeller.escrows)[0].currency === "CC", "the trade is priced in real Canton Coin");

  log("\n3. seller locks the bond; buyer allocates real CC through the Amulet registry");
  await runSupAction("seller", { type: "lockAsset", escrowCid });
  const alloc = await runSupAction("buyer", { type: "lockPayment", escrowCid });
  log("  ", alloc.summary);

  sBuyer = await S("buyer");
  const bal = await amuletBalance(world.parties.buyer);
  ok(bal.locked >= PRICE - 1e-6, `buyer's ${PRICE} CC is locked by the registry (${bal.locked} locked)`);
  const payLock = mine(sBuyer.locks).find((l) => l.kind === "payment");
  ok(payLock?.external === true, "the payment lock is an EXTERNAL allocation, not a Sup contract");
  ok(mine((await S("seller")).locks).some((l) => l.kind === "payment" && l.external), "seller can see the payment allocation");

  log("\n4. the same state read ONLY through the Canton Token Standard");
  const std = {
    buyer: await buildStandardView("buyer"),
    seller: await buildStandardView("seller"),
    agent: await buildStandardView("agent"),
    outsider: await buildStandardView("outsider"),
  };
  ok(std.buyer.allocations.some((a) => a.settlementRef === escrowId && a.instrumentId === "Amulet"), "Amulet allocation is a standard Allocation");
  ok(std.buyer.allocations.some((a) => a.settlementRef === escrowId && a.instrumentId === "BOND-2031"), "bond allocation is a standard Allocation");
  ok(std.buyer.holdings.some((h) => h.instrumentId === "Amulet" && h.implementedBy.startsWith("Splice.Amulet")), "buyer's CC is a real Splice.Amulet holding");
  ok(std.buyer.holdings.some((h) => h.instrumentId === "BOND-2031"), "the SAME interface also reads Sup's own bond token");
  ok(std.agent.holdings.length === 0 && std.agent.allocations.length === 0, "settlement agent sees no holdings or allocations");
  ok(std.outsider.holdings.length === 0 && std.outsider.allocations.length === 0, "outsider sees no holdings or allocations");

  log("\n5. settlement is blocked by the CONTRACT until the agent approves");
  {
    const sellerState = await S("seller");
    const assetLock = mine(sellerState.locks).find((l) => l.kind === "asset" && !l.external);
    const payAlloc = mine(sellerState.locks).find((l) => l.kind === "payment" && l.external);
    ok(assetLock && payAlloc, "the bond lock and the external payment allocation are both visible");
    try {
      await submit([world.parties.seller, world.parties.buyer], [
        exerciseIn(SUP_TEMPLATES.EscrowTrade, escrowCid, "SettleDvPExternal", {
          lockedAssetCid: assetLock!.cid,
          paymentAllocationCid: payAlloc!.cid,
          paymentExtraArgs: { context: { values: {} }, meta: { values: {} } },
          approvalCid: null,
          settler: world.parties.seller,
        }),
      ]);
      throw new Error("the ledger accepted a settlement without the approval");
    } catch (e) {
      ok(/requires an approved settlement condition/i.test((e as Error).message), "the ledger itself rejects settlement without approval");
    }
  }
  const agent = await S("agent");
  const appr = await runSupAction("agent", { type: "approve", requestCid: mine(agent.conditionRequests)[0].cid, documentRef: "DOC-CC-1" });
  const autoSettled = (appr.data as { settled?: boolean; settleUpdateId?: string } | undefined);

  log("\n6. atomic DvP: Sup's bond allocation + the Amulet registry's allocation, one transaction");
  const settled = autoSettled?.settled
    ? { summary: appr.summary, updateId: autoSettled.settleUpdateId }
    : await runSupAction("buyer", { type: "settle", escrowCid });
  log("  ", settled.summary, "\n   tx", settled.updateId);

  const after = {
    buyer: await S("buyer"),
    seller: await S("seller"),
    sellerCC: (await amuletBalance(world.parties.seller)).unlocked,
  };
  ok(after.sellerCC - before.seller >= PRICE - 1e-6, `seller received ${PRICE} REAL Canton Coin`);
  ok(after.buyer.assets.reduce((s, h) => s + h.quantity, 0) >= 100, "buyer received the 100 bond units");
  ok(mine(after.seller.escrows).length === 0, "escrow consumed");
  ok(mine(after.buyer.locks).length === 0 && mine(after.seller.locks).length === 0, "both allocations consumed");
  ok(mine(after.seller.receipts).length === 1 && mine(after.seller.receipts)[0].currency === "CC", "receipt records settlement in CC");
  ok((await amuletBalance(world.parties.buyer)).locked < 1e-6, "no Canton Coin remains locked");

  log(`\nALL CHECKS PASSED — a real Canton Coin delivery-versus-payment on ${NETWORK}`);
}

main().catch((e) => {
  console.error("\nFAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
