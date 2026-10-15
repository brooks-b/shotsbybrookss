import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter_Tight } from "next/font/google";
import { AmbientTone } from "@/components/motion/AmbientTone";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllFrames, getChapters } from "@/lib/content";
import { preloaderSkipScript } from "@/lib/preloader";
import { site } from "@/lib/site";
import "./globals.css";

const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"], display: "swap" });
// Only the display face (the name, the LCP element) is preloaded; the others swap in.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap", preload: false });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — Photography`, template: `%s — ${site.name}` },
  description: site.description,
  authors: [{ name: site.name }],
  openGraph: {
    type: "website",
    siteName: `${site.name} — @${site.handle}`,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0e0d0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interTight.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preloaderSkipScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="micro sr-only z-[100] bg-signal px-3 py-2 text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to content
        </a>
        <AmbientTone />
        <SmoothScroll>
          <SiteHeader chapters={getChapters().length} frames={getAllFrames().length} />
          <main id="main">{children}</main>
          <SiteFooter />
        </SmoothScroll>
        <div className="grain" aria-hidden />
        {/* Only on Vercel, where the /_vercel scripts exist. */}
        {process.env.VERCEL && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
