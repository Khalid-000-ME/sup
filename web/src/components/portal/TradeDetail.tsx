"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import clsx from "clsx";
import { ArrowLeft, Check, CircleAlert, ScanSearch, ShieldCheck } from "lucide-react";
import { Spinner } from "../ui";
import { CopyText, EmptyState, Label, Panel, Pill, Skeleton } from "./kit";
import { useAct } from "./useAct";
import { useUi } from "../Providers";
import { buildTrades, useSupState } from "@/lib/sup/client";
import { toRows, unitFmt } from "@/lib/sup/portal";
import { useNow } from "@/lib/client/hooks";
import { countdown, fmtAmount, shortId } from "@/lib/shared/format";
import type { TradeEvent } from "@/lib/sup/store";
import type { TxView } from "@/lib/shared/types";

const getJson = async (u: string) => {
  const r = await fetch(u, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Request failed");
  return j;
};

export function TradeDetail({ role, id }: { role: "seller" | "buyer"; id: string }) {
  const { data: state } = useSupState(role);
  const { act, busy } = useAct(role);
  const now = useNow(1000);
  const { data: ev } = useSWR<{ events: TradeEvent[] }>(`/api/sup/events?as=${role}&id=${id}`, getJson, { refreshInterval: 3000 });

  const row = useMemo(() => {
    if (!state) return undefined;
    return toRows(buildTrades(state, now), role).find((r) => r.id === id);
  }, [state, now, role, id]);

  const back = role === "seller" ? "/seller" : "/buyer/trades";

  if (!state) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!row) {
    return (
      <>
        <BackLink href={back} />
        <Panel>
          <EmptyState title="Trade not found" body="It may belong to another party, or it is no longer visible to you." action={<Link className="btn num !px-5" href={back}>Back to trades</Link>} />
        </Panel>
      </>
    );
  }

  const t = row.trade;
  const expiry = t.escrow?.expiry ?? t.proposal?.expiry;
  const docRef = state.docRefs?.[id];
  const needs = t.needsCondition;
  const cancelCid = t.escrow?.cid;

  return (
    <>
      <BackLink href={back} />

      <Panel glow className="mb-6">
        <div className="p-7 md:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Label>{role === "seller" ? "Selling" : "Buying"}</Label>
              <h1 className="num mt-3 text-[30px] font-medium leading-none tracking-tight md:text-[38px]">
                {fmtAmount(row.qty)} <span className="text-ink2">{row.bond}</span>
              </h1>
              <div className="num mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                <CopyText text={id} />
                <span>·</span>
                <span>
                  {role === "seller" ? "to" : "from"} {row.counterparty.name}
                </span>
                {expiry && !row.done && (
                  <>
                    <span>·</span>
                    <span>expires {countdown(expiry - now)}</span>
                  </>
                )}
              </div>
            </div>
            <Pill tone={row.tone}>{row.status}</Pill>
          </div>

          <div className="num mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-[12px] border border-line bg-line">
            {[
              { l: role === "seller" ? "You receive" : "You pay", v: fmtAmount(row.amount), s: row.ccy },
              { l: "Per unit", v: unitFmt(row.unit), s: row.ccy },
              { l: "Quantity", v: fmtAmount(row.qty), s: row.bond },
            ].map((x) => (
              <div key={x.l} className="bg-bg px-5 py-4">
                <Label>{x.l}</Label>
                <div className="mt-2 text-[20px] font-medium">{x.v}</div>
                <div className="mt-0.5 text-[11.5px] text-muted">{x.s}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Progress row={row} needs={needs} />

      <NextStep row={row} role={role} busy={busy} onAct={(k, a) => act(k, a)} cancel={cancelCid && !row.done ? () => act("cancel", { type: "cancel", escrowCid: cancelCid }) : undefined} />

      {needs && (
        <Panel className="mt-6">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-medium">Delivery confirmation</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-ink2">
                  {t.condition
                    ? t.condition.approved
                      ? "The agent confirmed the delivery reference."
                      : `The agent rejected it: ${t.condition.reason ?? "no reason given"}.`
                    : "The agent has to confirm the delivery reference before cash can move. It sees that reference and the two names, nothing else."}
                </p>
                {role === "seller" && docRef && !row.done && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-bg px-4 py-3">
                    <Label>Reference to give your agent</Label>
                    <CopyText text={docRef} className="text-[14px] font-semibold text-ink" />
                  </div>
                )}
              </div>
              {t.condition && <Pill tone={t.condition.approved ? "ok" : "bad"}>{t.condition.approved ? "Confirmed" : "Rejected"}</Pill>}
            </div>
          </div>
        </Panel>
      )}

      <Proof role={role} events={ev?.events} settled={t.stage === "settled"} receiptOutcome={t.receipt?.outcome} />
    </>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="num mb-6 inline-flex items-center gap-1.5 text-[12.5px] text-muted transition-colors hover:text-ink">
      <ArrowLeft size={14} /> Trades
    </Link>
  );
}

/* ------------------------------------------------------------- progress */

function Progress({ row, needs }: { row: ReturnType<typeof toRows>[number]; needs: boolean }) {
  const t = row.trade;
  const settled = t.stage === "settled";
  const steps = [
    { label: "Offer", done: Boolean(t.escrow || t.receipt) },
    { label: "Payment locked", done: Boolean(t.paymentLock) || settled },
    { label: "Bond locked", done: Boolean(t.assetLock) || settled },
    ...(needs ? [{ label: "Confirmed", done: Boolean(t.condition?.approved) || settled }] : []),
    { label: settled ? "Settled" : t.stage === "cancelled" ? "Cancelled" : t.stage === "expired" ? "Expired" : "Settlement", done: settled },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="grid gap-px overflow-hidden rounded-[14px] border border-line bg-line" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}>
      {steps.map((s, i) => (
        <li key={s.label} className={clsx("relative bg-bg px-4 py-4", i === current && !row.done && "bg-s1")}>
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                s.done ? "bg-[color-mix(in_srgb,var(--ok)_20%,transparent)] text-ok" : i === current && !row.done ? "bg-accent text-bg" : "border border-line-strong text-muted",
              )}
            >
              {s.done ? <Check size={11} /> : <span className="num">{i + 1}</span>}
            </span>
            <span className={clsx("num truncate text-[11.5px]", s.done || i === current ? "text-ink" : "text-muted")}>{s.label}</span>
          </div>
          {i === current && !row.done && <span className="absolute inset-x-0 bottom-0 h-px bg-accent" />}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------ next step */

function NextStep({
  row,
  role,
  busy,
  onAct,
  cancel,
}: {
  row: ReturnType<typeof toRows>[number];
  role: "seller" | "buyer";
  busy: string | null;
  onAct: (key: string, a: NonNullable<ReturnType<typeof toRows>[number]["next"]>["action"]) => void;
  cancel?: () => void;
}) {
  const waiting: Record<string, string> = {
    proposed: role === "seller" ? "Waiting for the buyer to take the offer." : "",
    paymentLocked: role === "buyer" ? "Your payment is locked. Waiting for the seller to deliver the bond." : "",
    assetLocked: role === "seller" ? "Your bond is locked. Waiting for the buyer's payment." : "",
    bothLocked: "Both sides are locked. Waiting for the agent to confirm delivery. The trade settles on its own once they do.",
    settled: "Done. The bond and the payment changed hands in one transaction.",
    cancelled: "This trade was cancelled and any locked assets were returned.",
    expired: "This trade expired before settling.",
  };
  const text = row.next ? null : waiting[row.trade.stage];
  if (!row.next && !text) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-line-strong bg-s1 px-6 py-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className={clsx("h-2 w-2 shrink-0 rounded-full", row.next ? "bg-accent" : row.done ? "bg-ok" : "bg-warn blink")} />
        <span className="text-[14.5px]">{row.next ? `Next: ${row.next.label.toLowerCase()}` : text}</span>
      </div>
      <div className="flex items-center gap-4">
        {cancel && (
          <button className="num text-[12px] text-muted transition-colors hover:text-bad" onClick={cancel} disabled={busy !== null}>
            Cancel trade
          </button>
        )}
        {row.next && (
          <button
            className={clsx("btn num !px-6", row.next.primary && "btn-primary")}
            disabled={busy !== null}
            onClick={() => onAct("next", row.next!.action)}
          >
            {busy === "next" && <Spinner />} {row.next.label}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- proof */

function Proof({
  role,
  events,
  settled,
  receiptOutcome,
}: {
  role: "seller" | "buyer";
  events?: TradeEvent[];
  settled: boolean;
  receiptOutcome?: string;
}) {
  const { openTx } = useUi();
  const [checks, setChecks] = useState<Record<string, "busy" | "ok" | "no" | "err">>({});
  const [info, setInfo] = useState<Record<string, TxView>>({});

  async function verify(updateId: string) {
    setChecks((c) => ({ ...c, [updateId]: "busy" }));
    try {
      const j = await getJson(`/api/sup/tx?as=${role}&id=${updateId}`);
      if (j.tx) {
        setInfo((i) => ({ ...i, [updateId]: j.tx as TxView }));
        setChecks((c) => ({ ...c, [updateId]: "ok" }));
      } else setChecks((c) => ({ ...c, [updateId]: "no" }));
    } catch {
      setChecks((c) => ({ ...c, [updateId]: "err" }));
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[22px] font-light tracking-tight">Proof on the ledger</h2>
          <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-muted">
            Each step is a separate Canton transaction. Verify reads it back from the node as you. Sup trades are private to their
            parties, so a public block explorer cannot show them, and that is the point.
          </p>
        </div>
      </div>
      <Panel>
        {!events ? (
          <div className="p-5">
            <Skeleton className="h-12" />
          </div>
        ) : events.length === 0 ? (
          <div className="px-6 py-8 text-[13.5px] text-ink2">
            {settled || receiptOutcome
              ? "This trade was settled before transaction logging was added. The receipt on your ledger view is its record."
              : "Transactions appear here as each step happens."}
          </div>
        ) : (
          <ul>
            {events.map((e) => {
              const st = checks[e.updateId];
              const tx = info[e.updateId];
              return (
                <li key={e.updateId} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-4 last:border-0">
                  <div className="w-40 shrink-0">
                    <div className="text-[14px]">{e.label}</div>
                    <div className="num mt-0.5 text-[11.5px] text-muted">{new Date(e.at).toLocaleTimeString()}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <CopyText text={e.updateId} shown={shortId(e.updateId, 12, 10)} className="text-[12px] text-ink2" />
                    <div className="num mt-0.5 text-[11.5px] text-muted">
                      {st === "ok" && tx ? (
                        <span className="text-ok">
                          Confirmed at offset {tx.offset} · {tx.eventCount} {tx.eventCount === 1 ? "event" : "events"} visible to you
                        </span>
                      ) : st === "no" ? (
                        <span className="text-warn">Not visible to you</span>
                      ) : st === "err" ? (
                        <span className="text-bad">Could not reach the node</span>
                      ) : e.offset ? (
                        `offset ${e.offset}`
                      ) : (
                        " "
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button className="btn btn-sm num" disabled={st === "busy"} onClick={() => verify(e.updateId)}>
                      {st === "busy" ? <Spinner /> : st === "ok" ? <Check size={13} className="text-ok" /> : st === "err" ? <CircleAlert size={13} /> : <ShieldCheck size={13} />}{" "}
                      Verify
                    </button>
                    <button className="btn btn-sm num" onClick={() => openTx(e.updateId, role)}>
                      <ScanSearch size={13} /> Inspect
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </section>
  );
}
