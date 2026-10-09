"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { EmptyState, PageHeader, Panel, Segmented, Skeleton } from "./kit";
import { TradeListItem } from "./TradeList";
import { useAct } from "./useAct";
import { buildTrades, useSupState } from "@/lib/sup/client";
import { toRows } from "@/lib/sup/portal";
import { useNow } from "@/lib/client/hooks";
import Link from "next/link";

export function BuyerTrades() {
  const { data: state } = useSupState("buyer");
  const { act, busy } = useAct("buyer");
  const now = useNow(2000);
  const [tab, setTab] = useState<"all" | "active" | "done">("all");

  const rows = useMemo(
    () => (state ? toRows(buildTrades(state, now), "buyer").filter((r) => r.trade.stage !== "proposed") : []),
    [state, now],
  );
  const shown = rows.filter((r) => (tab === "all" ? true : tab === "active" ? !r.done : r.done)).sort((a, b) => b.at - a.at);

  return (
    <>
      <PageHeader
        title="My trades"
        sub="Everything you have bought. Select a trade for its full details and proof."
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "all", label: `All ${rows.length}` },
              { value: "active", label: `Active ${rows.filter((r) => !r.done).length}` },
              { value: "done", label: `Done ${rows.filter((r) => r.done).length}` },
            ]}
          />
        }
      />
      <Panel>
        {!state ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            title="No trades yet"
            body="Buy an offer from the market and it shows up here."
            action={
              <Link href="/buyer" className="btn btn-primary num !px-5">
                Open the market
              </Link>
            }
          />
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {shown.map((r) => (
                <TradeListItem key={r.id} row={r} base="/buyer/trades" busy={busy} onAct={(k, a) => act(k, a)} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Panel>
    </>
  );
}
