# Deploying Sup to Canton DevNet

Sup runs against the shared HackCanton participant on Canton DevNet (Canton 3.6.1, hosted by NODERS), authenticated with Keycloak. It can also run against a local sandbox (`./scripts/start-ledger.sh`) for the test-token flows.

## What the shared node allows

You get a private slice of a shared participant, not your own node. That shapes the deployment:

- **One ledger user**, whose id is your Keycloak `sub`. You cannot create ledger users, so the app submits every command as that single user and relies on its `can-act-as` rights over all seven Sup parties.
- **Parties are created in the Console**, not over the API. Each gets your namespace prefix (first segment of your Keycloak id plus `-`), so a party created as `sup-seller` becomes `<prefix>sup-seller::1220…`. The limit is 20 parties; Sup uses 7.
- **DAR upload is a Console action** for tenant tokens. The preflight tries the API first and tells you if it is refused.

## One-time setup

### 1. Onboard and create the parties

1. Open the [Wallet](https://wallet.validator.hackcanton-01.devnet.naas.noders.services/), sign in with your HackCanton platform login, and click **Onboard yourself**. This allocates your primary party.
2. Open the [Node Console](https://console.participant.hackcanton-01.devnet.naas.noders.services/) and click **Sign in with Authfactory** (not the email/password button).
3. Go to **Participants → HackCanton node → Parties → Create Party** and create these seven, exactly:

```
sup-seller
sup-buyer
sup-agent
sup-auditor
sup-asset-issuer
sup-cash-issuer
sup-outsider
```

Each should show an **Act-as on** badge. If one says *created without can-act-as*, click **Assign can-act-as**.

### 2. Upload the DAR

```bash
cd daml/sup && dpm build
```

In the Console: **Collections → Upload DAR**, select the HackCanton node, and choose `daml/sup/.daml/dist/sup-0.3.0.dar`.

Versions are cumulative and upgrade-compatible, so older uploads can stay: `0.1.0` (escrow), `0.2.0` (Token Standard holdings and allocations), `0.3.0` (adds `SettleDvPExternal` for settling in real Canton Coin). Upgrade compatibility was checked against a Canton node over the full `0.1.0 → 0.2.0 → 0.3.0` chain. If the model changes again, bump `version:` in `daml/sup/daml.yaml`, because the node rejects different content under an existing version.

### 3. Add credentials

```bash
cd web
cp .env.example .env.local
```

Set these in `.env.local` (gitignored, never commit it):

```
SUP_NETWORK=devnet
OIDC_USERNAME=<your HackCanton platform email>
OIDC_PASSWORD=<your HackCanton platform password>   # CANTON_LOGIN_PASSWORD also works
SUP_PARTY_BASE=sup                                  # default
```

The app exchanges these for a Keycloak access token with the `daml_ledger_api` scope, caches it in memory, and refreshes it before the 3-hour expiry. Tokens are never logged or sent anywhere except the Keycloak token endpoint and the participant.

If you prefer not to store the password, get a refresh token once and set `OIDC_REFRESH_TOKEN` instead. Treat it as a password: it does not expire on its own.

### 4. Preflight and run

```bash
cd web
npm run sup:devnet          # preflight: token, 7 parties, rights, package; opens custody accounts
npm run sup:e2e             # full lifecycle with test tokens, every privacy assertion
npm run sup:e2e:amulet      # full lifecycle settled in REAL Canton Coin
npm run sup:e2e:portal      # portal flows: custom bonds, one-click buy and deliver, reference check
npm run sup:seed:market     # several bonds and open offers for the buyer's leaderboard
npm run dev                 # http://localhost:3000
```

`sup:devnet` prints a tick per check and, if anything is missing, the exact Console steps left. It is safe to re-run.

### Real Canton Coin

`sup:e2e:amulet` and the **Add 1,000 CC** buttons use the DevNet faucet on **your own wallet** (your Keycloak user must be onboarded in the Wallet UI), then send coin to `sup-buyer` through the standard `TransferFactory`. The faucet is public DevNet infrastructure and the coin has no market value. See [sup/token-standard.md](sup/token-standard.md).

### Real CBTC (BitSafe) on DevNet

The buyer can hold and pay in real CBTC, issued through the DA Utility registry that is already installed on the shared node.

1. Open the [BitSafe faucet](https://cbtc-faucet.bitsafe.finance/), choose the **Devnet** tab and token **CBTC**.
2. Request 0.01 to 1 CBTC to the buyer party (the onboarding fund step shows it with a copy button).
3. Click **I requested it, claim now**, or run `npm run sup:e2e:cbtc`. Claiming accepts the pending standard transfer.

`npm run sup:e2e:cbtc` then settles a bond for 0.01 CBTC in one transaction. Registry settings can be overridden with `UTILITIES_API`, `CBTC_ADMIN` and `CETH_ADMIN`. cETH (onRails) is configured the same way, but there is no known way to obtain it yet, so it has not been tested.

## Notes

- **Shared node.** Other teams' parties and contracts live on the same participant. Sup filters the ACS by package name.
- **Latency.** DevNet round-trips are slower than a local sandbox. Party allocation can take up to a minute; the Console reports success once it lands.
- **Off-ledger data.** Bond metadata, the seller's delivery references and the per-trade transaction log live in `web/.data/sup-store.json`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Keycloak rejected the password grant: Invalid user credentials` | Wrong email/password in `.env.local` |
| `DevNet rejected the access token (401)` | Token expired and refresh failed. Restart the app to re-authenticate |
| `Missing parties on the shared node` | Create them in the Console with the exact names above |
| `No can-act-as for …` | Click **Assign can-act-as** on those parties |
| `PERMISSION_DENIED` on a submit | The party exists but your user lost act-as; re-assign it |
| Template `#sup:…` not found | The DAR is not uploaded or not vetted on this node |
| A new top-level route returns 404 in dev | Restart `next dev` after `rm -rf .next` |

Errors from the node carry a trace id (TID). Look it up in [Grafana](https://grafana.participant.hackcanton-01.devnet.naas.noders.services/) to see the real cause.
