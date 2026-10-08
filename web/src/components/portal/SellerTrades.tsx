"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Panel, PageHeader, Segmented, Skeleton, StatRow, Stat, EmptyState } from "./kit";
import { TradeListItem } from "./TradeList";
import { ProposalModal } from "./ProposalModal";
import { Portfolio } from "./Portfolio";
import { PriceBoard } from "./PriceBoard";
import { useAct } from "./useAct";
import { buildTrades, useSupState } from "@/lib/sup/client";
import { toRows } from "@/lib/sup/portal";
import { useNow } from "@/lib/client/hooks";
import { fmt } from "@/lib/shared/format";

export function SellerTrades() {
  const { data: state } = useSupState("seller");
  const { act, busy } = useAct("seller");
  const now = useNow(2000);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"active" | "done">("active");
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 12000);
    return () => clearTimeout(t);
  }, [fresh]);

  const rows = useMemo(() => (state ? toRows(buildTrades(state, now), "seller") : []), [state, now]);
  const active = rows.filter((r) => !r.done);
  const done = rows.filter((r) => r.done);
  const shown = (tab === "active" ? active : done).sort((a, b) => (a.id === fresh ? -1 : b.id === fresh ? 1 : b.at - a.at));

  const needs = active.filter((r) => r.next?.primary).length;
  const settled = rows.filter((r) => r.trade.stage === "settled");
  const vol = settled.filter((r) => r.ccy !== "CC").reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <PageHeader
        title="Trades"
        sub="Everything you have offered, and what needs you next."
        actions={
          <button className="btn btn-primary num !px-5" onClick={() => setOpen(true)}>
            <Plus size={15} /> New proposal
          </button>
        }
      />

      <StatRow>
        <Stat label="Open offers" value={active.filter((r) => r.trade.stage === "proposed").length} />
        <Stat label="Needs you" value={needs} tone={needs ? "warn" : undefined} sub={needs ? "action waiting" : "all clear"} />
        <Stat label="Settled" value={settled.length} />
        <Stat label="Volume" value={fmt(vol, 0)} sub="CashUSD settled" />
      </StatRow>

      <div className="mt-9">
        <PriceBoard />
        <Portfolio role="seller" />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: `Active ${active.length}` },
            { value: "done", label: `Completed ${done.length}` },
          ]}
        />
      </div>

      <Panel>
        {!state ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            title={tab === "active" ? "No active trades" : "Nothing completed yet"}
            body={tab === "active" ? "Send your first offer and it appears here the moment it is on the ledger." : "Settled and cancelled trades collect here."}
            action={
              tab === "active" ? (
                <button className="btn btn-primary num !px-5" onClick={() => setOpen(true)}>
                  <Plus size={15} /> New proposal
                </button>
              ) : (
                <button className="btn num !px-5" onClick={() => setTab("active")}>
                  Back to active
                </button>
              )
            }
          />
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {shown.map((r) => (
                <TradeListItem
                  key={r.id}
                  row={r}
                  base="/seller/trades"
                  busy={busy}
                  highlight={r.id === fresh}
                  onAct={(k, a) => act(k, a)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Panel>

      <ProposalModal
        open={open}
        onClose={() => setOpen(false)}
        onSent={(id) => {
          setTab("active");
          setFresh(id);
        }}
      />
    </>
  );
}
