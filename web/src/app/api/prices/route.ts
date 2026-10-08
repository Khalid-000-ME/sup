import type { NextRequest } from "next/server";
import { getPrices } from "@/lib/server/prices";
import { handle } from "@/lib/server/http";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const range = req.nextUrl.searchParams.get("range") === "24h" ? "24h" : "1h";
    return { range, series: await getPrices(range), at: Date.now() };
  });
}
