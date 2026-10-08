"use client";

import { useCallback, useState } from "react";
import type { SupRole } from "@/lib/sup/personas";
import { postSup, useRefreshSup } from "@/lib/sup/client";
import type { SupAction } from "@/lib/sup/server";
import type { SupActionResult } from "@/lib/sup/types";
import { useUi } from "../Providers";

/** Runs a ledger action as `role`, with a busy key, error toast and a state refresh. */
export function useAct(role: SupRole) {
  const { toast } = useUi();
  const refresh = useRefreshSup();
  const [busy, setBusy] = useState<string | null>(null);
  const act = useCallback(
    async (key: string, action: SupAction, opts: { quiet?: boolean } = {}): Promise<SupActionResult | null> => {
      setBusy(key);
      try {
        const r = await postSup(role, action);
        if (!opts.quiet) toast({ kind: "ok", text: r.summary ?? "Done", updateId: r.updateId, persona: role });
        await refresh();
        return r;
      } catch (e) {
        toast({ kind: "error", text: e instanceof Error ? e.message : "Action failed" });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [role, toast, refresh],
  );
  return { act, busy };
}
