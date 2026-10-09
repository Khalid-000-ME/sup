import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "Sup: confidential OTC settlement desk for tokenized bonds on Canton",
  description:
    "Atomic delivery-versus-payment against real Canton Coin, with a settlement agent that never sees the trade.",
};

export default function Home() {
  return <Landing />;
}
