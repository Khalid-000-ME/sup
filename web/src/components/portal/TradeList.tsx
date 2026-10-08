"use client";

import { useRouter } from "next/navigation";
import clsx from "clsx";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { Spinner } from "../ui";
import { fmtAmount } from "@/lib/shared/format";
import { unitFmt, type TradeRow } from "@/lib/sup/portal";
import { Pill } from "./kit";
import type { SupAction } from "@/lib/sup/server";

export function TradeListItem({
  row,
  base,
  busy,
  highlight,
  onAct,
}: {
  row: TradeRow;
  base: string;
  busy: string | null;
  highlight?: boolean;
  onAct: (key: string, action: SupAction) => void;
}) {
  const router = useRouter();
  const href = `${base}/${row.id}`;
  const key = `row-${row.id}`;
  return (
    <motion.li
      layout="position"
      initial={highlight ? { opacity: 0, y: -14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={clsx(
        "group relative flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-5 py-4 last:border-0 transition-colors hover:bg-s2 md:flex-nowrap",
        highlight && "bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]",
      )}
      onClick={() => router.push(href)}
    >
      {highlight && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
      <div className="min-w-0 basis-full md:basis-[30%]">
        <div className="flex items-center gap-2">
          <span className="num text-[14px] font-semibold">{row.bond}</span>
          <span className="num text-[13px] text-muted">× {fmtAmount(row.qty)}</span>
          {highlight && <Pill tone="accent">New</Pill>}
        </div>
        <div className="num mt-1 text-[11.5px] text-muted">
          {row.id} · {row.counterparty.name}
        </div>
      </div>
      <div className="basis-[22%]">
        <div className="num text-[14px]">
          {fmtAmount(row.amount)} <span className="text-muted">{row.ccy}</span>
        </div>
        <div className="num mt-1 text-[11.5px] text-muted">
          {unitFmt(row.unit)} per unit
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <Pill tone={row.tone}>{row.status}</Pill>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {row.next && (
          <button
            className={clsx("btn btn-sm num", row.next.primary && "btn-primary")}
            disabled={busy !== null}
            onClick={(e) => {
              e.stopPropagation();
              onAct(key, row.next!.action);
            }}
          >
            {busy === key && <Spinner />} {row.next.label}
          </button>
        )}
        <ChevronRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
    </motion.li>
  );
}
