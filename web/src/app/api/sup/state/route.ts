import type { NextRequest } from "next/server";
import { getSupState, getDocRef } from "@/lib/sup/server";
import { listBonds, onboardedAt } from "@/lib/sup/store";
import { isSupRole } from "@/lib/sup/personas";
import { handle } from "@/lib/server/http";
import { UserError } from "@/lib/server/errors";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const role = req.nextUrl.searchParams.get("as");
    if (!isSupRole(role)) throw new UserError("Unknown role");
    const state = await getSupState(role);
    // The original delivery reference is only ever shown to the seller who set it.
    const docRefs: Record<string, string> = {};
    if (role === "seller") {
      for (const e of [...state.proposals, ...state.escrows]) {
        const ref = getDocRef(e.escrowId);
        if (ref) docRefs[e.escrowId] = ref;
      }
    }
    return { ...state, docRefs, bonds: listBonds(), onboardedAt: onboardedAt(role) ?? null };
  });
}
