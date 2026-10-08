import type { NextRequest } from "next/server";
import { getSupState } from "@/lib/sup/server";
import { eventsFor } from "@/lib/sup/store";
import { isSupRole } from "@/lib/sup/personas";
import { handle } from "@/lib/server/http";
import { UserError } from "@/lib/server/errors";

/** Transactions this server submitted for a trade, only for a party that can see the trade. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const role = req.nextUrl.searchParams.get("as");
    const id = req.nextUrl.searchParams.get("id");
    if (!isSupRole(role)) throw new UserError("Unknown role");
    if (!id || !/^TRADE-[0-9A-F]+$/.test(id)) throw new UserError("Invalid trade id");
    const s = await getSupState(role);
    const visible = [s.proposals, s.escrows, s.locks, s.conditionRequests, s.conditionResults, s.receipts].some((xs) =>
      xs.some((x) => x.escrowId === id),
    );
    return { events: visible ? eventsFor(id) : [] };
  });
}
