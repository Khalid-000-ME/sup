import { isDevnet, OIDC } from "./config";

/**
 * Keycloak access-token manager for the shared HackCanton DevNet participant.
 *
 * Tokens last ~3h. We refresh with the refresh token when possible and fall
 * back to the password grant. Nothing here is ever logged — a leaked refresh
 * token is as good as the account password.
 */

interface TokenState {
  access: string;
  refresh: string;
  expiresAt: number;
  /** Keycloak user id (JWT `sub`) — this is also the Daml ledger user id. */
  sub: string;
}

declare global {
  var __supToken: TokenState | undefined;
  var __supTokenInflight: Promise<TokenState> | undefined;
}

export class AuthError extends Error {}

function decodeSub(jwt: string): string {
  const part = jwt.split(".")[1];
  if (!part) throw new AuthError("Malformed access token");
  const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  const sub = (JSON.parse(json) as { sub?: string }).sub;
  if (!sub) throw new AuthError("Access token has no `sub` claim");
  return sub;
}

async function requestToken(body: Record<string, string>): Promise<TokenState> {
  let res: Response;
  try {
    res = await fetch(OIDC.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
  } catch (e) {
    throw new AuthError(`Cannot reach Keycloak at ${OIDC.tokenUrl}: ${(e as Error).message}`);
  }
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    const detail = data.error_description ?? data.error ?? `HTTP ${res.status}`;
    throw new AuthError(`Keycloak rejected the ${body.grant_type} grant: ${detail}`);
  }
  return {
    access: data.access_token,
    refresh: data.refresh_token ?? body.refresh_token ?? "",
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    sub: decodeSub(data.access_token),
  };
}

async function obtain(): Promise<TokenState> {
  const current = globalThis.__supToken;
  // Refresh a minute before expiry.
  if (current && Date.now() < current.expiresAt - 60_000) return current;

  const refresh = current?.refresh || OIDC.refreshToken;
  if (refresh) {
    try {
      return await requestToken({ grant_type: "refresh_token", client_id: OIDC.clientId, refresh_token: refresh });
    } catch {
      // fall through to the password grant
    }
  }
  if (!OIDC.username || !OIDC.password) {
    throw new AuthError(
      "No DevNet credentials. Put OIDC_USERNAME and OIDC_PASSWORD (your HackCanton platform login) in web/.env.local, " +
        "or set OIDC_REFRESH_TOKEN. See docs/devnet.md.",
    );
  }
  return requestToken({
    grant_type: "password",
    client_id: OIDC.clientId,
    username: OIDC.username,
    password: OIDC.password,
    scope: OIDC.scope,
  });
}

/** Cached access token, refreshed automatically. Returns "" when auth is off (local sandbox). */
export async function accessToken(): Promise<string> {
  if (!isDevnet) return "";
  return (await tokenState()).access;
}

export async function tokenState(): Promise<TokenState> {
  if (!isDevnet) throw new AuthError("Token requested while running against the local sandbox");
  const cached = globalThis.__supToken;
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached;
  // Collapse concurrent refreshes into one request.
  if (!globalThis.__supTokenInflight) {
    globalThis.__supTokenInflight = obtain()
      .then((t) => {
        globalThis.__supToken = t;
        return t;
      })
      .finally(() => {
        globalThis.__supTokenInflight = undefined;
      });
  }
  return globalThis.__supTokenInflight;
}

/** The Daml ledger user id: the JWT `sub` on DevNet. */
export async function ledgerUserId(): Promise<string> {
  return (await tokenState()).sub;
}

/**
 * Your party namespace on the shared node: the first segment of the Keycloak
 * user id plus "-". The Console prefixes every party you create with it.
 */
export async function partyNamespace(): Promise<string> {
  return `${(await ledgerUserId()).split("-")[0]}-`;
}
