import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Pixel, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// Titles: Space Grotesk. Body: Bricolage Grotesque. Hero: Geist Pixel. Numbers and UI labels: IBM Plex Mono.
const pixel = Geist_Pixel({ variable: "--nf-pixel", subsets: ["latin"], weight: "400" });
const display = Space_Grotesk({ variable: "--nf-display", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });
const sans = Bricolage_Grotesque({ variable: "--nf-sans", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--nf-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Sup: Private atomic delivery-versus-payment settlement on Canton",
  description:
    "Sup settles tokenized assets privately: payment and delivery complete atomically, while price, counterparties and documents stay visible only to authorized parties.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${pixel.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
