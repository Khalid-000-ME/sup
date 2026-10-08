"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ExternalLink, X, AlertTriangle } from "lucide-react";
import { SUP_PERSONAS, isSupRole } from "@/lib/sup/personas";
import { TxModal } from "./TxModal";
import { shortId } from "@/lib/shared/format";

interface Toast {
  id: number;
  kind: "ok" | "error";
  text: string;
  updateId?: string;
  /** The acting party, used as the default viewer in the transaction inspector. */
  persona?: string;
}

interface UiApi {
  toast: (t: Omit<Toast, "id">) => void;
  openTx: (updateId: string, viewer: string) => void;
}


const UiCtx = createContext<UiApi>({ toast: () => {}, openTx: () => {} });
export const useUi = () => useContext(UiCtx);

export function Providers({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tx, setTx] = useState<{ id: string; viewer: string } | null>(null);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((l) => [...l.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), t.kind === "error" ? 9000 : 7000);
  }, []);
  const openTx = useCallback((id: string, viewer: string) => setTx({ id, viewer }), []);
  const api = useMemo(() => ({ toast, openTx }), [toast, openTx]);

  return (
          <UiCtx.Provider value={api}>
        {children}
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                className="pointer-events-auto rounded-[14px] border border-line-strong bg-s2 p-3.5 shadow-[var(--e-3)]"
              >
                <div className="flex items-start gap-2.5">
                  {t.kind === "ok" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-bad" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] leading-snug text-ink">{t.text}</div>
                    {t.updateId && t.persona && (
                      <button
                        onClick={() => openTx(t.updateId!, t.persona!)}
                        className="num mt-1.5 inline-flex items-center gap-1 text-[11px] text-accent-soft hover:underline"
                      >
                        committed on Canton · {shortId(t.updateId, 8, 6)} <ExternalLink size={11} />
                      </button>
                    )}
                  </div>
                  <button onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))} className="text-muted hover:text-ink" aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <TxModal
          tx={tx}
          labelOf={(v) => (isSupRole(v) ? SUP_PERSONAS[v].label : "This party")}
          endpoint="/api/sup/tx"
          onClose={() => setTx(null)}
        />
      </UiCtx.Provider>
      );
}
