"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, CircleAlert, X } from "lucide-react";
import { Spinner } from "../ui";
import { EmptyState, Field, Label, PageHeader, Panel, Pill, Skeleton } from "./kit";
import { useAct } from "./useAct";
import { useSupState } from "@/lib/sup/client";
import { useNow } from "@/lib/client/hooks";
import { countdown, shortId } from "@/lib/shared/format";
import type { ConditionRequestView } from "@/lib/sup/types";

/** Same derivation the server uses when it commits the hash: first 32 hex of SHA-256. */
async function refHash(ref: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ref.trim()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export function AgentConfirmations() {
  const { data: state } = useSupState("agent");
  const now = useNow(1000);
  const pending = state?.conditionRequests ?? [];
  const handled = [...(state?.conditionResults ?? [])].sort((a, b) => b.at - a.at);

  return (
    <>
      <PageHeader
        title="Confirmations"
        sub="A seller hands you a delivery reference. Check it against the ledger, then confirm or reject."
      />
      {!state ? (
        <Skeleton className="h-48" />
      ) : pending.length === 0 ? (
        <Panel>
          <EmptyState title="Nothing waiting for you" body="When a trade needs delivery confirmation, it appears here with the reference to check." />
        </Panel>
      ) : (
        <div className="space-y-4">
          {pending.map((r) => (
            <RequestCard key={r.cid} r={r} now={now} />
          ))}
        </div>
      )}

      {handled.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display mb-4 text-[20px] font-light tracking-tight">Handled</h2>
          <Panel>
            <ul>
              {handled.map((h) => (
                <li key={h.cid} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 last:border-0">
                  <div>
                    <div className="num text-[13.5px]">{h.escrowId}</div>
                    <div className="num mt-0.5 text-[11.5px] text-muted">
                      {shortId(h.documentHash, 8, 6)} · {new Date(h.at).toLocaleString()}
                    </div>
                  </div>
                  <Pill tone={h.approved ? "ok" : "bad"}>{h.approved ? "Confirmed" : "Rejected"}</Pill>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      )}
    </>
  );
}

function RequestCard({ r, now }: { r: ConditionRequestView; now: number }) {
  const { act, busy } = useAct("agent");
  const [ref, setRef] = useState("");
  const [checked, setChecked] = useState<{ ref: string; ok: boolean } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let live = true;
    if (ref.trim()) refHash(ref).then((h) => live && setChecked({ ref, ok: h === r.documentHash }));
    return () => {
      live = false;
    };
  }, [ref, r.documentHash]);
  // derived, so a stale result for an older input is never shown
  const match = ref.trim() && checked?.ref === ref ? checked.ok : null;

  return (
    <Panel glow>
      <div className="p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="num text-[16px] font-semibold">{r.escrowId}</div>
            <div className="mt-1 text-[13px] text-ink2">
              {r.seller.name} to {r.buyer.name}
            </div>
          </div>
          <span className="num text-[12px] text-muted">expires in {countdown(r.expiry - now)}</span>
        </div>

        <div className="mt-6">
          <Field
            label="Delivery reference you received"
            hint={
              <span className="num">
                The ledger holds only its fingerprint: {shortId(r.documentHash, 10, 6)}
              </span>
            }
          >
            <div className="relative">
              <input
                className={clsx("input num pr-10", match === true && "!border-ok", match === false && "!border-bad")}
                placeholder="Paste the reference from the seller"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
              />
              {match !== null && (
                <span className={clsx("absolute right-3 top-1/2 -translate-y-1/2", match ? "text-ok" : "text-bad")}>
                  {match ? <Check size={16} /> : <CircleAlert size={16} />}
                </span>
              )}
            </div>
          </Field>
          {match === false && <p className="mt-2 text-[12.5px] text-bad">That does not match the fingerprint on the ledger.</p>}
          {match === true && <p className="mt-2 text-[12.5px] text-ok">Matches. This is the reference the seller committed to.</p>}
        </div>

        {rejecting && (
          <div className="mt-5">
            <Label>Reason</Label>
            <input className="input mt-2" placeholder="Why are you rejecting this delivery?" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
          {!rejecting ? (
            <button className="btn num !px-5" onClick={() => setRejecting(true)} disabled={busy !== null}>
              <X size={14} /> Reject
            </button>
          ) : (
            <>
              <button className="btn num !px-5" onClick={() => setRejecting(false)}>
                Back
              </button>
              <button
                className="btn num !px-5"
                disabled={!reason.trim() || busy !== null}
                onClick={() => act("reject", { type: "reject", requestCid: r.cid, reason: reason.trim() })}
              >
                {busy === "reject" && <Spinner />} Confirm rejection
              </button>
            </>
          )}
          {!rejecting && (
            <button
              className="btn btn-primary num !px-6"
              disabled={match !== true || busy !== null}
              onClick={() => act("approve", { type: "approve", requestCid: r.cid, documentRef: ref.trim() })}
            >
              {busy === "approve" ? <Spinner /> : <Check size={14} />} Confirm delivery
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}
