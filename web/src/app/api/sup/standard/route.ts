import type { NextRequest } from "next/server";
import { getStandardView } from "@/lib/sup/server";
import { isSupRole } from "@/lib/sup/personas";
import { handle } from "@/lib/server/http";
import { UserError } from "@/lib/server/errors";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const role = req.nextUrl.searchParams.get("as");
    if (!isSupRole(role)) throw new UserError("Unknown role");
    return getStandardView(role);
  });
}
