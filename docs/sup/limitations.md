# Sup — limitations

- **`BOND-2031` and `CashUSD` are test assets** issued by demo parties (the bond registry and the cash issuer). They implement the Canton Token Standard, so any standard tool reads them, but they are not a real security, not real cash, and carry no legal title.
- **Canton Coin is real, but DevNet-only.** Settling in real Canton Coin uses the DSO's registry and DevNet CC, which has no market value. It does not work on the local sandbox. No BitSafe cBTC integration is claimed: it is not deployed on the HackCanton DevNet node.
- **An external payment lock is the registry's, not Sup's.** A Canton Coin allocation can be withdrawn by its sender, so the seller's exposure is liveness (settlement can fail), not loss. See [token-standard.md](token-standard.md).
- **Issuers are stakeholders of the locked legs.** This is what makes one-transaction DvP possible; it is a real disclosure and is documented in [privacy.md](privacy.md).
- **No dispute resolution.** The PRD lists a `Disputed` state; it is deliberately not built. Parties unwind by mutual cancellation or wait for expiry. A documented gap is better than a superficial arbitration flow.
- **One bilateral trade at a time.** No partial fills, no netting, no multi-leg or FX settlement, no secondary transfer of positions.
- **Document references are hashes only.** There is no document store, no verification of what the hash refers to, and no integration with a delivery system.
- **Custodial demo wallet.** The backend acts as each party from a fixed role allow-list; the browser never supplies a Daml party. There is no end-user wallet signing (no Grofty / CIP-0103 integration).
- **Single participant.** All seven parties are hosted on one Canton participant node.
- **No identity, eligibility or compliance controls.** Counterparties are chosen from a fixed demo set.

- **cETH (onRails)** is configured the same way as CBTC but has not been tested: there is no known way to obtain DevNet cETH. **CBTC** is real BitSafe CBTC from their DevNet faucet, in small amounts (the faucet allows 0.01 to 1 per request).
