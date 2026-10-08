/**
 * Reference market prices for the assets Sup settles in: CBTC (priced as the Bitcoin it is
 * backed by one to one) and Canton Coin. Bitcoin comes from Binance's public candle API,
 * Canton Coin from CoinGecko; neither name is shown in the UI. Results are
 * cached and shared between callers, so the number of upstream requests is constant no matter
 * how many pages are open.
 */
export type PriceRange = "1h" | "24h";

export interface PriceSeries {
  symbol: "CBTC" | "CC";
  name: string;
  last: number;
  changePct: number;
  points: { t: number; p: number }[];
}

interface Entry {
  at: number;
  value: Promise<PriceSeries>;
}
declare global {
  var __supPrices: Map<string, Entry> | undefined;
}
const store = () => (globalThis.__supPrices ??= new Map());

function cached(key: string, ttl: number, load: () => Promise<PriceSeries>): Promise<PriceSeries> {
  const hit = store().get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = load().catch((e) => {
    // serve the last good value rather than an error if the upstream hiccups
    store().delete(key);
    if (hit) return hit.value;
    throw e;
  });
  store().set(key, { at: Date.now(), value });
  return value;
}

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${new URL(url).host} responded ${r.status}`);
  return r.json() as Promise<T>;
}

async function bitcoin(range: PriceRange): Promise<PriceSeries> {
  const pair = "BTCUSDT";
  const [interval, limit] = range === "1h" ? ["1m", 60] : ["5m", 288];
  const [klines, t24] = await Promise.all([
    json<unknown[][]>(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`),
    json<{ lastPrice: string; priceChangePercent: string }>(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`),
  ]);
  const points = klines.map((k) => ({ t: Number(k[0]), p: Number(k[4]) }));
  const last = Number(t24.lastPrice);
  const first = points[0]?.p ?? last;
  return {
    symbol: "CBTC",
    name: "CBTC",
    last,
    changePct: range === "24h" ? Number(t24.priceChangePercent) : first ? ((last - first) / first) * 100 : 0,
    points,
  };
}

async function canton(range: PriceRange): Promise<PriceSeries> {
  const [chart, simple] = await Promise.all([
    json<{ prices: [number, number][] }>("https://api.coingecko.com/api/v3/coins/canton-network/market_chart?vs_currency=usd&days=1"),
    json<{ "canton-network": { usd: number; usd_24h_change: number } }>(
      "https://api.coingecko.com/api/v3/simple/price?ids=canton-network&vs_currencies=usd&include_24hr_change=true",
    ),
  ]);
  const all = chart.prices.map(([t, p]) => ({ t, p }));
  const cutoff = Date.now() - 3600_000;
  const points = range === "1h" ? all.filter((x) => x.t >= cutoff) : all;
  const last = simple["canton-network"].usd;
  const first = points[0]?.p ?? last;
  return {
    symbol: "CC",
    name: "Canton Coin",
    last,
    changePct: range === "24h" ? simple["canton-network"].usd_24h_change : first ? ((last - first) / first) * 100 : 0,
    points: points.length > 1 ? points : all.slice(-12),
  };
}

export async function getPrices(range: PriceRange): Promise<PriceSeries[]> {
  const results = await Promise.allSettled([
    cached(`CBTC:${range}`, 10_000, () => bitcoin(range)),
    cached(`CC:${range}`, 60_000, () => canton(range)),
  ]);
  return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
}
