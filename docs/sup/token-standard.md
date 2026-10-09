# Sup and the Canton Token Standard (CIP-56)

Sup's tokens are not a private format. They are standard **Holdings**, its escrow legs are standard **Allocations**, and a trade can settle against **real Canton Coin** issued by a registry Sup does not control.

## 1. Sup's own tokens are standard Holdings

`AssetToken`, `CashToken`, `LockedAsset` and `LockedPayment` implement `Splice.Api.Token.HoldingV1.Holding`.

| Contract | Instrument (`admin` / `id`) | Locked? |
|---|---|---|
| `AssetToken` | asset issuer / `BOND-2031` | no |
| `CashToken` | cash issuer / `CashUSD` | no |
| `LockedAsset` | asset issuer / `BOND-2031` | yes — held by seller + buyer, until trade expiry, context `Sup escrow <id>` |
| `LockedPayment` | cash issuer / `CashUSD` | yes — same |

Anything that understands the standard can read them without knowing Sup exists. The app proves it: the **Canton Token Standard view** panel queries the node with an *interface* filter on `Holding` and `Allocation`, never on a Sup template. `npm run sup:e2e` asserts the same thing on every run.

The interface packages are the real ones — the same package ids that are vetted on the HackCanton DevNet node (`splice-api-token-holding-v1` `718a0f77…`, `-metadata-v1` `4ded6b66…`, `-allocation-v1` `93c942ae…`). They were downloaded from the node and their SHA-256 is checked against the node's package id before use (`daml/sup/lib/`).

## 2. Escrow legs are standard Allocations — and settlement executes them

`LockedAsset` and `LockedPayment` also implement `AllocationV1.Allocation`, with the settlement reference set to the trade id. `SettleDvP` settles a trade by executing **both legs' `Allocation_ExecuteTransfer`** in one transaction.

| Standard choice | Sup behaviour |
|---|---|
| `Allocation_ExecuteTransfer` | delivers the leg to the receiver, if the trade has not expired |
| `Allocation_Cancel` | returns the leg to its sender |
| `Allocation_Withdraw` | the standard's sender-only exit. Sup's lock is **binding until expiry**, so this is refused until then |

Controllers are `[executor, sender, receiver]`. For the asset leg that is the seller and the buyer, so neither can move a leg alone — checked by `standardAllocationAuthority` in the Daml tests.

## 3. Settling against real Canton Coin

A trade can be priced in **Canton Coin (Amulet)** instead of the `CashUSD` test token. The payment leg is then an `AmuletAllocation` created by the DSO's own registry; Sup never touches the coin.

`EscrowTrade.SettleDvPExternal` executes Sup's bond allocation **and** the registry's payment allocation in one transaction. Before executing anything it binds the external allocation to the trade:

- settlement reference equals the trade id
- sender is the buyer, receiver is the seller
- amount equals the agreed price exactly
- instrument admin and id equal the trade's agreed instrument
- the executor is one of the two principals
- the settlement-agent condition is approved, if the terms require one

The Daml tests run this against a **mock registry** that implements the same interface, including every wrong-allocation case (`externalBinding`).

### The real flow on DevNet

Every step is a standard registry interaction through the validator's scan-proxy (`/registry/…`):

1. **Fund** — DevNet faucet pays the wallet; `TransferFactory_Transfer` sends Canton Coin to `sup-buyer`; the buyer accepts with `TransferInstruction_Accept`.
2. **Allocate** — the buyer calls `AllocationFactory_Allocate` for the payment leg (buyer → seller, settlement ref = trade id). Canton Coin is now locked by the registry.
3. **Settle** — `SettleDvPExternal`, with the registry's choice context for `execute-transfer` and the four DSO contracts (`AmuletRules`, the open mining round, …) **disclosed** to the transaction.

Verified live on DevNet, as standalone steps:

| Step | Update id (DevNet) | Result |
|---|---|---|
| `TransferInstruction_Accept` | `1220202cda6bc0554fe642dc4b35a47c79b5f2ab9f88acfc4081024462a96830086d` | `sup-buyer` holds 3,000 real Canton Coin (`Splice.Amulet:Amulet`) |
| `AllocationFactory_Allocate` | `1220abe187bc9778381d3fc081ee5e32cea1293a35302d18b3d3a6e34eb9361b3608` | 250 CC locked in a `Splice.AmuletAllocation`, 2,750 change |
| `Allocation_ExecuteTransfer` | `1220529c88f4958dd7a77af9fde4e785f374b3a80d8e2c9da531c2d4b0812c11a932` | `sup-seller` — a party with **no wallet** — receives 250 CC |

And the integrated settlement — `npm run sup:e2e:amulet` (19 checks, passing on DevNet) — in which `SettleDvPExternal` executes Sup's bond allocation and the registry's payment allocation together:

```
12203a6f3f48c035828dc668a048d931baa41c56c6b13aa3024d8573098f5ca64f6f   (DevNet offset 2705360)
  EscrowTrade.SettleDvPExternal
    LockedAsset.Allocation_ExecuteTransfer          →  create AssetToken        (bond → buyer)
    AmuletAllocation.Allocation_ExecuteTransfer                                   (the DSO registry's contract)
      LockedAmulet.LockedAmulet_UnlockV2            →  create Amulet            (250 real CC → seller)
  create SettlementReceipt
```
Visible to the buyer and the seller; **not** to the settlement agent or the outsider (checked against the node).

The same run also asserts that the ledger itself (not just the app) refuses `SettleDvPExternal` without the agent's approval, and that the settlement agent and an outsider see no holdings or allocations through the standard interfaces.

The external **cancel** path was verified on DevNet too: cancelling a trade whose payment is a Canton Coin allocation withdraws that allocation through the registry (250 CC went from locked back to unlocked) and returns the bond.

## 4. What this does and does not claim

- **Real:** the Canton Coin, the registry, the allocation and transfer instructions, the disclosed DSO contracts, and the interface packages.
- **Not real:** `BOND-2031` and `CashUSD` remain test assets issued by demo parties; they are standard-shaped but not a real security or real cash. CBTC is real BitSafe CBTC (section 5), in small amounts from their DevNet faucet; cETH is configured but untested.
- **The payment lock is defined by the registry, not by Sup.** An Amulet allocation's sender can withdraw it; Sup cannot make it binding. The seller's exposure is *liveness*, not loss: settlement is one atomic transaction, so a buyer who withdraws first simply makes settlement fail, and the seller's bond stays locked until expiry and is then reclaimed. With the `CashUSD` token the lock **is** binding.
- **Settlement needs the registry's cooperation:** it consumes registry contracts, so the registry's choice context and disclosed contracts must be fetched at settle time. That is what the standard registry API is for.
- **Receivers need no wallet.** An `Allocation_ExecuteTransfer` creates the coin for the receiver using the receiver's authority as a controller, so any party can receive.
- **Faucet.** The DevNet faucet pays the logged-in user's wallet, not the Sup parties directly; funding goes wallet → buyer by a standard transfer.

## 5. Settling in real CBTC (BitSafe)

The same external-allocation path settles any CIP-56 registry. Canton Coin goes through the DSO registry via the validator's scan-proxy; CBTC goes through the Digital Asset Utility registry (`api.utilities.digitalasset-dev.com`), which is public, so no credential is sent to it. The buyer's CBTC arrives as a standard `TransferInstruction` from BitSafe's faucet and is accepted with `TransferInstruction_Accept`.

`npm run sup:e2e:cbtc` (DevNet) offers a bond for 0.01 CBTC, buys it (accept + allocate through BitSafe's registry), and settles it with `SettleDvPExternal`. The seller, a party with no wallet and no credential, receives the CBTC. cETH uses the same code path and is configured, but untested.
