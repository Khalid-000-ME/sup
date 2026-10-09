# Sup — demo video script (5 minutes, hard limit)

Everything below is live on Canton DevNet. Record at 1440×900 or larger, browser zoomed to ~90%.

## Before you hit record

```bash
cd web
npm run sup:devnet          # all seven parties green, custody accounts ready
npm run sup:seed:market     # several bonds and open offers in both currencies
npm run dev                 # http://localhost:3000
```

Open two tabs: `/seller` and `/buyer`, plus `/agent` for the agent segment. Onboard each role once beforehand so the dashboards are live. For the real-Canton-Coin segment, click **Add 1,000 CC** on the buyer once before recording (it takes about a minute; do not do it on camera).

---

## 0:00–0:30 — The problem

> "When two institutions trade a tokenized bond, someone has to confirm the delivery was real before the money moves. That someone, a custodian or an administrator, is a settlement agent.
>
> On a public chain the trade is visible to everyone: price, size, counterparties. Off-chain you hide it by handing the agent everything, to check one reference.
>
> Sup removes that trade-off."

*On screen: the landing page, then **Open the desk**.*

## 0:30–1:10 — Sign in and a private offer

*Seller onboarding: sign in, verify (live ledger checks), ready. Then **Bonds**: show several bonds the seller defined. **New proposal**: pick a bond, price it in Canton Coin, turn on "Have an agent confirm delivery", send.*

> "The seller defines their own bonds and sends a private offer. The new trade lands at the top of the list. Only a fingerprint of the delivery reference goes on the ledger."

## 1:10–1:50 — Buying in one click

*Buyer tab → market. Toggle CashUSD / Canton Coin; point at the ranked prices and the best-price badge. **Buy** → confirm.*

> "The buyer sees open offers ranked by price per unit, in either currency. One click accepts the offer and locks the payment. For Canton Coin, that lock is held by the registry itself; Sup never touches the coin."

## 1:50–2:35 — What the agent actually gets

*Seller → trade → **Deliver bond**. Switch to `/agent`.*

> "The bond is locked, and the trade is waiting. The agent sees a trade reference, two names and a fingerprint. No price, no asset, no quantity, because the ledger never sent them."

*Paste a wrong reference: the field turns red. Paste the right one: it matches. **Confirm delivery**.*

> "The agent checks the reference it was given against the fingerprint on the ledger. Settlement stays blocked until it matches, and that is enforced by the Daml contract, not the interface."

## 2:35–3:25 — One transaction

*Open the settled trade. Point at the progress bar, then the proof list.*

> "One transaction. The bond allocation and the registry's Canton Coin allocation execute together. Either both happen, or neither."

*Click **Verify** on the settlement step, then **Inspect**.*

> "Verify reads the transaction back from the Canton node as the signed-in party. Here are the committed events: both locked legs consumed, both deliveries created. Switch to anyone who was not on the trade and it does not exist."

## 3:25–4:00 — Analytics

*Seller → Analytics.*

> "Volume by day, by bond, and the outcome mix, all computed from the party's own ledger view."

## 4:00–4:30 — Standard, not proprietary

> "Sup's own bond token and the real Canton Coin are read through the same Canton Token Standard interface a standard wallet would use. The escrow legs are standard allocations, and settlement executes them."

## 4:30–5:00 — What's real, and what isn't

> "To be precise. The ledger is real, a shared Canton DevNet node. The Canton Coin is real DevNet coin. The bond and the cash token are test assets issued by demo parties. The CBTC is real BitSafe CBTC from their DevNet faucet, so the amounts are small. cETH from onRails is configured but not yet tested.
>
> Sup is the settlement layer for institutions that need to prove delivery without exposing the trade. Private by construction, atomic by construction."

---

## If you have to cut

Drop analytics (3:25–4:00) first. **Never cut** the agent segment or the proof step. They are the proof.

## If the Canton Coin step fails on the day

Price the offer in CashUSD instead. Everything except the "real Canton Coin" wording works identically; say "payment token" rather than glossing over it.
