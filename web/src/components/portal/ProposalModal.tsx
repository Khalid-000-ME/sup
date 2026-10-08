"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Spinner } from "../ui";
import { Field, Modal, Pill, Segmented, Toggle } from "./kit";
import { useAct } from "./useAct";
import { useSupState } from "@/lib/sup/client";
import { fmt } from "@/lib/shared/format";
import { unitFmt } from "@/lib/sup/portal";

const PAY_LABEL = { test: "CashUSD", amulet: "CC", cbtc: "CBTC", ceth: "cETH" } as const;

const EXPIRY = [
  { value: "1800", label: "30 min" },
  { value: "3600", label: "1 hour" },
  { value: "86400", label: "24 hours" },
] as const;

export function ProposalModal({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: (escrowId: string) => void;
}) {
  const { data: state } = useSupState("seller");
  const { act, busy } = useAct("seller");
  const bonds = useMemo(() => state?.bonds ?? [], [state?.bonds]);
  const devnet = state?.ledger.network === "devnet";

  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("50");
  const [amount, setAmount] = useState("");
  const [pay, setPay] = useState<"test" | "amulet" | "cbtc" | "ceth">("test");
  const [expiry, setExpiry] = useState<(typeof EXPIRY)[number]["value"]>("3600");
  const [agent, setAgent] = useState(false);
  const [ref, setRef] = useState("");

  const sym = symbol || bonds[0]?.symbol || "";
  const bond = bonds.find((b) => b.symbol === sym);
  const held = state?.assets.filter((a) => a.label === sym).reduce((s, a) => s + a.quantity, 0) ?? 0;
  const q = Number(qty);
  const short = q > held;

  // until the seller types a price, suggest face value for the chosen quantity
  const amountVal = amount !== "" ? amount : bond && pay === "test" ? String(Math.round(bond.faceValue * (Number(qty) || 1))) : "";
  const a = Number(amountVal);

  const valid = bond && q > 0 && a > 0 && !short;

  async function submit() {
    if (!valid) return;
    const r = await act(
      "propose",
      {
        type: "propose",
        buyer: "buyer",
        assetClass: sym,
        assetQuantity: q,
        cashAmount: a,
        payment: pay,
        withAgent: agent,
        documentRef: agent && ref.trim() ? ref.trim() : undefined,
        withAuditor: false,
        expirySecs: Number(expiry),
      },
      { quiet: false },
    );
    if (r) {
      onSent((r.data as { escrowId: string }).escrowId);
      onClose();
      setAmount("");
      setRef("");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New proposal" width={540}>
      <div className="space-y-5">
        <Field
          label="Bond"
          hint={
            <span className="num">
              You hold {fmt(held, 0)} {sym}
              {short && (
                <>
                  {" "}
                  ·{" "}
                  <button
                    className="text-accent hover:underline"
                    disabled={busy !== null}
                    onClick={() => act("issue", { type: "faucet", asset: "asset", amount: Math.max(q - held, 1), assetClass: sym })}
                  >
                    {busy === "issue" ? "Issuing…" : `Issue ${fmt(Math.max(q - held, 1), 0)} more`}
                  </button>
                </>
              )}
            </span>
          }
        >
          <select className="input num" value={sym} onChange={(e) => (setSymbol(e.target.value), setAmount(""))}>
            {bonds.map((b) => (
              <option key={b.symbol} value={b.symbol}>
                {b.symbol} · {b.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Units">
            <input className="input num" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))} />
          </Field>
          <Field label={`Total price (${PAY_LABEL[pay]})`}>
            <input className="input num" inputMode="decimal" value={amountVal} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            size="sm"
            value={pay}
            onChange={setPay}
            options={[
              { value: "test" as const, label: "CashUSD" },
              ...(devnet
                ? [
                    { value: "amulet" as const, label: "Canton Coin" },
                    { value: "cbtc" as const, label: "CBTC" },
                  ]
                : []),
            ]}
          />
          <span className="num text-[12px] text-muted">{valid ? `${unitFmt(a / q)} per unit` : "Set a price"}</span>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <Field label="Offer to">
            <div className="input flex items-center">
              <span className="num text-[13px]">Buyer</span>
            </div>
          </Field>
          <Segmented size="sm" value={expiry} onChange={setExpiry} options={EXPIRY.map((e) => ({ value: e.value, label: e.label }))} />
        </div>

        <Toggle
          checked={agent}
          onChange={setAgent}
          title="Have an agent confirm delivery"
          body="An independent check before cash moves. The agent sees a reference and the two names, never the terms."
        />
        {agent && (
          <Field label="Delivery reference" hint="For example a custody receipt number. You pass this to the agent yourself. Left blank, one is generated.">
            <input className="input num" value={ref} placeholder="CUSTODY-7741" onChange={(e) => setRef(e.target.value)} />
          </Field>
        )}
      </div>

      <div className="mt-7 flex items-center justify-between gap-3">
        <Pill>{bond ? `${bond.couponPct}% · ${bond.maturity}` : "No bond"}</Pill>
        <button className="btn btn-primary num !px-6" disabled={!valid || busy !== null} onClick={submit}>
          {busy === "propose" ? <Spinner /> : <Send size={14} />} Send offer
        </button>
      </div>
    </Modal>
  );
}
