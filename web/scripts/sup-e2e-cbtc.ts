/**
 * Sup settling a trade in REAL CBTC (BitSafe) on DevNet:
 *   the buyer already holds CBTC from the issuer's faucet (accepted via `claim`)
 *   propose a bond for CBTC -> buy (accept + allocate through BitSafe's registry)
 *   -> deliver -> SettleDvPExternal: bond allocation + the registry's CBTC allocation, one transaction
 *
 * Usage: npm run sup:e2e:cbtc     (DevNet only; the buyer needs a little CBTC from
 *        https://cbtc-faucet.bitsafe.finance, Devnet tab)
 */
import { buildSupState, getSupWorld, runSupAction } from "../src/lib/sup/server";
import { balance, UTILITY_REGISTRIES } from "../src/lib/sup/registry";

const log = (...a: unknown[]) => console.log(...a);
function ok(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  log(`  ✔ ${msg}`);
}

async function main() {
  const world = await getSupWorld();
  const cbtc = UTILITY_REGISTRIES.find((r) => r.key === "cbtc")!;
  const PRICE = 0.01;

  log("\n1. claim any pending CBTC faucet payout, then check the buyer's real balance");
  try {
    const c = await runSupAction("buyer", { type: "claim", instrument: "cbtc" });
    log("  ", c.summary);
  } catch (e) {
    log("   (nothing pending)", (e as Error).message);
  }
  const b0 = { buyer: await balance(cbtc, world.parties.buyer), seller: await balance(cbtc, world.parties.seller) };
  ok(b0.buyer.unlocked >= PRICE, `buyer holds ${b0.buyer.unlocked} real CBTC`);

  log(`\n2. seller offers 5 BOND-2031 for ${PRICE} CBTC`);
  await runSupAction("seller", { type: "faucet", asset: "asset", amount: 5 });
  const p = await runSupAction("seller", {
    type: "propose", buyer: "buyer", assetQuantity: 5, cashAmount: PRICE, payment: "cbtc",
    withAgent: false, withAuditor: false, expirySecs: 1800,
  });
  const id = (p.data as { escrowId: string }).escrowId;
  const prop = (await buildSupState("buyer")).proposals.find((x) => x.escrowId === id)!;
  ok(prop.currency === "CBTC", "the offer is priced in CBTC");

  log("\n3. buyer buys: accept + allocate CBTC through BitSafe's registry");
  const buy = await runSupAction("buyer", { type: "buy", proposalCid: prop.cid });
  log("  ", buy.summary);
  const mid = await balance(cbtc, world.parties.buyer);
  ok(mid.locked >= PRICE - 1e-9, `the buyer's ${PRICE} CBTC is locked by the registry (${mid.locked} locked)`);
  const lock = (await buildSupState("seller")).locks.find((l) => l.escrowId === id && l.kind === "payment");
  ok(lock?.external === true && lock.label === "CBTC", "the payment lock is an external CBTC allocation visible to the seller");

  log("\n4. seller delivers: bond locked, settled atomically");
  const esc = (await buildSupState("seller")).escrows.find((x) => x.escrowId === id)!;
  const del = await runSupAction("seller", { type: "deliver", escrowCid: esc.cid });
  log("  ", del.summary);
  ok((del.data as { settled: boolean }).settled, `settled in one transaction ${del.updateId?.slice(0, 16)}…`);

  const b1 = { buyer: await balance(cbtc, world.parties.buyer), seller: await balance(cbtc, world.parties.seller) };
  ok(Math.abs(b1.seller.unlocked - b0.seller.unlocked - PRICE) < 1e-9, `seller received ${PRICE} real CBTC (${b0.seller.unlocked} -> ${b1.seller.unlocked})`);
  ok(Math.abs(b0.buyer.unlocked - b1.buyer.unlocked - PRICE) < 1e-9 && b1.buyer.locked < 1e-9, "buyer paid it, nothing left locked");
  ok((await buildSupState("buyer")).receipts.some((r) => r.escrowId === id && r.currency === "CBTC"), "receipt records settlement in CBTC");
  log("\nALL CHECKS PASSED: a real CBTC delivery-versus-payment on DevNet");
}
main().catch((e) => {
  console.error("\nFAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
