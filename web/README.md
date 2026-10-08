# Sup web app

The Next.js app for Sup: the landing page and explainer pages (`/`, `/why`, `/how`, `/proof`) and the seller, buyer and agent portals (`/seller`, `/buyer`, `/agent`). The server talks to a Canton participant through the JSON Ledger API.

```bash
cp .env.example .env.local     # fill in the DevNet login
npm install
npm run dev                    # http://localhost:3000
```

Everything else (what Sup is, how to run the tests, how to deploy) is in the [repository README](../README.md) and [docs/](../docs/).

| Script | What it does |
| --- | --- |
| `npm run sup:devnet` | Preflight: token, parties, rights, package |
| `npm run sup:e2e` | Full lifecycle on the live ledger, every privacy assertion |
| `npm run sup:e2e:amulet` | The same, settled in real Canton Coin |
| `npm run sup:e2e:cbtc` | The same, settled in real BitSafe CBTC |
| `npm run sup:e2e:portal` | Bonds, one-click buy and deliver, delivery-reference check |
| `npm run sup:seed:market` | Seeds bonds and open offers for the market |
| `npm run demo:record` / `demo:build` | Records and assembles the demo video (see `scripts/demo/`) |
