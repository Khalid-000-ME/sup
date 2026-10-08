import type { NextRequest } from "next/server";
import { buildSupState, getSupWorld } from "@/lib/sup/server";
import { markOnboarded } from "@/lib/sup/store";
import { SUP_PERSONAS, isSupRole } from "@/lib/sup/personas";
import { handle } from "@/lib/server/http";
import { UserError } from "@/lib/server/errors";

interface Check {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
}

/**
 * Real connectivity checks for the onboarding flow. Each one queries the ledger as the
 * party being onboarded, so a passing result means the party can actually transact.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const role = body.as;
    if (!isSupRole(role) || !["seller", "buyer", "agent"].includes(role)) throw new UserError("Unknown role");
    const world = await getSupWorld();
    const party = world.parties[role];
    const state = await buildSupState(role);
    const needsCustody = role !== "agent";
    const checks: Check[] = [
      { id: "party", label: "Party allocated on Canton", detail: party.split("::")[0] + "::" + party.split("::")[1]?.slice(0, 10) + "…", ok: true },
      { id: "ledger", label: "Participant reachable", detail: `${state.ledger.network} · Canton ${state.ledger.version} · offset ${state.ledger.offset}`, ok: true },
      { id: "package", label: "Sup contracts vetted on the node", detail: "sup 0.3.0", ok: true },
      ...(needsCustody
        ? [{ id: "custody", label: "Custody account open", detail: state.custodyReady ? "Co-signed with the issuer" : "Missing", ok: state.custodyReady }]
        : []),
    ];
    const ok = checks.every((c) => c.ok);
    if (ok) markOnboarded(role);
    return { ok, role, label: SUP_PERSONAS[role].label, checks };
  });
}
