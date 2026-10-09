/**
 * Seeds a demo trade on the running ledger, stopped at the most instructive moment:
 * both legs locked, waiting on the settlement agent. Settlement is left for you
 * to perform on camera.
 *
 * Usage: npm run sup:seed
 */
import { buildSupState, getSupWorld, runSupAction } from "../src/lib/sup/server";

async function main() {
  await getSupWorld();
  await runSupAction("seller", { type: "faucet", asset: "asset", amount: 150 });
  await runSupAction("buyer", { type: "faucet", asset: "cash", amount: 100000 });
  const prop = await runSupAction("seller", {
    type: "propose", buyer: "buyer", assetQuantity: 100, cashAmount: 98500,
    withAgent: true, documentRef: "DOC-8841", withAuditor: true, expirySecs: 4 * 3600,
  });
  const escrowId = (prop.data as { escrowId: string }).escrowId;
  const buyer = await buildSupState("buyer");
  await runSupAction("buyer", { type: "accept", proposalCid: buyer.proposals.find((p) => p.escrowId === escrowId)!.cid });
  const seller = await buildSupState("seller");
  const escrowCid = seller.escrows.find((e) => e.escrowId === escrowId)!.cid;
  await runSupAction("seller", { type: "lockAsset", escrowCid });
  await runSupAction("buyer", { type: "lockPayment", escrowCid });
  console.log(`Seeded ${escrowId}: both legs locked, awaiting the agent's approval (expires in 4h).`);
  console.log(`Next on camera: /sup/as/agent → Approve, then /sup/as/buyer → Settle.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
