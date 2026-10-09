"use client";

import { useId, useMemo, useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import { scaleLinear } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";
import { Glow } from "../ui/deco";
import { Segmented, Skeleton } from "./kit";
import type { PriceSeries } from "@/lib/server/prices";

const fetcher = async (u: string) => {
  const r = await fetch(u, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "prices unavailable");
  return j as { range: "1h" | "24h"; series: PriceSeries[]; at: number };
};

const money = (n: number) =>
  n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toFixed(4);

function Spark({ s }: { s: PriceSeries }) {
  const id = useId().replace(/:/g, "");
  const W = 320;
  const H = 96;
  const { areaPath, linePath, end } = useMemo(() => {
    const pts = s.points;
    const x = scaleLinear().domain([pts[0].t, pts[pts.length - 1].t]).range([0, W]);
    const lo = Math.min(...pts.map((p) => p.p));
    const hi = Math.max(...pts.map((p) => p.p));
    const pad = (hi - lo) * 0.12 || hi * 0.001;
    const y = scaleLinear().domain([lo - pad, hi + pad]).range([H - 4, 4]);
    const a = area<{ t: number; p: number }>().x((d) => x(d.t)).y0(H).y1((d) => y(d.p)).curve(curveMonotoneX);
    const l = line<{ t: number; p: number }>().x((d) => x(d.t)).y((d) => y(d.p)).curve(curveMonotoneX);
    const lastPt = pts[pts.length - 1];
    return { areaPath: a(pts) ?? "", linePath: l(pts) ?? "", end: { x: x(lastPt.t), y: y(lastPt.p) } };
  }, [s.points]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-24 w-full overflow-visible" role="img" aria-label={`${s.name} price`}>
      <defs>
        <linearGradient id={`f${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#d6b6e6" stopOpacity="0.34" />
          <stop offset="0.55" stopColor="#5b7fe0" stopOpacity="0.16" />
          <stop offset="1" stopColor="#3f67c9" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`l${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#5b7fe0" />
          <stop offset="1" stopColor="#d6b6e6" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#f${id})`} />
      <path d={linePath} fill="none" stroke={`url(#l${id})`} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={end.x} cy={end.y} r="3.2" fill="#fff" />
      <circle cx={end.x} cy={end.y} r="3.2" fill="none" stroke="#d6b6e6" strokeWidth="1.5" className="pulse-ring" />
    </svg>
  );
}

/** Live reference prices for the assets Sup settles against, refreshed every few seconds. */
export function PriceBoard() {
  const [range, setRange] = useState<"1h" | "24h">("1h");
  const { data, error } = useSWR(`/api/prices?range=${range}`, fetcher, { refreshInterval: 10_000, keepPreviousData: true });

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px] font-light tracking-tight">Markets</h2>
          <p className="num mt-1 text-[11px] text-muted">live reference prices in USD</p>
        </div>
        <Segmented size="sm" value={range} onChange={setRange} options={[{ value: "1h", label: "1H" }, { value: "24h", label: "24H" }]} />
      </div>
      {!data && !error ? (
        <div className="grid gap-px sm:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : error && !data ? (
        <div className="border border-line bg-s1 px-5 py-6 text-[13.5px] text-ink2">Live prices are unavailable right now.</div>
      ) : (
        <div className="grid border-l border-t border-line sm:grid-cols-2">
          {data!.series.map((s) => (
            <div key={s.symbol} className="group relative overflow-hidden border-b border-r border-line bg-bg px-5 py-4">
              <Glow className="inset-x-0 bottom-[-7rem] h-[12rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100" intensity={0.3} />
              <div className="relative">
                <div className="flex items-baseline justify-between">
                  <span className="num text-[10px] uppercase tracking-[0.18em] text-muted">{s.symbol === "CC" ? "Canton Coin" : s.symbol}</span>
                  <span className={clsx("num text-[12px]", s.changePct >= 0 ? "text-ok" : "text-bad")}>
                    {s.changePct >= 0 ? "+" : ""}
                    {s.changePct.toFixed(2)}%
                  </span>
                </div>
                <div className="num mt-2 text-[26px] font-medium leading-none tracking-tight">${money(s.last)}</div>
                <Spark s={s} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
