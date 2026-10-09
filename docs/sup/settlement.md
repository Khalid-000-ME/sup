# Sup — settlement

## Atomic DvP (`EscrowTrade.SettleDvP`) — one transaction

Preconditions, all enforced in Daml:

- the settler is the seller or the buyer
- the trade has not expired (ledger time)
- both locks exist, reference this `escrowId`, name these parties, and match the agreed quantity and amount
- if the terms name an agent and a document hash, a matching `ConditionApproval` from **that** agent for **that** document exists

Then, in the same transaction:

```
archive EscrowTrade                                       (consuming choice)
exercise LockedAsset   as Allocation_ExecuteTransfer  →  AssetToken (buyer)
exercise LockedPayment as Allocation_ExecuteTransfer  →  CashToken  (seller)
create   SettlementReceipt(SettledDvP)
```

Both legs are executed through the standard `Allocation` interface (see [token-standard.md](token-standard.md)).

## Settling against an external registry (`SettleDvPExternal`)

When the trade is priced in an instrument issued elsewhere — real Canton Coin — the payment leg is the registry's own `Allocation`. `SettleDvPExternal` first binds that allocation to this trade (settlement reference, buyer → seller, exact amount, instrument admin and id), then executes it together with Sup's bond allocation, in one transaction. The condition check is identical to `SettleDvP`.

Both locked legs are consumed and both delivery legs are created together. There is no state in which one side has delivered and the other has not.

## Locking

`Custody.LockAssetLeg` archives the seller's `AssetToken`, returns any change, and creates a `LockedAsset` — one transaction, so the asset is never unescrowed-but-spent. `LockPaymentLeg` is the mirror image.

## Cancellation and expiry

- `CancelByAgreement` requires **both** principals, and returns whichever legs are locked in the same transaction.
- After expiry, each depositor reclaims unilaterally: `ReturnAssetOnExpiry` (seller) and `ReturnPaymentOnExpiry` (buyer), both time-gated. Neither party needs the other's cooperation to get its own property back.
- `CloseExpired` writes an `ExpiredUnsettled` receipt.

A rejected condition simply means no `ConditionApproval` ever exists, so `SettleDvP` can never pass its check. The parties unwind with `CancelByAgreement`.

## Reproducing

```bash
cd daml/sup-test && dpm test     # 14 scripts, 46 deliberate-rejection checks
cd web && npm run sup:e2e        # the whole lifecycle against a live ledger
```
