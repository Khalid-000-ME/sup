/**
 * Sup DevNet preflight: checks the token, the seven Sup parties, their
 * act-as rights and the uploaded package, then opens the custody accounts.
 *
 * Usage: npm run sup:devnet
 */
import { supDevnetStatus, supPartyName, getSupWorld, readSupDar } from "../src/lib/sup/server";
import { SUP_ORDER, SUP_PERSONAS } from "../src/lib/sup/personas";
import { ledgerUserId, partyNamespace } from "../src/lib/server/auth";
import { allocateParty, uploadDar, LedgerError } from "../src/lib/server/ledger";
import { SUP_DAR_PATH, isDevnet, LEDGER_URL, NETWORK } from "../src/lib/server/config";

const CONSOLE_URL = "https://console.participant.hackcanton-01.devnet.naas.noders.services/";

const ok = (s: string) => console.log(`  ✔ ${s}`);
const bad = (s: string) => console.log(`  ✘ ${s}`);
const info = (s: string) => console.log(`    ${s}`);

async function main() {
  console.log(`\nSup · DevNet preflight`);
  console.log(`network = ${NETWORK}`);
  console.log(`ledger  = ${LEDGER_URL}\n`);

  if (!isDevnet) {
    bad(`SUP_NETWORK is "${NETWORK}". Set SUP_NETWORK=devnet in web/.env.local first.`);
    process.exit(1);
  }

  try {
    const r = await fetch(`${LEDGER_URL}/v2/version`, { cache: "no-store" });
    const v = (await r.json()) as { version?: string };
    ok(`participant reachable · Canton ${v.version ?? "?"}`);
  } catch (e) {
    bad(`cannot reach ${LEDGER_URL}: ${(e as Error).message}`);
    process.exit(1);
  }

  let ns: string;
  try {
    ok(`access token valid · ledger user ${await ledgerUserId()}`);
    ns = await partyNamespace();
    ok(`party namespace ${ns}`);
  } catch (e) {
    bad((e as Error).message);
    process.exit(1);
  }

  // DAR
  try {
    await uploadDar(await readSupDar());
    ok(`Sup DAR uploaded via the Ledger API`);
  } catch (e) {
    if (e instanceof LedgerError && (e.status === 403 || e.status === 401)) {
      info(`DAR upload over the API is not permitted for tenant tokens (expected).`);
      info(`Upload it once by hand: ${CONSOLE_URL} → Collections → Upload DAR`);
      info(`File: ${SUP_DAR_PATH}`);
    } else {
      info(`DAR upload said: ${(e as Error).message}`);
    }
  }

  let status = await supDevnetStatus();
  if (status.missing.length) {
    console.log("");
    let created = 0;
    for (const role of status.missing) {
      const name = supPartyName(role);
      try {
        ok(`allocated ${name} → ${await allocateParty(name)}`);
        created++;
      } catch (e) {
        const denied = e instanceof LedgerError && (e.status === 403 || e.status === 401);
        info(`${name}: ${denied ? "API allocation not permitted — use the Console" : (e as Error).message}`);
        break;
      }
    }
    if (created) status = await supDevnetStatus();
  }

  console.log("");
  for (const p of status.parties) {
    const label = `${p.name.padEnd(22)} ${SUP_PERSONAS[p.role].label}`;
    if (p.party && p.canActAs) ok(`${label}  ${p.party}`);
    else if (p.party) bad(`${label}  exists but no can-act-as`);
    else bad(`${label}  missing`);
  }

  if (status.missing.length || status.noRights.length) {
    console.log(`\nManual steps left, in ${CONSOLE_URL}`);
    if (status.missing.length) {
      console.log(`\n  Participants → HackCanton node → Parties → Create Party, once per name:`);
      for (const r of status.missing) console.log(`     ${supPartyName(r)}`);
      console.log(`  (the node prefixes each with ${ns} automatically)`);
    }
    if (status.noRights.length)
      console.log(`\n  Click "Assign can-act-as" on: ${status.noRights.map(supPartyName).join(", ")}`);
    console.log(`\nThen run: npm run sup:devnet\n`);
    process.exit(1);
  }

  console.log("");
  const world = await getSupWorld();
  ok(`custody accounts ready (seller ↔ asset issuer, buyer ↔ cash issuer)`);
  console.log(`\nSup is ready on DevNet. Start the app:  npm run dev   →  /sup`);
  console.log(`Parties:`);
  for (const r of SUP_ORDER) console.log(`  ${r.padEnd(12)} ${world.parties[r]}`);
  console.log("");
}

main().catch((e) => {
  console.error(`\nFAILED: ${(e as Error).message}\n`);
  process.exit(1);
});
