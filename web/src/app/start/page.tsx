import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Glow, Mark } from "@/components/ui/deco";

export const metadata = { title: "Sign in | Sup" };

const ROLES = [
  {
    href: "/seller/onboard",
    title: "I sell bonds",
    body: "Define bonds, send private offers and get paid on delivery.",
  },
  {
    href: "/buyer/onboard",
    title: "I buy bonds",
    body: "See open offers ranked by price and buy in one click.",
  },
];

export default function Page() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <span aria-hidden className="grain pointer-events-none fixed inset-0 z-[60]" />
      <Glow className="left-1/2 top-[-14rem] h-[40rem] w-[60rem] -translate-x-1/2" intensity={0.2} />
      <header className="relative mx-auto flex h-16 max-w-[1280px] items-center px-5 md:px-10">
        <Link href="/" className="flex items-center gap-2" aria-label="Sup home">
          <Mark size={26} className="text-white" />
          <span className="text-[15px] font-bold tracking-tight">Sup</span>
        </Link>
      </header>
      <main className="relative mx-auto flex max-w-[860px] flex-col items-center px-5 pb-20 pt-16 text-center md:pt-24">
        <Mark size={56} className="mx-auto mb-8 text-white" />
        <h1 className="font-display text-[34px] font-light leading-tight tracking-[-0.025em] md:text-[48px]">How are you using Sup?</h1>
        <div className="mt-12 grid w-full gap-4 text-left md:grid-cols-2">
          {ROLES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="group relative overflow-hidden rounded-[18px] border border-line-strong bg-s1 p-7 transition-colors hover:border-accent"
            >
              <Glow
                className="inset-x-0 bottom-[-9rem] h-[16rem] opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                intensity={0.28}
              />
              <div className="relative">
                <h2 className="font-display text-[26px] font-light tracking-tight">{r.title}</h2>
                <p className="mt-3 min-h-[3rem] text-[14px] leading-relaxed text-ink2">{r.body}</p>
                <span className="num mt-6 inline-flex items-center gap-2 text-[13px] text-accent-soft">
                  Continue <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="num mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-muted">
          <Link href="/agent/onboard" className="transition-colors hover:text-ink">
            Settlement agent sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
