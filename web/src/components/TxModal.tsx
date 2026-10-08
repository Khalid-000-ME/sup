"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EyeOff, X } from "lucide-react";
import clsx from "clsx";
import type { TxEvent, TxView } from "@/lib/shared/types";
import { shortId } from "@/lib/shared/format";

function summarizePayload(p?: Record<string, unknown>): string {
  if (!p) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "string" && v.includes("::")) parts.push(`${k}=${v.split("::")[0]}`);
    else if (typeof v === "string" && v.length > 30) parts.push(`${k}=${v.slice(0, 10)}…`);
    else if (typeof v === "object" && v !== null) continue;
    else parts.push(`${k}=${String(v)}`);
  }
  return parts.slice(0, 9).join("  ");
}

function EventRow({ e }: { e: TxEvent }) {
  const tone = e.kind === "created" ? "text-ok" : e.kind === "archived" ? "text-bad" : "text-veil";
  const sign = e.kind === "created" ? "＋" : e.kind === "archived" ? "－" : "ƒ";
  return (
    <div style={{ paddingLeft: e.depth * 18 }} className="border-l border-line py-1.5 pl-3">
      <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[12px]">
        <span className={clsx("font-bold", tone)}>{sign}</span>
        {e.kind === "exercised" ? (
          <>
            <span className="text-ink">
              {e.template}.<b>{e.choice}</b>
            </span>
            <span className="text-muted">{e.consuming ? "consuming" : "non-consuming"}</span>
            {e.actingParties && <span className="text-ink2">by {e.actingParties.map((a) => a.name).join(", ")}</span>}
          </>
        ) : (
          <span className="text-ink">
            {e.kind === "created" ? "create" : "archive"} <b>{e.template}</b>
          </span>
        )}
        <span className="text-muted">{shortId(e.contractId, 6, 4)}</span>
      </div>
      {e.signatories && (
        <div className="mt-0.5 text-[11px] text-muted">
          signatories: {e.signatories.map((s) => s.name).join(", ")}
          {e.observers && e.observers.length > 0 && <> · observers: {e.observers.map((s) => s.name).join(", ")}</>}
        </div>
      )}
      {e.payload && <div className="mt-0.5 break-words font-mono text-[11px] text-muted">{summarizePayload(e.payload)}</div>}
    </div>
  );
}

export function TxModal({
  tx,
  labelOf,
  endpoint,
  onClose,
}: {
  tx: { id: string; viewer: string } | null;
  /** Display name for the party the transaction is read as. */
  labelOf: (viewer: string) => string;
  /** API route that returns `{ tx }` for `?as=<viewer>&id=<updateId>`. */
  endpoint: string;
  onClose: () => void;
}) {
  const [res, setRes] = useState<{ key: string; data?: TxView | null; error?: string } | null>(null);
  const key = tx ? `${tx.viewer}:${tx.id}` : "";

  useEffect(() => {
    if (!tx) return;
    let cancelled = false;
    const k = `${tx.viewer}:${tx.id}`;
    fetch(`${endpoint}?as=${tx.viewer}&id=${tx.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setRes(j.ok === false ? { key: k, error: j.error } : { key: k, data: j.tx });
      })
      .catch((e) => !cancelled && setRes({ key: k, error: String(e) }));
    return () => {
      cancelled = true;
    };
  }, [tx, endpoint]);

  const viewerLabel = tx ? labelOf(tx.viewer) : "This party";
  const fresh = res?.key === key ? res : null;
  const data = fresh ? fresh.data : undefined;
  const error = fresh?.error ?? null;

  return (
    <AnimatePresence>
      {tx && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
            className="card flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line p-4">
              <div>
                <div className="eyebrow">Canton transaction</div>
                <div className="mt-1 break-all font-mono text-xs text-ink2">{tx.id}</div>
                {data && (
                  <div className="mt-1 text-xs text-muted">
                    ledger offset {data.offset} · {new Date(data.effectiveAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
              <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="scroll-thin min-h-[160px] flex-1 overflow-auto p-4">
              {error && <div className="text-sm text-bad">{error}</div>}
              {data === undefined && !error && <div className="text-sm text-muted">Loading from the ledger…</div>}
              {data === null && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <EyeOff className="text-muted" />
                  <div className="text-sm font-semibold text-ink">{viewerLabel} cannot see this transaction</div>
                  <div className="max-w-sm text-xs text-muted">
                    Canton only delivers a transaction to the parties that are stakeholders or witnesses of its contracts. To this party, it does not exist.
                  </div>
                </div>
              )}
              {data && (
                <div className="space-y-0.5">
                  <div className="mb-2 text-xs text-muted">
                    {data.eventCount} event{data.eventCount === 1 ? "" : "s"} visible to {viewerLabel}
                  </div>
                  {data.events.map((e, i) => (
                    <EventRow key={i} e={e} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
