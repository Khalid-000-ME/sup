import type { NextRequest } from "next/server";
import { buildSupTx } from "@/lib/sup/server";
import { isSupRole } from "@/lib/sup/personas";
import { handle } from "@/lib/server/http";
import { UserError } from "@/lib/server/errors";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const role = req.nextUrl.searchParams.get("as");
    const id = req.nextUrl.searchParams.get("id");
    if (!isSupRole(role)) throw new UserError("Unknown role");
    if (!id || !/^[0-9a-f]{20,}$/i.test(id)) throw new UserError("Invalid update id");
    return { tx: await buildSupTx(role, id) };
  });
}
