import type { NextRequest } from "next/server";
import { supActionSchema, runSupAction } from "@/lib/sup/server";
import { isSupRole } from "@/lib/sup/personas";
import { handle } from "@/lib/server/http";
import { UserError } from "@/lib/server/errors";
import { requireAccess } from "@/lib/server/access";

export async function POST(req: NextRequest) {
  return handle(async () => {
    requireAccess(req);
    const body = await req.json().catch(() => ({}));
    if (!isSupRole(body.as)) throw new UserError("Unknown role");
    const parsed = supActionSchema.safeParse(body.action);
    if (!parsed.success) throw new UserError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    return runSupAction(body.as, parsed.data);
  });
}
