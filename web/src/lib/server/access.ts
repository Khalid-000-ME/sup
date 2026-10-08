import { timingSafeEqual } from "node:crypto";
import { UserError } from "./errors";

/**
 * Optional write protection for a public deployment. With SUP_ACCESS_CODE unset (local
 * development) everything is open. With it set, anyone can browse, but every action that
 * changes the ledger needs the code, sent in the `x-sup-access` header.
 */
export class AccessError extends UserError {}

export function requireAccess(req: Request) {
  const code = process.env.SUP_ACCESS_CODE;
  if (!code) return;
  const given = Buffer.from(req.headers.get("x-sup-access") ?? "");
  const want = Buffer.from(code);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    throw new AccessError("This deployment needs an access code to make changes.");
  }
}
