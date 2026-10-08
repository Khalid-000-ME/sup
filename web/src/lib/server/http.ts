import { NextResponse } from "next/server";
import { UserError } from "./errors";
import { AccessError } from "./access";
import { SupError } from "../sup/server";
import { AmuletError } from "../sup/amulet";
import { LedgerError } from "./ledger";

export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const err = e as Error;
    if (e instanceof AccessError) return NextResponse.json({ ok: false, error: err.message, access: true }, { status: 401 });
    if (e instanceof UserError || e instanceof SupError || e instanceof AmuletError)
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    if (e instanceof LedgerError) {
      const status = e.status === 503 ? 503 : e.status >= 500 ? 502 : 400;
      return NextResponse.json({ ok: false, error: err.message, ledger: true }, { status });
    }
    console.error(e);
    return NextResponse.json({ ok: false, error: err.message || "Unexpected error" }, { status: 500 });
  }
}
