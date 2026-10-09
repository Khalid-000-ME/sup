# Sup — privacy model

Canton delivers a contract only to its signatories and observers. Sup uses that to give each role the narrowest possible view, asserted in the Daml tests and re-checked against the live ledger by `npm run sup:e2e`.

## Observed visibility

| Contract | Seller | Buyer | Agent | Auditor | Asset issuer | Cash issuer | Outsider |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `TradeProposal` | ✔ | ✔ | ✘ | opt-in | ✘ | ✘ | ✘ |
| `EscrowTrade` | ✔ | ✔ | **✘** | opt-in | ✘ | ✘ | ✘ |
| `LockedAsset` | ✔ | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ |
| `LockedPayment` | ✔ | ✔ | ✘ | ✘ | ✘ | ✔ | ✘ |
| `ConditionRequest` | ✔ | ✔ | **✔** | ✘ | ✘ | ✘ | ✘ |
| `ConditionApproval` | ✔ | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ |
| `SettlementReceipt` | ✔ | ✔ | ✘ | opt-in | ✘ | ✘ | ✘ |

## The point: the settlement agent is told the minimum

A settlement agent is a real third party — a custodian, an administrator, a document checker. It needs to confirm one fact. It does not need the price.

So the agent is **not** an observer of `EscrowTrade`. It observes only `ConditionRequest`, which carries a trade reference and a document hash. The commercial terms live on a contract Canton never delivers to it. This is enforced by the stakeholder declaration, not by filtering in the UI.

The Daml test suite asserts exactly this:

```
agent cannot see the escrow trade (no price, no asset, no quantity)
agent sees only the condition request
agent cannot see the locked legs
```

## Honest limits

- The agent sees the two principals' party IDs, because they are signatories of `ConditionRequest`. Only the commercial terms are hidden, not the fact that these two parties are trading.
- The **asset issuer** is a signatory of `LockedAsset`, so it learns that a lock exists and for how much. A registrar knowing its own units are encumbered is realistic, but it is a disclosure and it is listed above. The same holds for the cash issuer.
- The **auditor** is opt-in and selected by the seller at proposal time. It sees terms and receipts, never locks or condition traffic.
- Only a **hash** of the document reference reaches the ledger; the reference itself stays in the app.
- All parties currently live on one participant. The visibility rules are identical across participants, but sub-transaction views would then also be physically separated.
