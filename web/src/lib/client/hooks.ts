"use client";

import { useEffect, useState } from "react";

let clockOffset = 0;

/** Aligns `useNow` with the server clock, so countdowns match ledger expiries. */
export function syncClock(serverNow: number) {
  clockOffset = serverNow - Date.now();
}

/** Server-synchronised wall clock, ticking every `every` ms. */
export function useNow(every = 250): number {
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + clockOffset), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}
