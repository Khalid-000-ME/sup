# Sup — private atomic DvP escrow on Canton

> Sup lets institutions settle tokenized assets privately: payment and delivery complete atomically, while price, counterparties and documents stay visible only to authorized parties.

HackCanton Season 3 · Track 2 — Financial Applications.

## The narrow, testable claim

Given a seller, a buyer, a settlement agent, a tokenized asset and a payment token, Sup keeps the trade private, locks both legs, and delivers asset-for-payment atomically in one Canton transaction.

That claim is asserted by `npm run sup:e2e` against a live ledger, not just described.

## What makes it a Canton product, not a generic escrow

Two things, both enforced by the ledger rather than the interface:

**1. The settlement agent is told the minimum.** A custodian or document checker needs to confirm one fact, not learn the price. The agent is deliberately *not* an observer of `EscrowTrade`; it observes only a `ConditionRequest` carrying a trade reference and a document hash. On a shared-state chain the agent would see the whole trade and you would ask it not to look.

```
agent cannot see the escrow trade (no price, no asset, no quantity)   ← asserted in the test suite
agent sees only the condition request
agent cannot see the locked legs
```

**2. Settlement is one transaction.** Both locked legs are consumed and both delivery legs are created together. There is no window in which one side has delivered and the other has not, and nothing to reconcile afterwards.

## Run it

```bash
# contracts
cd daml/sup && dpm build
cd ../sup-test && dpm test          # 14 scripts, 46 deliberate-rejection checks

# local Canton ledger
./scripts/start-ledger.sh

# app
cd web && npm install && npm run dev   # http://localhost:3000/sup
npm run sup:e2e                     # headless full lifecycle + privacy assertions
```

On the shared HackCanton DevNet participant, see [the DevNet guide](../devnet.md), then:

```bash
npm run sup:devnet                  # checks parties, rights, package; opens custody accounts
```

## Demo path

1. **Seller** (`/seller`): create or pick a bond, then **New proposal**. Price it in `CashUSD` or **real Canton Coin**; optionally ask an agent to confirm delivery.
2. **Buyer** (`/buyer`): the market ranks open offers by price per unit. **Buy** accepts the offer and locks the payment in one click.
3. **Seller**: **Deliver bond** locks the bond. If no agent is involved, the trade settles in the same step.
4. **Agent** (`/agent`, only when requested): paste the delivery reference. The app hashes it and compares it with the fingerprint on the ledger; **Confirm delivery** unlocks only on a match, and the trade settles.
5. Open the trade, then **Verify**: each step is read back from the node as you, and the same transaction is invisible to anyone who is not a party to it.

Try settling before the agent approves: the Daml contract rejects it.

## Roles

| Party | Role |
|---|---|
| Seller | defines bonds, sells the tokenized asset |
| Buyer | pays against delivery |
| Agent | optional settlement agent, verifies a delivery reference, sees nothing else |
| Auditor | opt-in auditor, terms and receipts only |
| Bond registry / Cash issuer | issuers of the test asset and test cash; co-sign custody |
| Outsider | unrelated participant, sees nothing |

## Documentation

[token-standard.md](token-standard.md) · [architecture.md](architecture.md) · [privacy.md](privacy.md) · [settlement.md](settlement.md) · [limitations.md](limitations.md)
