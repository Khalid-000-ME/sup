# Deploying Sup

Sup is a Next.js app whose server talks to a Canton participant. For the hackathon it talks to the shared HackCanton DevNet node, so deploying means: host `web/`, give it the DevNet login, and protect it from strangers.

## Which host

| Host | Fits? | Why |
| --- | --- | --- |
| **Render (free web service)** | **Recommended** | A normal long-running Node process, so the server's in-memory caches (ledger token, party lookup, read cache) work as designed. Free, deploys from GitHub. |
| Railway / Fly.io / Koyeb | Good alternatives | Same model as Render. Fly and Railway can attach a small persistent volume. |
| Vercel | Works, with cost | Serverless functions have no shared memory and a read-only filesystem. Every cold start re-fetches the ledger token and re-resolves the parties (the first state call took about 6.6 s in our measurements), and each open page polls every 1.5 s, which burns function invocations. The off-ledger store (`.data/`) cannot persist, so bonds created at runtime and the seller's delivery references would vanish. See "If you must use Vercel" below. |
| A tunnel from your laptop | Emergency only | `cloudflared tunnel --url http://localhost:3000` gives a public URL with no account, but it is down whenever your laptop sleeps, and judges review between Oct 10 and 18. |

## Render, step by step

1. **Push the repo to GitHub** (public).
2. In Render: **New, Web Service**, connect the repo.
3. Settings:
   - **Root Directory:** `web`
   - **Runtime:** Node
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm run start`
   - **Instance type:** Free
4. **Environment variables** (Render, then Environment):

   | Key | Value |
   | --- | --- |
   | `NODE_VERSION` | `22` |
   | `SUP_NETWORK` | `devnet` |
   | `OIDC_USERNAME` | your HackCanton platform email |
   | `OIDC_PASSWORD` | your HackCanton platform password |
   | `SUP_PARTY_BASE` | `sup` |
   | `SUP_ACCESS_CODE` | a short code you choose, for example `sup-judges-2026` |

   `SUP_ACCESS_CODE` is what stops strangers from acting as your seven DevNet parties. With it set, anyone can browse, but every action (propose, buy, deliver, approve, faucet) asks for the code once and remembers it. Put the code in your submission notes for the judges. Leave it unset only on your own machine.
5. **Deploy.** The first load takes a minute while the server resolves the parties.
6. **Check:** open `/start`, onboard as seller, and send an offer. Without the code you should be asked for it.
7. **Keep it awake.** The free instance sleeps after about 15 minutes idle, and the first request after that takes 30 to 60 seconds. Add a free [UptimeRobot](https://uptimerobot.com) HTTP monitor on `https://<your-app>.onrender.com/start` every 5 minutes. `/start` is static, so it does not touch the ledger.

### What survives a restart

The free tier has no disk, so `web/.data/sup-store.json` is recreated on each deploy. Nothing on the ledger is lost. What resets: the seller's remembered delivery references for old trades, and the per-trade transaction log (trade pages then say the trade was settled before logging). The three demo bonds are built in, so the market still looks right. For a persistent store set `SUP_DATA_DIR` to a mounted disk path (Render paid disk, Fly volume, Railway volume).

### Credentials

The login lives only in the host's environment variables. It is never in the repository, and the app never sends it anywhere except the Keycloak token endpoint and the DevNet participant. Rotate the password after the hackathon.

## If you must use Vercel

- Set the same environment variables in the project settings (Root Directory `web`).
- Expect slow first requests after idle periods.
- Expect the store to reset. Treat bonds created at runtime as temporary.
- Watch function usage: each open tab makes about one request every two seconds.

## Running it yourself

```bash
cd web
cp .env.example .env.local     # fill in the DevNet login
npm install
npm run dev                    # http://localhost:3000
```
