"use client";

import { useMemo } from "react";
import { Glow } from "../ui/deco";
import { Label, Skeleton } from "./kit";
import { useStandardView, useSupState } from "@/lib/sup/client";
import type { SupRole } from "@/lib/sup/personas";
import { fmtAmount } from "@/lib/shared/format";

const NAME: Record<string, string> = { Amulet: "Canton Coin" };
const REAL_NOTE: Record<string, string> = { Amulet: "real DevNet coin", CBTC: "real BitSafe CBTC", cETH: "real onRails cETH" };
const REAL_ASSETS = new Set(["Amulet", "CashUSD", "CBTC", "cETH"]);

/**
 * Balances per instrument, read through the Canton Token Standard `Holding` interface only.
 * Sup's bonds, its cash token and real Canton Coin all appear in the same list because
 * they implement the same interface.
 */
export function Portfolio({ role }: { role: SupRole }) {
  const { data } = useStandardView(role);
  const { data: state } = useSupState(role);
  const known = useMemo(() => new Set(state?.bonds?.map((b) => b.symbol) ?? []), [state?.bonds]);

  const rows = useMemo(() => {
    const m = new Map<string, { id: string; free: number; locked: number; real: boolean }>();
    for (const h of data?.holdings ?? []) {
      // hide units of bonds that are not in the registry (leftovers from test runs)
      if (!known.has(h.instrumentId) && !REAL_ASSETS.has(h.instrumentId)) continue;
      const r = m.get(h.instrumentId) ?? { id: h.instrumentId, free: 0, locked: 0, real: !h.implementedBy.startsWith("Sup.") };
      if (h.locked) r.locked += h.amount;
      else r.free += h.amount;
      m.set(h.instrumentId, r);
    }
    return [...m.values()].sort((a, b) => Number(b.real) - Number(a.real) || b.free + b.locked - (a.free + a.locked));
  }, [data, known]);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[20px] font-light tracking-tight">Portfolio</h2>
        <span className="num text-[11px] text-muted">read through the Canton Token Standard</span>
      </div>
      {!data ? (
        <Skeleton className="h-24" />
      ) : rows.length === 0 ? (
        <div className="border border-line bg-s1 px-5 py-6 text-[13.5px] text-ink2">No holdings yet.</div>
      ) : (
        <div className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {rows.slice(0, 8).map((r) => (
            <div key={r.id} className="group relative overflow-hidden border-b border-r border-line bg-bg px-5 py-4">
              <Glow className="inset-x-0 bottom-[-6rem] h-[10rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100" intensity={0.3} />
              <div className="relative">
                <Label>{NAME[r.id] ?? r.id}</Label>
                <div className="num mt-2 text-[22px] font-medium leading-none">{fmtAmount(r.free)}</div>
                <div className="num mt-1.5 text-[11.5px] text-muted">
                  {r.locked > 0 ? `${fmtAmount(r.locked)} in escrow` : r.real ? (REAL_NOTE[r.id] ?? "real token") : "test asset"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
