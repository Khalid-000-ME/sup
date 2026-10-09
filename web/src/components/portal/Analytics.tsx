"use client";

import { useMemo, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { EmptyState, Label, PageHeader, Panel, Segmented, Skeleton, Stat, StatRow } from "./kit";
import { buildTrades, useSupState } from "@/lib/sup/client";
import { toRows, unitFmt } from "@/lib/sup/portal";
import { useNow } from "@/lib/client/hooks";
import { fmtAmount } from "@/lib/shared/format";


export function Analytics({ role }: { role: "seller" | "buyer" }) {
  const { data: state } = useSupState(role);
  const now = useNow(5000);
  const [ccy, setCcy] = useState<string>("CashUSD");

  const rows = useMemo(() => (state ? toRows(buildTrades(state, now), role) : []), [state, now, role]);

  // CashUSD always, plus every currency this party has actually traded in
  const currencies = useMemo(() => ["CashUSD", ...new Set(rows.map((r) => r.ccy).filter((c) => c !== "CashUSD"))], [rows]);

  const model = useMemo(() => {
    const settled = rows.filter((r) => r.trade.stage === "settled" && r.ccy === ccy);
    const allSettled = rows.filter((r) => r.trade.stage === "settled");
    const closed = rows.filter((r) => r.done);
    const volume = settled.reduce((s, r) => s + r.amount, 0);
    const units = settled.reduce((s, r) => s + r.qty, 0);

    const byDay = new Map<string, number>();
    settled.forEach((r) => {
      const ts = r.trade.receipt?.settledAt ?? r.at;
      const d = new Date(ts).toISOString().slice(5, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + r.amount);
    });
    const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([label, value]) => ({ label, value }));

    const byBond = new Map<string, number>();
    settled.forEach((r) => byBond.set(r.bond, (byBond.get(r.bond) ?? 0) + r.amount));
    const bonds = [...byBond.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));

    const status = {
      settled: allSettled.length,
      cancelled: rows.filter((r) => r.trade.stage === "cancelled").length,
      expired: rows.filter((r) => r.trade.stage === "expired").length,
      open: rows.filter((r) => !r.done).length,
    };
    return {
      settled,
      volume,
      avg: units ? volume / units : 0,
      rate: closed.length ? (allSettled.length / closed.length) * 100 : 0,
      days,
      bonds,
      status,
      closed: closed.length,
    };
  }, [rows, ccy]);

  return (
    <>
      <PageHeader
        title="Analytics"
        sub={role === "seller" ? "How your offers are performing." : "What you have bought, and at what price."}
        actions={
          <Segmented
            value={ccy}
            onChange={setCcy}
            options={currencies.map((c) => ({ value: c, label: c === "CC" ? "Canton Coin" : c }))}
          />
        }
      />
      {!state ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState title="No trades to analyse yet" body="Charts appear once you have settled a trade." />
        </Panel>
      ) : (
        <>
          <StatRow>
            <Stat label={role === "seller" ? "Sold" : "Spent"} value={fmtAmount(model.volume)} sub={`${ccy} settled`} />
            <Stat label="Trades settled" value={model.settled.length} sub={`in ${ccy}`} />
            <Stat label="Avg per unit" value={model.avg ? unitFmt(model.avg) : "-"} sub={ccy} />
            <Stat label="Success rate" value={model.closed ? `${model.rate.toFixed(0)}%` : "-"} sub={`${model.closed} closed trades`} />
          </StatRow>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Panel>
              <div className="p-6">
                <Label>Settled volume by day</Label>
                <Bars data={model.days} empty={`No ${ccy} settlements yet`} />
              </div>
            </Panel>
            <Panel>
              <div className="p-6">
                <Label>Volume by bond</Label>
                <HBars data={model.bonds} empty={`No ${ccy} settlements yet`} />
              </div>
            </Panel>
          </div>

          <Panel className="mt-6">
            <div className="p-6">
              <Label>Outcomes</Label>
              <Outcomes status={model.status} />
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

function Bars({ data, empty }: { data: { label: string; value: number }[]; empty: string }) {
  if (!data.length) return <div className="num flex h-48 items-center text-[12.5px] text-muted">{empty}</div>;
  const W = 560;
  const H = 210;
  const m = { t: 14, r: 8, b: 26, l: 8 };
  const x = scaleBand<string>().domain(data.map((d) => d.label)).range([m.l, W - m.r]).padding(0.34);
  const y = scaleLinear().domain([0, Math.max(...data.map((d) => d.value)) * 1.1]).range([H - m.b, m.t]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 w-full" role="img" aria-label="Settled volume by day">
      <defs>
        <linearGradient id="barfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#d6b6e6" />
          <stop offset="0.5" stopColor="#5b7fe0" />
          <stop offset="1" stopColor="#3f67c9" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke="var(--line)" />
      {data.map((d) => (
        <g key={d.label}>
          <rect x={x(d.label)} y={y(d.value)} width={x.bandwidth()} height={H - m.b - y(d.value)} rx={5} fill="url(#barfill)">
            <title>{`${d.label}: ${fmtAmount(d.value)}`}</title>
          </rect>
          <text x={(x(d.label) ?? 0) + x.bandwidth() / 2} y={y(d.value) - 6} textAnchor="middle" fontSize="10.5" fill="var(--text-2)" className="num">
            {fmtAmount(d.value)}
          </text>
          <text x={(x(d.label) ?? 0) + x.bandwidth() / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--muted)" className="num">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function HBars({ data, empty }: { data: { label: string; value: number }[]; empty: string }) {
  if (!data.length) return <div className="num flex h-48 items-center text-[12.5px] text-muted">{empty}</div>;
  const max = Math.max(...data.map((d) => d.value));
  return (
    <ul className="mt-5 space-y-3.5">
      {data.map((d) => (
        <li key={d.label}>
          <div className="num flex justify-between text-[12px]">
            <span>{d.label}</span>
            <span className="text-ink2">{fmtAmount(d.value)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-s3">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#3f67c9,#8d8fe0,#d6b6e6)]" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Outcomes({ status }: { status: { settled: number; cancelled: number; expired: number; open: number } }) {
  const parts = [
    { k: "Settled", v: status.settled, c: "var(--ok)" },
    { k: "Open", v: status.open, c: "var(--accent)" },
    { k: "Cancelled", v: status.cancelled, c: "var(--bad)" },
    { k: "Expired", v: status.expired, c: "var(--line-strong)" },
  ];
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  return (
    <div className="mt-5">
      <div className="flex h-3 overflow-hidden rounded-full bg-s3">
        {parts.map((p) => (
          <div key={p.k} style={{ width: `${(p.v / total) * 100}%`, background: p.c }} title={`${p.k}: ${p.v}`} />
        ))}
      </div>
      <ul className="num mt-4 flex flex-wrap gap-x-7 gap-y-2 text-[12px]">
        {parts.map((p) => (
          <li key={p.k} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.c }} />
            <span className="text-ink2">{p.k}</span>
            <span>{p.v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
