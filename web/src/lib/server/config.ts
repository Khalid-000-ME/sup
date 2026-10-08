import fs from "node:fs";
import path from "node:path";

/** Minimal .env.local loader so `tsx scripts/*.ts` sees the same vars as `next dev`. */
function loadEnvLocal() {
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const raw of fs.readFileSync(p, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!(k in process.env)) process.env[k] = v;
    }
  }
}
loadEnvLocal();

/**
 * "local"  – unauthenticated Canton sandbox on localhost (dpm sandbox).
 * "devnet" – shared HackCanton participant on Canton DevNet, Keycloak-authenticated.
 */
export type Network = "local" | "devnet";

export const NETWORK: Network = (process.env.SUP_NETWORK as Network) ?? "local";
export const isDevnet = NETWORK === "devnet";

const DEVNET_JSON_API = "https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services";

export const LEDGER_URL = process.env.LEDGER_URL ?? (isDevnet ? DEVNET_JSON_API : "http://127.0.0.1:6864");

/** Local sandbox only: we create this ledger user ourselves. On DevNet the user id is the JWT `sub`. */
export const LOCAL_APP_USER_ID = process.env.LEDGER_USER ?? "sup-app";

export const SUP_PACKAGE_NAME = "sup";

/** Keycloak (DevNet). Credentials come from .env.local and are never logged. */
export const OIDC = {
  tokenUrl:
    process.env.OIDC_TOKEN_URL ??
    "https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token",
  clientId: process.env.OIDC_CLIENT_ID ?? "web-app-ui-hackcanton-01-devnet",
  scope: process.env.OIDC_SCOPE ?? "openid daml_ledger_api offline_access",
  // CANTON_LOGIN_* are accepted as aliases for convenience.
  username: process.env.OIDC_USERNAME ?? process.env.CANTON_LOGIN_EMAIL ?? process.env.CANTON_LOGIN_USERNAME ?? "",
  password: process.env.OIDC_PASSWORD ?? process.env.CANTON_LOGIN_PASSWORD ?? "",
  refreshToken: process.env.OIDC_REFRESH_TOKEN ?? "",
};

export const SUP_DAR_PATH =
  process.env.SUP_DAR ?? path.resolve(process.cwd(), "../daml/sup/.daml/dist/sup-0.3.0.dar");

/**
 * DevNet party naming. The Console prefixes every party you create with your namespace,
 * so a party created as `sup-seller` becomes `<prefix>sup-seller::1220…`.
 */
export const SUP_PARTY_BASE = process.env.SUP_PARTY_BASE ?? "sup";
