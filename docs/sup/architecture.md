# Sup — architecture

```
Browser (Next.js, /sup/*)
   │  /api/sup/{state,action,standard,activity,tx,events,onboard}
Next.js route handlers (Node)
   │  src/lib/sup/server.ts  — bootstrap · state · actions · standard view
   │  src/lib/sup/amulet.ts  — real Canton Coin via the Token Standard registry
Canton JSON Ledger API v2        DSO registry (validator scan-proxy)
   │
Canton participant  ← Daml package "sup"  +  splice-api-token-{holding,metadata,allocation}-v1
```

## Templates (`daml/sup/daml/Sup`)

| Template | Signatories | Observers | Purpose |
|---|---|---|---|
| `AssetToken` | asset issuer | owner | tokenized asset holding — implements `Holding` |
| `CashToken` | cash issuer | owner | payment holding — implements `Holding` |
| `Custody` | issuer, owner | — | issuer→owner delegation |
| `TradeProposal` | seller | buyer, auditor? | private terms, pre-acceptance |
| `EscrowTrade` | seller, buyer | auditor? | the active trade — **immutable** |
| `LockedAsset` | asset issuer, seller | buyer | seller's committed leg — implements `Holding` (locked) and `Allocation` |
| `LockedPayment` | cash issuer, buyer | seller | buyer's committed leg — implements `Holding` (locked) and `Allocation` |
| `ConditionRequest` | seller, buyer | settlement agent | minimal disclosure to the agent |
| `ConditionApproval` / `ConditionRejection` | settlement agent | seller, buyer | the agent's verdict |
| `SettlementReceipt` | seller, buyer | auditor? | immutable outcome |

The standard interfaces come from the real `splice-api-token-*-v1` packages (identical package ids to those vetted on the DevNet node), declared as `data-dependencies`. How they are used, and how real Canton Coin plugs in, is in [token-standard.md](token-standard.md).

## Two design decisions worth explaining

### `EscrowTrade` is immutable

The PRD sketch (§12) stores `assetLockCid`, `paymentLockCid` and `conditionStatus` as mutable fields on the trade, and flags the problem itself in §12.2 and §14.2. The problem is authorization: recording a lock would mean recreating a contract signed by *both* principals from inside a choice that only carries the depositor's authority, and the settlement agent cannot mutate a contract it does not sign.

Sup stores terms only. **State is derived from the existence of contracts**: a trade is "asset locked" when a `LockedAsset` with that `escrowId` exists, and "approved" when a `ConditionApproval` exists. This removes the authority problem entirely and narrows each fact's disclosure.

### Custody delegation makes one-transaction DvP possible

A holding is signed by its issuer, so only the issuer's authority can bring units into existence. `Custody` is co-signed by the issuer and the owner, so a choice on it carries both authorities — enough for the depositor to burn a holding and mint a `LockedAsset` in one transaction.

At settlement, exercising `SettleDvP` on `EscrowTrade` carries the seller's and buyer's authority. Inside it, exercising `ReleaseAssetTo` on `LockedAsset` adds the asset issuer's authority, which is what allows a new `AssetToken` to be created for the buyer. The same holds for the cash leg. One transaction, both deliveries.

### Why locked legs cannot escape

`LockedAsset` is signed by the asset issuer **and** the seller, so the seller alone cannot archive it — Daml's implicit `Archive` needs every signatory. `ReleaseAssetTo` requires **both** principals, so it is reachable only from a choice that carries the escrow's authority (settlement or mutual cancellation). The one unilateral exit is `ReturnAssetOnExpiry`, which is time-gated and can only return the asset to its original depositor.

## Server

- `getSupWorld()` — resolves the seven parties, uploads the DAR (local only) and opens custody accounts. Idempotent.
- `runSupAction()` — every state change, validated server-side; the browser never supplies a Daml party.
- `buildSupState(role)` — the ACS as that party, parsed into view models.

Settlement and cancellation are submitted with `actAs: [seller, buyer]`, because those choices require both principals' authority by design.
