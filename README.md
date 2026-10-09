<img src="web/public/logo.svg" alt="Sup" width="56" style="background:#08080c;padding:12px">

# Sup — private atomic delivery-versus-payment settlement on Canton

> Sup lets institutions settle tokenized assets privately: payment and delivery complete atomically, while price, counterparties and documents stay visible only to the parties entitled to them.

**HackCanton Season 3 · Track 2 — Financial Applications**  ·  [Pitch](PITCH.md)  ·  [Demo script](docs/demo-script.md)  ·  [Docs](docs/sup/README.md)  ·  [Deploy](docs/deploy.md)

Everything runs against a **real Canton 3.6.1 ledger** — the shared HackCanton DevNet participant, or a local sandbox. No mocked ledger, no simulated transactions.

## The claim, and how it is checked

> Given a seller, a buyer, a settlement agent, a tokenized asset and a payment token, Sup keeps the trade private, locks both legs, and delivers asset-for-payment atomically in one Canton transaction.

It is asserted, not described: `npm run sup:e2e` runs the full lifecycle against a live ledger and fails if any privacy or atomicity property does not hold.

## What makes it a Canton product

**1. The settlement agent is told the minimum.** A custodian or document checker has to confirm one fact — not learn the price. The agent is deliberately *not* an observer of the trade. It receives a `ConditionRequest` containing a trade reference and a document hash, and nothing else. Price, asset and quantity live on a contract Canton never delivers to it.

```
agent cannot see the escrow trade (no price, no asset, no quantity)
agent sees only the condition request
agent cannot see the locked legs                       ← asserted in the Daml tests and on DevNet
```

**2. Settlement is one transaction.** Both locked legs are consumed and both deliveries are created together. There is no window in which one side has delivered and the other has not. Each step is its own transaction, and **Verify** reads it back from the node as the signed-in party. For a party that was not on the trade the node returns nothing: "this transaction does not exist for you".

**3. It speaks the Canton Token Standard (CIP-56).** Sup's tokens are standard `Holding`s, its escrow legs are standard `Allocation`s, and a trade can settle against **real Canton Coin** from the DSO's registry or **real BitSafe CBTC** from the Digital Asset Utility registry, in one transaction with Sup's bond. See [docs/sup/token-standard.md](docs/sup/token-standard.md).

## Deployed on Canton DevNet

Live on the shared HackCanton participant (`ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services`, Canton 3.6.1), namespace `2ee903ba-`.

| Package | Id | Notes |
|---|---|---|
| `sup` 0.3.0 | `98e74b823b59e9a07540f6b36d45ba23ffed046591cc7a834a953cdeff0b1db7` | Token Standard holdings + allocations, `SettleDvPExternal` |

Parties (all with `can-act-as`): `sup-seller`, `sup-buyer`, `sup-agent`, `sup-auditor`, `sup-asset-issuer`, `sup-cash-issuer`, `sup-outsider`.

**An atomic settlement, captured on DevNet** (offset 2698502):

```
12208c650f6101cf38e81193d5eba8cb76bec396aa2d9d5e501428692f71fab8e93c
  EscrowTrade.SettleDvP                    consuming
    LockedAsset.ReleaseAssetTo             consuming  →  create AssetToken   (buyer)
    LockedPayment.ReleasePaymentTo         consuming  →  create CashToken    (seller)
  create SettlementReceipt
```

**Real Canton Coin, through the standard registry, on DevNet** — each step committed on the shared node:

| Step | Update id | Result |
|---|---|---|
| `TransferInstruction_Accept` | `1220202cda6bc0554fe642dc4b35a47c79b5f2ab9f88acfc4081024462a96830086d` | `sup-buyer` holds 3,000 real CC (`Splice.Amulet:Amulet`) |
| `AllocationFactory_Allocate` | `1220abe187bc9778381d3fc081ee5e32cea1293a35302d18b3d3a6e34eb9361b3608` | 250 CC locked in a `Splice.AmuletAllocation` |
| `Allocation_ExecuteTransfer` | `1220529c88f4958dd7a77af9fde4e785f374b3a80d8e2c9da531c2d4b0812c11a932` | `sup-seller` (no wallet) receives 250 CC |

**A Sup trade settled in real Canton Coin, in one transaction** (`npm run sup:e2e:amulet`, 19 checks, passing on DevNet) — Sup's bond allocation and the DSO registry's Amulet allocation execute together:

```
12203a6f3f48c035828dc668a048d931baa41c56c6b13aa3024d8573098f5ca64f6f   (DevNet offset 2705360)
  EscrowTrade.SettleDvPExternal
    LockedAsset.Allocation_ExecuteTransfer          →  create AssetToken        (bond → buyer)
    AmuletAllocation.Allocation_ExecuteTransfer                                   (the DSO registry's contract)
      LockedAmulet.LockedAmulet_UnlockV2            →  create Amulet            (250 real CC → seller)
  create SettlementReceipt
```
Visible to the buyer and the seller; **not** to the settlement agent or the outsider (checked against the node).

**A Sup trade settled in real BitSafe CBTC, in one transaction** (`npm run sup:e2e:cbtc`, passing on DevNet) — the seller, a party with no wallet and no credential, received the CBTC:

```
1220b7897407c4dcca746911ed4df6153b3d9ff330d519fab7d36c592e4d1f2fdc65   (DevNet offset 2759757)
  EscrowTrade.SettleDvPExternal
    LockedAsset.Allocation_ExecuteTransfer          →  create AssetToken   (bond → buyer)
    DvpLegAllocation.Allocation_ExecuteTransfer                              (BitSafe's registry)
      TransferRule.TransferRule_ExecuteAllocation   →  create Holding      (real CBTC → seller)
  create SettlementReceipt
```

## Run it

Prereqs: Node 20+, JDK 21, [dpm](https://docs.digitalasset.com).

```bash
# contracts + tests (14 Daml scripts, 46 deliberate-rejection checks)
cd daml/sup && dpm build && cd ../sup-test && dpm test

# local ledger
./scripts/start-ledger.sh

# app
cd web && cp .env.example .env.local && npm install && npm run dev        # http://localhost:3000
npm run sup:e2e                              # full lifecycle + every privacy assertion
```

On the shared DevNet node, see [docs/devnet.md](docs/devnet.md), then `npm run sup:devnet` (preflight), `npm run sup:e2e:amulet` (settles in real Canton Coin), `npm run sup:e2e:cbtc` (settles in real CBTC) and `npm run sup:e2e:portal` (bonds, one-click buy and deliver, the reference check). `npm run sup:seed:market` fills the market with bonds and open offers in every currency.

**Demo video.** `web/scripts/demo/` drives the real app with a visible cursor, cuts the ledger waits and mixes in neural-voice narration (`pip install edge-tts`, then `npm run demo:tts`, `demo:record`, `demo:build`). **Deploying:** [docs/deploy.md](docs/deploy.md).

## Demo path

1. **Seller** (`/seller`): create or pick a bond, then **New proposal**. Price it in `CashUSD`, **real Canton Coin** or **real CBTC**; optionally ask an agent to confirm delivery.
2. **Buyer** (`/buyer`): the market ranks open offers by price per unit. **Buy** accepts the offer and locks the payment in one click.
3. **Seller**: **Deliver bond** locks the bond. If no agent is involved, the trade settles in the same step.
4. **Agent** (`/agent`, only when requested): paste the delivery reference. The app hashes it and compares it with the fingerprint on the ledger; **Confirm delivery** unlocks only on a match, and the trade settles.
5. Open the trade, then **Verify**: each step is read back from the node as you, and the same transaction is invisible to anyone who is not a party to it.

Settlement stays blocked until the agent approves. The UI hides the button; `npm run sup:e2e` submits the settlement anyway and asserts the ledger rejects it.

## Roles

| Party | Role |
|---|---|
| Seller | defines bonds, sells the tokenized asset |
| Buyer | pays against delivery |
| Agent | optional settlement agent, verifies a delivery reference, sees nothing else |
| Auditor | opt-in auditor, terms and receipts only |
| Bond registry / Cash issuer | issuers of the test asset and test cash; co-sign custody |
| Outsider | unrelated participant, sees nothing |

## What is real, and what is not

| | |
|---|---|
| Ledger, transactions, privacy | **Real** — Canton 3.6.1; visibility checked per party |
| Canton Token Standard interfaces | **Real** — the exact packages vetted on the DevNet node |
| Canton Coin payment | **Real** — DSO registry, real allocations and transfer instructions (DevNet CC) |
| `BOND-2031`, `CashUSD` | **Test assets** issued by demo parties — standard-shaped, not a security, not cash |
| BitSafe CBTC | **Real** — DevNet CBTC from BitSafe's faucet, settled through the Digital Asset Utility registry (small amounts: the faucet gives 0.01 to 1 per request) |
| onRails cETH | **Configured, untested** — same code path as CBTC; no known way to obtain DevNet cETH yet |
| Wallet | A Canton wallet can be connected (CIP-0103 dApp SDK) to identify the user. Trades are still submitted by custodial demo parties, because a wallet's own participant does not host Sup's contracts |

Known limitations: [docs/sup/limitations.md](docs/sup/limitations.md).

## Repository

```
daml/sup, daml/sup-test    Sup contracts and Daml Script tests
web/                       Next.js 16 app: UI + server-side ledger client
docs/sup/                  architecture, privacy, settlement, token standard, limitations
docs/devnet.md             setting up the shared DevNet node
docs/deploy.md             hosting the app (Render, access code, what survives a restart)
render.yaml                Render blueprint
scripts/start-ledger.sh    local Canton sandbox
```
