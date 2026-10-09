# Sup

**Private atomic delivery-versus-payment settlement on Canton**

HackCanton Season 3 · Track 2 — Financial Applications

---

## 1. The problem

When two institutions trade a tokenized asset — a bond, a fund unit, a private-credit position — someone has to confirm that the asset really was delivered, and release the payment only then. That someone is a settlement agent: a custodian, an administrator, a document checker.

Today that step breaks in one of two ways.

**On a public chain**, the trade is visible to everyone. Price, size, and both counterparties are exposed the moment it settles, and often before. For a block trade, the *fact of the trade* moves the market.

**Off-chain**, privacy is preserved by handing the agent everything. The agent sees price, quantity and both counterparties, although all it must confirm is one fact: *was the delivery reference valid?* Payment and delivery are separate movements in separate systems, reconciled afterwards, and the gap between them is where settlement risk lives.

So the choice institutions face today is between exposing the trade and trusting a third party with all of it.

## 2. The solution

Sup removes the choice.

```
Seller proposes private terms          → only the named buyer receives them
Buyer accepts                          → escrow opens
Seller locks the asset                 → one transaction, now binding
Buyer locks the payment                → one transaction, now binding
Settlement agent verifies a reference  → sees a trade id and a document hash, nothing else
Either principal settles               → both deliveries commit in ONE transaction, or neither does
```

Three properties, each enforced by the ledger rather than the interface:

1. **The agent is told the minimum.** It is not a party to the trade contract. It receives a request containing a trade reference and a document hash. The price, the asset and the quantity live on a contract Canton never delivers to it — so its dashboard cannot show them, because they never arrived.
2. **Settlement is atomic.** Both locked legs are consumed and both deliveries are created in a single transaction. No half-settled state, nothing to reconcile.
3. **It uses the Canton Token Standard.** Sup's tokens and escrow legs are standard `Holding`s and `Allocation`s, and a trade can settle against **real Canton Coin** issued by the DSO's registry — Sup executes the registry's allocation and its own in the same transaction.

## 3. Why Canton

This is not portable to a shared-state chain. There, "the agent should not see the price" is a request: the data is on the ledger and the agent can read it. On Canton it is a property of the contract — visibility is declared in Daml as signatories and observers, and the protocol delivers a contract only to those parties.

Every trade page lists its transactions, and **Verify** reads each one back from the node as the signed-in party. A party that was not on the trade gets nothing: "this transaction does not exist for you."

## 4. Who it is for

**Primary: the operations team of a broker, fund administrator or transfer agent that settles institutional trades in tokenized funds, bonds or private credit.**

They have three things in common:

- They already run a settlement-confirmation step with a named third party.
- Their clients treat price and counterparty as confidential.
- They carry the reconciliation and break-management cost of payment and delivery settling separately.

**Counterparties:** funds and treasuries buying and selling those instruments.

**Not our user:** retail traders, anyone wanting a public order book, anyone who needs price discovery. Sup begins *after* two parties have agreed a price. It is the settlement layer, not a venue.

## 5. Validation — what is proven, and what is not

**Proven, and reproducible by a judge:**

- The full lifecycle runs on the **shared HackCanton Canton DevNet participant**, not a local toy. `npm run sup:e2e` executes propose → accept → lock both legs → agent approval → atomic settlement and asserts the privacy of every party along the way. It passes on DevNet.
- **14 Daml test scripts, with 46 deliberate-rejection checks**: wrong asset class, short quantity, wrong currency, a non-agent approving, an outsider settling, one party springing a locked leg, an approval from a different trade, an allocation that does not match the trade.
- A real settlement transaction is captured on DevNet with its events: one `SettleDvP` consuming both locked legs and creating both deliveries.
- Real Canton Coin moves through the standard registry on DevNet: faucet → `TransferFactory` → accept → `AllocationFactory` → execute, ending with a party that has **no wallet** receiving the coin. And a Sup trade has settled in real Canton Coin on DevNet: Sup's bond allocation and the DSO registry's Amulet allocation executing in **one transaction** (`12203a6f3f48c035…`, offset 2705360).

**Not proven:** we have not interviewed settlement-operations teams. We do not know their actual break rates, so we make no claim about savings. That is the first thing we would do with a design partner.

**How we would measure it:** (a) the agent's view contains zero commercial fields — already testable and tested; (b) settlement-break rate versus the partner's current process; (c) time from both legs locked to final.

## 6. Go to market

**Wedge: replace the confirmation-and-reconciliation step for one desk's trades in one tokenized instrument.**

1. **Design partner (0–3 months).** One administrator or broker and two counterparties it already settles for. Sup replaces the email-and-spreadsheet confirmation for that flow. Closed network — which is exactly how the contracts model it.
2. **Agent pull (3–9 months).** Every trade names a settlement agent. Agents that see one workflow with zero commercial exposure have a reason to require it from their other clients.
3. **Platform (9–18 months).** More instruments, netting, multi-leg settlement, and registry integrations as real tokenized assets arrive on Canton.

**Business model:** a per-settlement fee, charged when the transaction commits — the only moment value is created.

## 7. What exists today

- 12 Daml templates implementing private escrow, minimal-disclosure approval and atomic DvP.
- Seven live parties on the shared DevNet participant, with custody accounts opened on-chain.
- A portal per role (seller, buyer, optional agent) with onboarding, a price leaderboard, one-click buy and deliver, seller-defined bonds, per-trade proof, and analytics, plus a transaction inspector and a view of the same tokens read purely through the Token Standard.

## 8. Honest limitations

- `BOND-2031` and `CashUSD` are **test assets** issued by demo parties. They are standard-shaped but are not a real security or cash.
- Canton Coin is real **DevNet** CC, which has no market value. BitSafe CBTC is also real: the buyer holds CBTC from BitSafe's DevNet faucet, and a trade settled in 0.01 CBTC through BitSafe's registry. The amounts are tiny because the faucet pays 0.01 to 1 per request. onRails cETH is configured but untested.
- An external payment lock (Canton Coin) is defined by its registry: the sender can withdraw it. The seller's exposure is that settlement can fail, not that value is lost — settlement is atomic, and the bond stays locked until expiry.
- The issuers co-sign the locked legs, so they learn that a lock exists and for how much.
- The backend is a custodial demo wallet. There is no end-user signing and no Grofty/CIP-0103 integration.
- Prototype only: no legal title transfer, no production custody or compliance.

## 9. Ask

An introduction to one tokenized-fund administrator or broker that settles institutional trades today, and a settlement agent willing to review what it would see.
