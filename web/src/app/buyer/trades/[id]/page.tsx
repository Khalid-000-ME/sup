import { TradeDetail } from "@/components/portal/TradeDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TradeDetail role="buyer" id={decodeURIComponent(id)} />;
}
