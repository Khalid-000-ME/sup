import fs from "node:fs";
import { accessToken } from "../src/lib/server/auth";
import { LEDGER_URL } from "../src/lib/server/config";
async function main() {
  const [id, out] = process.argv.slice(2);
  const r = await fetch(`${LEDGER_URL}/v2/packages/${id}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!r.ok) { console.error(`HTTP ${r.status}`); process.exit(2); }
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
}
main().catch((e) => { console.error(e); process.exit(1); });
