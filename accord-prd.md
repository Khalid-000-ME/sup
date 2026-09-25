# Accord
## Private Atomic Escrow for Tokenized-Asset Settlement on Canton

**Document type:** Product Requirements Document (PRD)  
**Version:** 1.0  
**Status:** Hackathon MVP specification  
**Target:** HackCanton Season 3 — Track 2: Financial Applications  
**Primary chain / ledger:** Canton event-supported environment  
**Smart-contract language:** Daml  
**Working name:** Accord

---

## 1. Executive summary

Accord is a private, multi-party settlement escrow for tokenized assets on Canton.

A seller offers a tokenized asset to an approved buyer at private terms. The buyer commits payment into an escrow workflow. An optional settlement agent confirms conditions or documents. Once the agreed conditions are satisfied, asset and payment transfer atomically: either the buyer receives the asset and the seller receives payment, or neither leg settles.

Canton privacy keeps transaction terms visible only to the parties that need them. The seller, buyer, and settlement agent can each see their relevant obligations; unrelated parties cannot see the asset, price, counterparty, documents, or settlement amount.

### One-line pitch

> Accord lets institutions settle tokenized assets privately: payment and delivery complete atomically, while price, counterparties, and documents remain visible only to authorized parties.

### Narrow MVP claim

> Given a seller, buyer, tokenized asset, payment token, and optional settlement agent, Accord can create a private escrow agreement, lock both legs, and settle delivery-versus-payment atomically on Canton.

---

## 2. Problem

Institutional asset settlement is multi-party and conditional.

A buyer wants certainty that payment is released only when it receives the asset. A seller wants certainty that the asset is released only when it receives payment. A settlement agent, custodian, administrator, or document verifier may need to confirm conditions before settlement.

Public blockchains are a poor fit for many institutional workflows because they expose:

- Asset identity and quantity.
- Transaction price.
- Buyer and seller addresses.
- Settlement timing.
- Documents or references.
- Failed or cancelled trade attempts.

Traditional settlement systems solve privacy but often require manual reconciliation and separate systems for asset movement, cash movement, approvals, and audit trails.

Accord uses Daml contracts to represent the legal/economic workflow directly:

```text
private trade terms
        +
private asset lock
        +
private payment lock
        +
conditional approval
        =
atomic delivery-versus-payment settlement
```

---

## 3. Why Canton

Accord must demonstrate functionality that is stronger on Canton than on a public EVM ledger.

### 3.1 Privacy

Daml contracts are disclosed to their signatories and explicitly designated observers. Accord uses this participant model so that:

- Buyer sees its trade and payment commitment.
- Seller sees its trade and asset commitment.
- Settlement agent sees only the conditions it must verify.
- Auditor may see an explicit audit view if authorized.
- Unrelated participants see nothing.

### 3.2 Atomic settlement

Daml transaction composition lets a workflow consume locked asset and payment contracts and create transferred ownership contracts in one atomic ledger transaction.

```text
Buyer payment lock consumed
Seller asset lock consumed
Buyer asset ownership created
Seller payment ownership created
Escrow agreement archived
```

All changes happen together, or none happen.

### 3.3 Multi-party workflow

A token transfer alone is not an institutional settlement workflow. Accord models the roles, condition approval, cancellation, expiry, and exception path as contracts controlled by the appropriate parties.

---

## 4. Target users

### 4.1 Seller

An institution, issuer, fund, broker, or asset owner selling a tokenized asset.

### 4.2 Buyer

An institution, fund, treasury, or accredited counterparty purchasing the asset.

### 4.3 Settlement agent

A custodian, administrator, delivery verifier, document checker, or trusted operations party that confirms settlement conditions.

### 4.4 Auditor

Optional observer receiving only expressly disclosed records for audit or compliance purposes.

### 4.5 Asset issuer

Issuer of the tokenized asset. In the MVP, this may also mint test assets.

### 4.6 Cash issuer

Issuer of the payment token. In the MVP, this is a test cash-token issuer.

---

## 5. Goals and non-goals

### 5.1 Goals

- Model a private bilateral trade agreement.
- Lock a tokenized asset from the seller.
- Lock payment from the buyer.
- Support a required approval or document condition.
- Settle delivery-versus-payment atomically.
- Support cancellation before both legs are locked.
- Support expiry and return of locked assets.
- Show different party views proving privacy.
- Deploy Daml contracts to the event-supported Canton environment.
- Provide a clear institutional dashboard and settlement timeline.
- Provide reproducible Daml tests.

### 5.2 Non-goals

- Public exchange order book.
- General DEX or AMM.
- Real-world legal title transfer.
- Production KYC/AML.
- Production cash-token issuance.
- Production custody.
- Cross-chain bridge.
- Full corporate-action lifecycle.
- Multi-currency FX routing.
- Partial fills.
- Netting across many trades.
- Credit and margin management.
- A governance token.

---

## 6. Product scope

The MVP handles one settlement pattern:

```text
Private delivery-versus-payment escrow
```

Trade terms:

```text
Asset: tokenized asset class
Quantity: fixed
Price: fixed cash-token amount
Seller: one party
Buyer: one party
Settlement agent: optional / required
Expiry: fixed ledger timestamp
Condition: optional delivery-document or approval hash
Settlement: atomic transfer of asset for payment
```

### 6.1 Example scenario

```text
SellerFund sells 100 tokenized bond units to BuyerTreasury.
Price: 98,500 CashUSD.
Settlement agent: AdminCo.
Condition: delivery reference DOC-8841 is approved.

Buyer locks 98,500 CashUSD.
Seller locks 100 BondToken units.
AdminCo approves the document reference.

Accord atomically transfers:
100 BondToken -> BuyerTreasury
98,500 CashUSD -> SellerFund
```

No unrelated participant sees the price, asset size, or document reference.

---

## 7. State machine

```text
Draft
  ↓
Proposed
  ↓
Accepted
  ├── SellerAssetLocked
  ├── BuyerPaymentLocked
  ↓
BothLegsLocked
  ↓
ConditionApproved
  ↓
Settled

Alternative terminal states:
Cancelled
Expired
Disputed
```

### 7.1 State definitions

| State | Meaning |
|---|---|
| Proposed | Seller has created private trade terms |
| Accepted | Buyer accepted terms; escrow is active |
| SellerAssetLocked | Seller has deposited the asset leg |
| BuyerPaymentLocked | Buyer has deposited the cash leg |
| BothLegsLocked | Both obligations are escrowed |
| ConditionApproved | Required settlement condition has passed |
| Settled | Asset and payment moved atomically |
| Cancelled | Trade terminated before irreversible settlement |
| Expired | Deadline passed; locked legs returned |
| Disputed | Optional exception state requiring manual resolution |

For simplicity, the implementation can encode combinations of locks and approval as fields in one `EscrowTrade` contract rather than separate templates for each state.

---

## 8. Privacy model

### 8.1 Visibility matrix

| Information | Seller | Buyer | Settlement agent | Auditor | Unrelated party |
|---|---:|---:|---:|---:|---:|
| Asset ID and quantity | Yes | Yes | Optional | Optional | No |
| Price and currency | Yes | Yes | Optional | Optional | No |
| Counterparty | Yes | Yes | Optional | Optional | No |
| Document reference | Yes | Yes | Yes if needed | Optional | No |
| Asset lock status | Yes | Yes | Optional | Optional | No |
| Payment lock status | Yes | Yes | Optional | Optional | No |
| Condition approval | Yes | Yes | Yes | Optional | No |
| Settlement result | Yes | Yes | Optional | Optional | No |

### 8.2 Party design

`EscrowTrade` signatories:

```text
Seller
Buyer
```

Observers:

```text
Settlement agent, if required
Auditor, if explicitly selected
```

Asset and payment contracts should disclose only to their owners, issuers, and any strictly necessary settlement stakeholders.

### 8.3 Privacy demo requirement

The UI MUST show at least four views:

1. Seller view.
2. Buyer view.
3. Settlement-agent view.
4. Unrelated-party view.

The unrelated party must not be able to discover the private trade in its ledger query or application dashboard.

---

## 9. Daml architecture

Recommended project layout:

```text
accord/
├── daml/
│   ├── Accord/
│   │   ├── Types.daml
│   │   ├── Asset.daml
│   │   ├── Cash.daml
│   │   ├── Escrow.daml
│   │   ├── Conditions.daml
│   │   ├── Settlement.daml
│   │   └── TestHelpers.daml
│   └── Main.daml
├── test/
│   └── AccordTest.daml
├── backend/
│   ├── src/index.ts
│   ├── src/ledger.ts
│   ├── src/routes/trades.ts
│   ├── src/routes/assets.ts
│   └── src/routes/actions.ts
├── ui/
│   ├── src/
│   └── package.json
├── scripts/
│   ├── deploy.sh
│   ├── seed.ts
│   └── demo.ts
├── docs/
│   ├── architecture.md
│   ├── privacy.md
│   ├── settlement.md
│   └── limitations.md
└── README.md
```

---

## 10. Daml types

```daml
module Accord.Types where

import DA.Time

data TradeStatus
  = Proposed
  | Accepted
  | AssetLocked
  | PaymentLocked
  | ReadyToSettle
  | Settled
  | Cancelled
  | Expired
  | Disputed
  deriving (Eq, Show)

data ConditionStatus
  = NoCondition
  | PendingApproval
  | Approved
  | Rejected
  deriving (Eq, Show)

data AssetDescriptor = AssetDescriptor with
  issuer : Party
  symbol : Text
  classId : Text
  deriving (Eq, Show)

data CashDescriptor = CashDescriptor with
  issuer : Party
  currency : Text
  deriving (Eq, Show)
```

---

## 11. Asset templates

### 11.1 Tokenized asset

Use a minimal test asset for the MVP. Replace it with a sponsor/event-approved asset interface only after confirming package IDs and transfer choices.

```daml
module Accord.Asset where

import Daml.Script

template AssetToken
  with
    issuer : Party
    owner : Party
    assetClass : Text
    quantity : Decimal
    metadataHash : Text
  where
    signatory issuer, owner

    ensure quantity > 0.0

    choice Split : (ContractId AssetToken, ContractId AssetToken)
      with splitQuantity : Decimal
      controller owner
      do
        assertMsg "invalid split" (splitQuantity > 0.0 && splitQuantity < quantity)
        a <- create this with quantity = splitQuantity
        b <- create this with quantity = quantity - splitQuantity
        pure (a, b)

    choice Transfer : ContractId AssetToken
      with newOwner : Party
      controller owner
      do create this with owner = newOwner

    choice ArchiveAsset : ()
      controller owner
      do pure ()
```

### 11.2 Cash token

```daml
module Accord.Cash where

template CashToken
  with
    issuer : Party
    owner : Party
    currency : Text
    amount : Decimal
  where
    signatory issuer, owner

    ensure amount > 0.0

    choice Split : (ContractId CashToken, ContractId CashToken)
      with splitAmount : Decimal
      controller owner
      do
        assertMsg "invalid split" (splitAmount > 0.0 && splitAmount < amount)
        a <- create this with amount = splitAmount
        b <- create this with amount = amount - splitAmount
        pure (a, b)

    choice Transfer : ContractId CashToken
      with newOwner : Party
      controller owner
      do create this with owner = newOwner

    choice ArchiveCash : ()
      controller owner
      do pure ()
```

### 11.3 Mock-asset disclosure

The README MUST state whether the demo uses:

- A real event-supported tokenized asset and cash-token interface; or
- A mock Daml asset and cash token for workflow demonstration.

Do not present mock tokens as production RWA or cash.

---

## 12. Escrow trade template

### 12.1 Contract structure

```daml
module Accord.Escrow where

import DA.Time
import Accord.Types

template EscrowTrade
  with
    seller : Party
    buyer : Party
    settlementAgent : Optional Party
    auditor : Optional Party
    assetDescriptor : AssetDescriptor
    assetQuantity : Decimal
    cashDescriptor : CashDescriptor
    cashAmount : Decimal
    documentHash : Optional Text
    expiry : Time
    conditionStatus : ConditionStatus
    assetLockCid : Optional (ContractId AssetToken)
    paymentLockCid : Optional (ContractId CashToken)
    createdAt : Time
  where
    signatory seller, buyer
    observer settlementAgent, auditor

    ensure assetQuantity > 0.0
    ensure cashAmount > 0.0

    choice LockAsset : ContractId EscrowTrade
      with assetCid : ContractId AssetToken
      controller seller
      do
        asset <- fetch assetCid
        assertMsg "wrong asset owner" (asset.owner == seller)
        assertMsg "wrong asset issuer" (asset.issuer == assetDescriptor.issuer)
        assertMsg "wrong asset class" (asset.assetClass == assetDescriptor.classId)
        assertMsg "insufficient asset quantity" (asset.quantity >= assetQuantity)
        assertMsg "asset already locked" (isNone assetLockCid)

        exercise assetCid ArchiveAsset

        locked <- create AssetToken with
          issuer = asset.issuer
          owner = seller
          assetClass = asset.assetClass
          quantity = assetQuantity
          metadataHash = asset.metadataHash

        let remaining = asset.quantity - assetQuantity
        _change <- if remaining > 0.0
          then create AssetToken with
            issuer = asset.issuer
            owner = seller
            assetClass = asset.assetClass
            quantity = remaining
            metadataHash = asset.metadataHash
          else pure locked

        create this with assetLockCid = Some locked

    choice LockPayment : ContractId EscrowTrade
      with paymentCid : ContractId CashToken
      controller buyer
      do
        payment <- fetch paymentCid
        assertMsg "wrong payment owner" (payment.owner == buyer)
        assertMsg "wrong cash issuer" (payment.issuer == cashDescriptor.issuer)
        assertMsg "wrong currency" (payment.currency == cashDescriptor.currency)
        assertMsg "insufficient payment" (payment.amount >= cashAmount)
        assertMsg "payment already locked" (isNone paymentLockCid)

        exercise paymentCid ArchiveCash

        locked <- create CashToken with
          issuer = payment.issuer
          owner = buyer
          currency = payment.currency
          amount = cashAmount

        let remaining = payment.amount - cashAmount
        _change <- if remaining > 0.0
          then create CashToken with
            issuer = payment.issuer
            owner = buyer
            currency = payment.currency
            amount = remaining
          else pure locked

        create this with paymentLockCid = Some locked
```

### 12.2 Important implementation note

The `locked` contracts above are still owned by seller/buyer in this simplified model. In a stronger escrow model, introduce an explicit `EscrowCustody` template, co-signed by buyer and seller or controlled by a dedicated settlement party, so neither original owner can transfer or archive the locked leg outside the trade workflow.

The MVP MUST prevent use of locked contracts outside the trade flow. Recommended approach: consume original assets and create specialized locked templates rather than regular token contracts.

---

## 13. Locked-leg templates

### 13.1 Locked asset

```daml
template LockedAsset
  with
    escrowId : Text
    issuer : Party
    seller : Party
    buyer : Party
    settlementAgent : Optional Party
    assetClass : Text
    quantity : Decimal
  where
    signatory seller, buyer
    observer settlementAgent

    ensure quantity > 0.0
```

### 13.2 Locked payment

```daml
template LockedPayment
  with
    escrowId : Text
    issuer : Party
    buyer : Party
    seller : Party
    settlementAgent : Optional Party
    currency : Text
    amount : Decimal
  where
    signatory seller, buyer
    observer settlementAgent

    ensure amount > 0.0
```

These templates represent funds committed to the bilateral agreement. The only choices that consume them should be settlement, cancellation, expiry return, or dispute resolution.

### 13.3 Why this is necessary

If the locked token remains owned and controlled solely by its depositor, the depositor may be able to transfer it outside the escrow path. The lock must be enforced at the contract model layer, not merely represented in the UI.

---

## 14. Condition approval

### 14.1 Condition type

The MVP supports one optional condition:

```text
documentHash must be approved by the designated settlement agent
```

Examples:

- Delivery confirmation reference.
- Custody confirmation.
- NAV confirmation.
- Trade affirmation ID.
- Compliance approval hash.

No document content is stored onchain; only a hash or opaque reference is stored.

### 14.2 Approval choice

```daml
choice ApproveCondition : ContractId EscrowTrade
  with now : Time
  controller settlementAgent
  do
    assertMsg "no settlement agent" (isSome settlementAgent)
    assertMsg "approval not required" (conditionStatus == PendingApproval)
    create this with conditionStatus = Approved
```

Daml’s `Optional Party` controller syntax may require pattern matching. A robust implementation can use a separate `SettlementCondition` template whose signatory is the agent and which references the trade.

### 14.3 No-condition path

If no settlement agent or document condition is required:

```text
conditionStatus = NoCondition
```

Then settlement becomes eligible immediately after both legs are locked.

---

## 15. Atomic settlement

### 15.1 Eligibility

Settlement is allowed only when:

- Asset leg is locked.
- Payment leg is locked.
- Condition is approved or not required.
- Trade has not expired.
- Trade has not been cancelled or disputed.

### 15.2 Settlement transaction

```text
Consume EscrowTrade
Consume LockedAsset
Consume LockedPayment
Create AssetToken owned by buyer
Create CashToken owned by seller
Archive escrow state
```

### 15.3 Settlement Daml sketch

```daml
choice SettleDvP : (ContractId AssetToken, ContractId CashToken)
  with
    lockedAssetCid : ContractId LockedAsset
    lockedPaymentCid : ContractId LockedPayment
    now : Time
  controller seller, buyer
  do
    assertMsg "expired" (now <= expiry)
    assertMsg "condition not approved" (
      conditionStatus == NoCondition || conditionStatus == Approved
      )

    lockedAsset <- fetch lockedAssetCid
    lockedPayment <- fetch lockedPaymentCid

    assertMsg "wrong asset escrow" (lockedAsset.seller == seller && lockedAsset.buyer == buyer)
    assertMsg "wrong payment escrow" (lockedPayment.buyer == buyer && lockedPayment.seller == seller)
    assertMsg "wrong asset quantity" (lockedAsset.quantity == assetQuantity)
    assertMsg "wrong payment amount" (lockedPayment.amount == cashAmount)

    exercise lockedAssetCid Archive
    exercise lockedPaymentCid Archive

    deliveredAsset <- create AssetToken with
      issuer = lockedAsset.issuer
      owner = buyer
      assetClass = lockedAsset.assetClass
      quantity = lockedAsset.quantity
      metadataHash = "settled-via-accord"

    deliveredCash <- create CashToken with
      issuer = lockedPayment.issuer
      owner = seller
      currency = lockedPayment.currency
      amount = lockedPayment.amount

    pure (deliveredAsset, deliveredCash)
```

Actual Daml choice implementation must use valid contract archival semantics. The key requirement is that both locked legs and the trade contract are consumed in the same transaction that creates both delivery legs.

### 15.4 Atomicity proof in demo

The demo must show one transaction ID whose resulting events include:

- Asset lock consumed.
- Payment lock consumed.
- Buyer asset created.
- Seller cash created.
- Trade archived or moved to settled state.

---

## 16. Cancellation, expiry, and dispute

### 16.1 Cancellation before locks

Before either leg is locked, seller and buyer may cancel by mutual agreement.

```daml
choice CancelByAgreement : ()
  controller seller, buyer
  do pure ()
```

### 16.2 Expiry

After expiry, if settlement did not occur:

```text
Locked asset -> seller
Locked payment -> buyer
Escrow -> archived
```

Neither party should need to trust the other to return funds after a deadline.

### 16.3 Dispute

The MVP may implement a manual dispute state:

```text
Either party flags dispute
Settlement disabled
Settlement agent or operator resolves by returning legs or settling
```

Do not build complex arbitration if time is limited. A documented limitation is preferable to a superficial dispute system.

---

## 17. UI requirements

### 17.1 Seller dashboard

Show:

- Offered asset class and quantity.
- Trade price.
- Buyer counterparty.
- Payment-lock status.
- Asset-lock status.
- Required condition status.
- Expiry countdown.
- Settle button when eligible.
- Private settlement timeline.

### 17.2 Buyer dashboard

Show:

- Asset being acquired.
- Price and payment currency.
- Seller counterparty.
- Payment-lock status.
- Asset-lock status.
- Required condition status.
- Expiry countdown.
- Settlement result.

### 17.3 Settlement-agent dashboard

Show only:

- Trade reference.
- Document hash/reference.
- Whether approval is pending.
- Approve/reject control.
- Optional minimum metadata needed to perform role.

The agent should not automatically see commercial terms unless it is expressly designated as an observer of those fields.

### 17.4 Unrelated-party dashboard

Show:

```text
No visible private settlements.
```

The UI should query the ledger as the unrelated party, not just hide data in frontend CSS.

### 17.5 Required graphs

Use functional visuals:

1. **Settlement timeline:** proposed -> asset locked -> payment locked -> condition approved -> settled.
2. **Atomic DvP diagram:** asset moves left-to-right and cash moves right-to-left only at settlement.
3. **Visibility map:** which party sees which contract.
4. **Escrow state chart:** locked asset and cash status over time.
5. **Settlement finality card:** transaction ID and party-specific result.

Avoid decorative market charts. Accord is a workflow product, so charts must explain workflow state and privacy.

---

## 18. Backend architecture

### 18.1 Services

- Daml ledger API client.
- Party/session management.
- Contract query service scoped to authenticated party.
- Command submission service.
- UI API.
- Demo seed service.
- Optional event indexer for timeline rendering.

### 18.2 API endpoints

```text
GET  /trades
GET  /trades/:contractId
POST /trades
POST /trades/:contractId/lock-asset
POST /trades/:contractId/lock-payment
POST /trades/:contractId/approve-condition
POST /trades/:contractId/settle
POST /trades/:contractId/cancel
POST /trades/:contractId/expire
GET  /privacy-view/:party
```

### 18.3 Authentication

The backend MUST map each session or wallet connection to one Canton/Daml party.

Do not accept a `party` field from the browser and trust it. Resolve it from session state or a signed authentication flow.

### 18.4 Command validation

Before submitting any Daml choice:

- Confirm contract is visible to authenticated party.
- Confirm party is authorized controller for the choice.
- Confirm supplied asset/payment contract IDs belong to appropriate owner.
- Confirm amounts match agreement.
- Confirm trade is not expired.

---

## 19. Wallet integration

If Grofty or another event-supported wallet is accessible, integrate one complete flow:

```text
Connect wallet
        -> map to Canton party
        -> receive demo asset or cash
        -> create / accept trade
        -> lock leg
        -> settle
```

If access is unavailable, use the event-supported Canton wallet or party/session system.

Keep an abstraction:

```typescript
interface CantonWalletAdapter {
  connect(): Promise<{ party: string; address?: string }>;
  submit(commands: unknown[]): Promise<{ transactionId: string }>;
  query(templateId: string): Promise<unknown[]>;
}
```

Do not claim a Grofty bounty or integration unless the flow is operational and approved.

---

## 20. Security requirements

### 20.1 Asset safety

- Asset cannot be locked twice.
- Locked asset cannot be transferred outside escrow choices.
- Payment cannot be locked twice.
- Locked payment cannot be spent outside escrow choices.
- Quantity and amount must match trade terms exactly.

### 20.2 Settlement safety

- Settlement requires both locks.
- Settlement requires condition approval if configured.
- Asset and payment must transfer in one transaction.
- Settlement can occur at most once.
- Expiry cannot settle after settlement.
- Cancellation cannot occur after both legs lock unless mutual policy allows.

### 20.3 Privacy safety

- No public observer is included by default.
- Settlement agent receives only necessary visibility.
- Auditor is opt-in only.
- Backend queries are party-scoped.
- UI does not rely on hidden CSS for privacy.

### 20.4 Time safety

- Trade expiry is enforced in Daml choices.
- UI timers are informational only.
- Demo time acceleration must be visible.
- Expiry return logic has tests.

### 20.5 Mock asset safety

- Test tokens are clearly labeled.
- No claim of legal title or production value.
- Issuer minting is restricted in the demo environment.

---

## 21. Daml test plan

### 21.1 Unit tests

- Mint asset token.
- Mint cash token.
- Split and transfer asset.
- Split and transfer cash.
- Create private escrow trade.
- Reject zero quantity.
- Reject zero price.
- Lock seller asset.
- Reject wrong asset class.
- Reject insufficient asset quantity.
- Lock buyer payment.
- Reject wrong currency.
- Reject insufficient payment amount.
- Approve condition.
- Reject approval by non-agent.
- Settle when eligible.
- Reject settlement with only one lock.
- Reject settlement with pending condition.
- Reject double settlement.
- Cancel before locks.
- Expire and return legs.

### 21.2 Privacy tests

Test party visibility:

```text
Seller sees trade.
Buyer sees trade.
Settlement agent sees only configured observer data.
Unrelated party does not see trade.
Unrelated party does not see asset/payment locks.
```

Use Daml Script or the relevant ledger query API under each party identity.

### 21.3 End-to-end scenario

```text
AssetIssuer issues 100 BondToken to SellerFund.
CashIssuer issues 100,000 CashUSD to BuyerTreasury.

SellerFund creates private trade:
100 BondToken for 98,500 CashUSD.
Settlement agent AdminCo is required.

BuyerTreasury accepts.
SellerFund locks 100 BondToken.
BuyerTreasury locks 98,500 CashUSD.
AdminCo approves document hash.
SellerFund and BuyerTreasury settle.

Assertions:
BuyerTreasury owns 100 BondToken.
SellerFund owns 98,500 CashUSD.
Locked contracts are consumed.
Trade is settled/archived.
Unrelated party sees no trade.
```

### 21.4 Negative scenario

```text
Buyer locks payment.
Seller never locks asset.
Expiry passes.
Buyer invokes expiry path.
Buyer receives payment return.
Seller never receives buyer payment.
```

---

## 22. Demo plan

### 22.1 Demo parties

```text
AssetIssuer
CashIssuer
SellerFund
BuyerTreasury
AdminCo
OutsideObserver
```

### 22.2 Three-minute technical demo

#### 0:00–0:25 — Problem

> Tokenized asset settlement is still fragmented. Buyers need delivery assurance, sellers need payment assurance, and neither wants their trade terms exposed publicly.

#### 0:25–0:50 — Private trade

Show SellerFund creating a private offer: 100 BondToken for 98,500 CashUSD. Show that OutsideObserver cannot see it.

#### 0:50–1:20 — Lock both legs

Show SellerFund locking the tokenized asset and BuyerTreasury locking payment. Display the settlement timeline.

#### 1:20–1:45 — Condition approval

Show AdminCo viewing the document reference and approving the condition. Show that its view is limited to its role.

#### 1:45–2:20 — Atomic settlement

Trigger settlement. Show one Canton transaction ID, buyer receiving the asset, seller receiving cash, and escrow legs consumed.

#### 2:20–2:45 — Privacy proof

Switch views: seller, buyer, agent, outside observer. Show each sees only authorized information.

#### 2:45–3:00 — Close

> Accord makes delivery-versus-payment private and atomic. Canton keeps terms private by default and settles both legs as one workflow.

---

## 23. Submission materials

### 23.1 README

The first screen must include:

1. One-line pitch.
2. Why Canton.
3. Architecture diagram.
4. Privacy visibility matrix.
5. Atomic settlement diagram.
6. Package ID and deployed environment.
7. Demo link.
8. Test commands.
9. Mock-versus-real asset disclosure.
10. Known limitations.

### 23.2 Documentation

- `docs/privacy.md`: stakeholder and observer design.
- `docs/settlement.md`: DvP transaction composition.
- `docs/architecture.md`: templates and choices.
- `docs/limitations.md`: mock assets, no legal title, no production compliance.

### 23.3 Live link

The live product link must include clear instructions for accessing demo parties and pre-seeded test state.

---

## 24. Judging narrative

### Technical execution

Show a full workflow on Canton:

```text
trade creation -> asset lock -> payment lock -> condition approval -> atomic settlement
```

### Canton insight

Show party-specific visibility:

```text
Seller and buyer see trade terms.
Settlement agent sees only required workflow context.
Outside observer sees no private settlement.
```

### Design and craft

Show an institutional-grade dashboard:

- Timeline.
- Locked-leg status.
- Atomic settlement receipt.
- Privacy map.
- Party-specific views.

### Market readiness

First customer:

> A broker, fund administrator, or institutional trading desk that needs private delivery-versus-payment settlement for tokenized securities, funds, private credit, or collateral transfers.

### Path forward

- Integrate supported tokenized assets.
- Add identity and eligibility controls.
- Add legal document reference adapters.
- Add delivery confirmation integration.
- Add multi-leg FX settlement.
- Add settlement netting.
- Add audit disclosure policies.

---

## 25. Seven-day build plan

### Day 1 — Tokens and trade model

- Set up Daml project.
- Implement mock asset and cash token.
- Implement private trade template.
- Write basic tests.

### Day 2 — Locks

- Implement `LockedAsset` and `LockedPayment`.
- Implement asset and payment lock choices.
- Test double-lock prevention.
- Build basic seller/buyer UI.

### Day 3 — Approval and settlement

- Implement settlement condition.
- Implement atomic DvP settlement choice.
- Add settlement tests.
- Capture transaction events.

### Day 4 — Cancellation and expiry

- Implement cancellation.
- Implement expiry returns.
- Add negative tests.
- Add state timeline.

### Day 5 — Deploy and integrate

- Deploy DAR to available Canton environment.
- Create parties.
- Seed assets and cash.
- Connect wallet/session flow.

### Day 6 — Privacy dashboard

- Build seller, buyer, agent, and observer views.
- Add visibility matrix.
- Add atomic settlement animation from real state.
- Rehearse demo.

### Day 7 — Freeze and submit

- Run tests from clean environment.
- Verify deployment details.
- Publish repository.
- Write README.
- Record demo and pitch video.
- Remove unsupported claims.

### Cut order

If time is constrained, cut:

1. Auditor view.
2. Dispute state.
3. Wallet integration.
4. Multiple asset classes.
5. UI polish.

Never cut:

- Private party views.
- Asset lock.
- Payment lock.
- Atomic settlement.
- One condition approval path.
- Daml tests.
- Live deployment.

---

## 26. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| Project looks like generic escrow | High | Emphasize private multi-party DvP, party views, and atomic workflow |
| Mock assets reduce credibility | Medium | Label clearly; demonstrate strong asset-adapter boundary |
| Locked assets can escape escrow | Critical | Use dedicated locked templates, not ordinary owner-controlled tokens |
| Privacy is only UI-deep | Critical | Query ledger as different parties and show actual different contract visibility |
| Settlement agent sees too much | Medium | Use observer scope deliberately; disclose data minimization |
| Atomicity not demonstrated | Critical | Show one transaction event tree consuming both locked legs and creating both delivery legs |
| Daml deployment delay | High | Start deployment early; maintain local sandbox fallback for development |
| Scope becomes trade-finance platform | High | Build one bilateral DvP scenario only |
| Legal claims overreach | High | State prototype does not represent legal title transfer or production compliance |
| UI lacks institutional quality | Medium | Prioritize state timeline, privacy panel, and settlement receipt over decorative pages |

---

## 27. Acceptance criteria

### Functional

- Seller can hold test asset.
- Buyer can hold test cash.
- Seller and buyer can create a private escrow trade.
- Seller can lock the agreed asset quantity.
- Buyer can lock the agreed payment amount.
- Settlement agent can approve an optional condition.
- Settlement transfers asset and payment atomically.
- Trade cannot settle twice.
- Expiry returns locked legs correctly.
- Cancellation works before irreversible locks.

### Privacy

- Seller sees its private trade.
- Buyer sees its private trade.
- Settlement agent sees only configured data.
- Outside observer cannot query the trade or locked legs.
- UI reflects actual ledger visibility.

### Technical

- Daml tests pass.
- DAR deploys to event-supported environment.
- Contract IDs and transaction IDs are documented.
- README contains reproducible commands.
- All mock assets are labeled.

### Demo

- Live private trade is shown.
- Asset and payment locks are shown.
- Condition approval is shown.
- Atomic DvP settlement is shown.
- Four party views are shown.
- Settlement timeline and receipt are shown.

---

## 28. Final product definition

Accord is:

> A Canton-native private settlement escrow for tokenized assets. It lets institutions lock an asset and payment under private bilateral terms, satisfy an optional settlement condition, and complete delivery-versus-payment atomically without exposing trade details to unrelated parties.

The narrow, testable hackathon claim is:

> Given a buyer, seller, settlement agent, tokenized asset, and payment token, Accord can keep the trade private, lock both legs, and deliver asset-for-payment atomically in one Canton transaction.
