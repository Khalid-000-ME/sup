import type { CSSProperties } from "react";

/** Corner crosshair for the framed sections. */
export function Cross({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute z-[2] text-[var(--line-strong)] ${className}`}>
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
      </svg>
    </span>
  );
}

/** Violet bloom. Decoration only, never interactive. */
/** The hero's mesh gradient, as a soft two-tone bloom: blue body with a lavender-pink highlight. */
const BLUE = "#3f67c9";
const LAVENDER = "#d6b6e6";

export function Glow({
  className = "",
  intensity = 0.3,
  style,
}: {
  className?: string;
  intensity?: number;
  style?: CSSProperties;
}) {
  const pct = (n: number) => Math.round(intensity * n * 100);
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{
        background: [
          `radial-gradient(closest-side at 32% 62%, color-mix(in srgb, ${LAVENDER} ${pct(0.9)}%, transparent), transparent)`,
          `radial-gradient(closest-side at 68% 44%, color-mix(in srgb, ${BLUE} ${pct(1.15)}%, transparent), transparent)`,
        ].join(", "),
        ...style,
      }}
    />
  );
}

/** The Sup logo: two offset slabs. Drawn with `currentColor` so it follows the surrounding text. */
export function Mark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="276 276 880 880" fill="currentColor" aria-hidden className={className}>
      <path d="M 940 306 L 652 565 C 640 576 636 586 635 598 L 622 765 Q 621 777 633 775 L 927 518 C 938 507 943 497 945 483 L 957 322 Q 958 305 940 306 Z" />
      <path d="M 940 306 L 652 565 C 640 576 636 586 635 598 L 622 765 Q 621 777 633 775 L 927 518 C 938 507 943 497 945 483 L 957 322 Q 958 305 940 306 Z" transform="translate(-152 358)" />
    </svg>
  );
}
