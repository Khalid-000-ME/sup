"use client";

import { useMemo, useState } from "react";
import { Coins, Plus } from "lucide-react";
import { Spinner } from "../ui";
import { Glow } from "../ui/deco";
import { Field, Label, Modal, PageHeader, Skeleton } from "./kit";
import { useAct } from "./useAct";
import { useSupState } from "@/lib/sup/client";
import { fmt } from "@/lib/shared/format";
import type { BondMeta } from "@/lib/sup/types";

export function SellerBonds() {
  const { data: state } = useSupState("seller");
  const [create, setCreate] = useState(false);
  const [issue, setIssue] = useState<BondMeta | null>(null);

  const held = useMemo(() => {
    const m: Record<string, number> = {};
    state?.assets.forEach((a) => (m[a.label] = (m[a.label] ?? 0) + a.quantity));
    return m;
  }, [state]);
  const locked = useMemo(() => {
    const m: Record<string, number> = {};
    state?.locks.filter((l) => l.kind === "asset").forEach((l) => (m[l.label] = (m[l.label] ?? 0) + l.quantity));
    return m;
  }, [state]);

  return (
    <>
      <PageHeader
        title="Bonds"
        sub="Define the bonds you sell, then issue units to your account."
        actions={
          <button className="btn btn-primary num !px-5" onClick={() => setCreate(true)}>
            <Plus size={15} /> Create bond
          </button>
        }
      />
      {!state ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {state.bonds?.map((b) => (
            <div
              key={b.symbol}
              className="group relative flex flex-col overflow-hidden rounded-[16px] border border-line bg-s1 p-6 transition-colors hover:border-line-strong"
            >
              <Glow
                className="inset-x-0 bottom-[-9rem] h-[16rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                intensity={0.3}
              />
              <div className="relative flex flex-1 flex-col">
                <Label>{b.symbol}</Label>
                <h3 className="font-display mt-3 text-[21px] font-light leading-snug tracking-tight">{b.name}</h3>
                <p className="mt-2 min-h-[2.5rem] text-[13px] leading-snug text-muted">{b.description}</p>
                <dl className="num mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[12px]">
                  <div>
                    <dt className="text-muted">Coupon</dt>
                    <dd className="mt-1 text-[14px]">{b.couponPct}%</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Matures</dt>
                    <dd className="mt-1 text-[14px]">{b.maturity.slice(0, 7)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Face</dt>
                    <dd className="mt-1 text-[14px]">{fmt(b.faceValue, 0)}</dd>
                  </div>
                </dl>
                <div className="num mt-5 flex items-end justify-between border-t border-line pt-4">
                  <div>
                    <div className="text-[22px] font-medium leading-none">{fmt(held[b.symbol] ?? 0, 0)}</div>
                    <div className="mt-1.5 text-[11.5px] text-muted">
                      held{(locked[b.symbol] ?? 0) > 0 && ` · ${fmt(locked[b.symbol], 0)} in escrow`}
                    </div>
                  </div>
                  <button className="btn btn-sm num" onClick={() => setIssue(b)}>
                    <Coins size={13} /> Issue units
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => setCreate(true)}
            className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-line-strong text-ink2 transition-colors hover:border-accent hover:text-ink"
          >
            <Plus size={20} />
            <span className="num text-[13px]">Create a bond</span>
          </button>
        </div>
      )}
      <CreateBond open={create} onClose={() => setCreate(false)} />
      <IssueUnits bond={issue} onClose={() => setIssue(null)} />
    </>
  );
}

function CreateBond({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { act, busy } = useAct("seller");
  const [f, setF] = useState({ symbol: "", name: "", face: "1000", coupon: "4", maturity: "", desc: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const valid = /^[A-Z0-9][A-Z0-9-]{2,19}$/.test(f.symbol) && f.name.length >= 2 && Number(f.face) > 0 && f.maturity;

  return (
    <Modal open={open} onClose={onClose} title="Create a bond" width={520}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Symbol" hint="Capitals, digits, dashes">
            <input
              className="input num"
              placeholder="TBILL-2027"
              value={f.symbol}
              onChange={(e) => setF((s) => ({ ...s, symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") }))}
            />
          </Field>
          <Field label="Name">
            <input className="input" placeholder="Treasury Bill 2027" value={f.name} onChange={set("name")} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Face value">
            <input className="input num" inputMode="decimal" value={f.face} onChange={set("face")} />
          </Field>
          <Field label="Coupon %">
            <input className="input num" inputMode="decimal" value={f.coupon} onChange={set("coupon")} />
          </Field>
          <Field label="Maturity">
            <input className="input num" type="date" value={f.maturity} onChange={set("maturity")} />
          </Field>
        </div>
        <Field label="Description">
          <input className="input" maxLength={200} placeholder="One line buyers will see" value={f.desc} onChange={set("desc")} />
        </Field>
      </div>
      <div className="mt-7 flex justify-end">
        <button
          className="btn btn-primary num !px-6"
          disabled={!valid || busy !== null}
          onClick={async () => {
            const r = await act("create", {
              type: "createBond",
              symbol: f.symbol,
              name: f.name,
              faceValue: Number(f.face),
              couponPct: Number(f.coupon) || 0,
              maturity: f.maturity,
              description: f.desc,
            });
            if (r) {
              onClose();
              setF({ symbol: "", name: "", face: "1000", coupon: "4", maturity: "", desc: "" });
            }
          }}
        >
          {busy === "create" && <Spinner />} Create bond
        </button>
      </div>
    </Modal>
  );
}

function IssueUnits({ bond, onClose }: { bond: BondMeta | null; onClose: () => void }) {
  const { act, busy } = useAct("seller");
  const [qty, setQty] = useState("100");
  return (
    <Modal open={!!bond} onClose={onClose} title={bond ? `Issue ${bond.symbol}` : "Issue"} width={420}>
      <Field label="Units" hint="Minted to your account by the bond registry.">
        <input className="input num" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))} />
      </Field>
      <div className="mt-7 flex justify-end">
        <button
          className="btn btn-primary num !px-6"
          disabled={!bond || !(Number(qty) > 0) || busy !== null}
          onClick={async () => {
            const r = await act("issue", { type: "faucet", asset: "asset", amount: Number(qty), assetClass: bond!.symbol });
            if (r) onClose();
          }}
        >
          {busy === "issue" ? <Spinner /> : <Coins size={14} />} Issue
        </button>
      </div>
    </Modal>
  );
}
