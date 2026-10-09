"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Cross, Glow, Mark } from "../ui/deco";

/* Shared pieces for the landing page and the explainer pages (/why, /how, /proof). */

function RailLabel({ side, children }: { side: "left" | "right"; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={`num pointer-events-none absolute top-12 hidden text-[10px] uppercase tracking-[0.3em] text-[#2f313c] lg:block ${
        side === "left" ? "-left-9" : "-right-9"
      }`}
      style={{ writingMode: "vertical-rl", transform: side === "left" ? "rotate(180deg)" : undefined }}
    >
      {children}
    </span>
  );
}

/**
 * A section inside the hairline frame: vertical rails carrying the section name,
 * crosshairs at the corners. The rails mark where real content begins and ends.
 */
export function Framed({ label, id, children }: { label: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="relative scroll-mt-28 border-t border-line">
      <div className="mx-auto max-w-[1280px] px-5 md:px-10">
        <div className="relative border-x border-line px-5 py-20 md:px-12 md:py-28">
          <Cross className="-left-[5px] -top-[5px]" />
          <Cross className="-right-[5px] -top-[5px]" />
          <Cross className="-bottom-[5px] -left-[5px]" />
          <Cross className="-bottom-[5px] -right-[5px]" />
          <RailLabel side="left">{label}</RailLabel>
          <RailLabel side="right">{label}</RailLabel>
          {children}
        </div>
      </div>
    </section>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-5 md:px-10 ${className}`}>{children}</div>;
}

/** A hairline grid of cards, the same device the landing uses everywhere. */
export function CardGrid({
  cols = 3,
  children,
}: {
  cols?: 2 | 3 | 4;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "reveal grid gap-px overflow-hidden rounded-none border border-line bg-line",
        cols === 2 && "md:grid-cols-2",
        cols === 3 && "md:grid-cols-3",
        cols === 4 && "md:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

export function Card({ title, children, tag }: { title: string; children: ReactNode; tag?: string }) {
  return (
    <div className="group relative h-full overflow-hidden bg-bg p-7">
      <Glow
        className="inset-x-0 bottom-[-8rem] h-[13rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        intensity={0.32}
      />
      <div className="relative">
        {tag && <div className="num mb-3 text-[10px] uppercase tracking-[0.2em] text-accent">{tag}</div>}
        <h3 className="font-display text-[19px] font-medium tracking-tight">{title}</h3>
        <div className="mt-3 text-[14.5px] leading-relaxed text-ink2">{children}</div>
      </div>
    </div>
  );
}

export function Heading({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="max-w-[46rem]">
      {eyebrow && <p className="num reveal text-[10px] uppercase tracking-[0.22em] text-accent">{eyebrow}</p>}
      <h2 className="font-display reveal mt-5 text-[32px] font-light leading-[1.1] tracking-[-0.02em] md:text-[44px]">{title}</h2>
      {children && <p className="reveal mt-6 text-[16.5px] leading-relaxed text-ink2">{children}</p>}
    </div>
  );
}

export const LANDING_LINKS = [
  { href: "/#problem", label: "Problem" },
  { href: "/#how", label: "How" },
  { href: "/#proof", label: "Proof" },
];
export const PAGE_LINKS = [
  { href: "/why", label: "Why" },
  { href: "/how", label: "How it works" },
  { href: "/proof", label: "Proof" },
];

/**
 * The bar is invisible over a full-height hero (only its text shows) and takes its shape
 * once the page has scrolled past it. On pages without a hero it is solid straight away.
 */
export function Nav({ links, overHero = false }: { links: { href: string; label: string }[]; overHero?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > window.innerHeight - 96);
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  const solid = !overHero || scrolled;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-30 flex justify-center px-5">
      <nav
        className={clsx(
          "pointer-events-auto flex items-center gap-1 rounded-full border p-1.5 pl-5 transition-[background-color,border-color,box-shadow] duration-300",
          solid ? "border-[var(--line-strong)] bg-[#0d0e14] shadow-[var(--e-2)]" : "border-transparent bg-transparent shadow-none",
        )}
      >
        <Link href="/" className="mr-3 flex items-center gap-2" aria-label="Sup home">
          <Mark size={24} className="text-white" />
          <span className="text-[15px] font-bold tracking-tight text-ink">Sup</span>
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={clsx("num hidden px-3.5 py-2 text-[12px] transition-colors hover:text-white md:block", solid ? "text-ink2" : "text-white/85")}
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="/start"
          className="num ml-2 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#08080c] transition-colors hover:bg-[#e9eaf2]"
        >
          Open the desk
        </Link>
      </nav>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <Container className="flex flex-col gap-5 py-10 md:flex-row md:items-start md:justify-between">
        <div className="flex shrink-0 items-center gap-2.5">
          <Mark size={22} className="text-white" />
          <span className="text-[13px] font-bold tracking-tight">Sup</span>
        </div>
        <p className="max-w-[70ch] text-[12px] leading-relaxed text-muted">
          Testnet prototype on Canton DevNet. BOND-2031, TBILL-2027 and CashUSD are labelled test assets issued by demo parties. Canton
          Coin and CBTC are real DevNet tokens with no market value. Not a legal title transfer, and not production custody or
          compliance.
        </p>
      </Container>
    </footer>
  );
}

/** Closing call to action used on every page. */
export function Closing({ title = "Open the desk and settle one." }: { title?: string }) {
  return (
    <div className="relative overflow-hidden border-t border-line">
      <Glow className="bottom-[-24rem] left-1/2 h-[36rem] w-[52rem] -translate-x-1/2" intensity={0.3} />
      <Container className="relative py-24 text-center md:py-32">
        <Mark size={48} className="reveal mx-auto mb-8 text-white" />
        <h2 className="font-display reveal mx-auto max-w-[18ch] text-[32px] font-light leading-[1.1] tracking-[-0.02em] md:text-[46px]">{title}</h2>
        <p className="reveal mx-auto mt-6 max-w-[52ch] text-[16px] text-ink2">
          Real trades on Canton DevNet. Sell a bond, buy it with real CBTC or Canton Coin, and see exactly what each party saw.
        </p>
        <div className="reveal mt-10">
          <Link href="/start" className="btn btn-light num !px-6">
            Open the desk
          </Link>
        </div>
      </Container>
    </div>
  );
}

export function PageFrame({ children, links = PAGE_LINKS }: { children: ReactNode; links?: { href: string; label: string }[] }) {
  return (
    <div className="relative min-h-[100dvh] pt-20">
      <span aria-hidden className="grain pointer-events-none fixed inset-0 z-[60]" />
      <Nav links={links} />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
