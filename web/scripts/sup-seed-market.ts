/**
 * Seeds the market with several bonds and open offers in both currencies, so the
 * buyer's price leaderboard and the seller's bond page have real data.
 * Safe to run more than once: bonds that exist are reused, offers are added.
 *
 * Usage: npm run sup:seed:market
 */
import { buildSupState, getSupWorld, runSupAction } from "../src/lib/sup/server";
import { findBond } from "../src/lib/sup/store";

const BONDS = [
  { symbol: "TBILL-2027", name: "Treasury Bill 2027", faceValue: 1000, couponPct: 3.75, maturity: "2027-09-30", description: "Short-dated test bill. Not a real security." },
  { symbol: "GREEN-2029", name: "Green Infrastructure 2029", faceValue: 500, couponPct: 5.1, maturity: "2029-03-31", description: "Test green bond funding grid storage." },
];
const OFFERS: { bond: string; qty: number; price: number; pay: "test" | "amulet" | "cbtc" }[] = [
  { bond: "BOND-2031", qty: 20, price: 19400, pay: "test" },
  { bond: "TBILL-2027", qty: 40, price: 38600, pay: "test" },
  { bond: "TBILL-2027", qty: 25, price: 24300, pay: "test" },
  { bond: "GREEN-2029", qty: 60, price: 28800, pay: "test" },
  { bond: "GREEN-2029", qty: 30, price: 14000, pay: "amulet" },
  { bond: "BOND-2031", qty: 10, price: 9200, pay: "amulet" },
  { bond: "TBILL-2027", qty: 5, price: 0.012, pay: "cbtc" },
  { bond: "GREEN-2029", qty: 8, price: 0.008, pay: "cbtc" },
];

async function main() {
  await getSupWorld();
  for (const b of BONDS) {
    if (!findBond(b.symbol)) await runSupAction("seller", { type: "createBond", ...b });
  }
  const held = async (sym: string) => (await buildSupState("seller")).assets.filter((a) => a.label === sym).reduce((s, a) => s + a.quantity, 0);
  for (const sym of ["BOND-2031", ...BONDS.map((b) => b.symbol)]) {
    if ((await held(sym)) < 300) await runSupAction("seller", { type: "faucet", asset: "asset", amount: 500, assetClass: sym });
  }
  for (const o of OFFERS) {
    const r = await runSupAction("seller", {
      type: "propose", buyer: "buyer", assetClass: o.bond, assetQuantity: o.qty, cashAmount: o.price,
      payment: o.pay, withAgent: false, withAuditor: false, expirySecs: 86400,
    });
    console.log(r.summary, `${o.qty} ${o.bond} for ${o.price} ${o.pay === "amulet" ? "CC" : o.pay === "cbtc" ? "CBTC" : "CashUSD"}`);
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
