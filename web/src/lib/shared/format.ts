export function fmt(n: number, max = 2): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: max, minimumFractionDigits: 0 }).format(n);
}

/** Amounts of small-denomination assets (CBTC, cETH) need more decimals than dollars do. */
export function fmtAmount(n: number): string {
  return fmt(n, n !== 0 && Math.abs(n) < 1 ? 8 : 2);
}

export function fmtMoney(n: number, ccy = "CC"): string {
  return `${fmt(n, 2)} ${ccy}`;
}

/**
 * Shortens a Canton update id or contract id. Every one starts with "1220" (the
 * multihash prefix for a 32-byte SHA-256), so showing the head makes every id look
 * identical. The prefix is dropped and the head shown is the first bytes after it.
 */
export function shortId(id: string, head = 6, tail = 4): string {
  const body = /^1220[0-9a-f]{60,}$/i.test(id) ? id.slice(4) : id;
  if (body.length <= head + tail + 1) return body;
  return `${body.slice(0, head)}…${body.slice(-tail)}`;
}

export function shortParty(p: string): string {
  const [name, fp] = p.split("::");
  return fp ? `${name}::${fp.slice(0, 6)}…` : p;
}

export function countdown(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
