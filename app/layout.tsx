import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import DataFreshness from "./data-freshness";
import BackToTop from "./back-to-top";
import SiteAnnouncement from "./site-announcement";
import ThemeToggle from "./theme-toggle";

function metadataBaseFromRequest(host: string | null) {
  const safeHost = host?.split(",")[0]?.trim();
  if (safeHost && /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(safeHost)) {
    // The VDS terminates TLS before the VPN hop and currently forwards
    // `X-Forwarded-Proto: http`. Public metadata must still keep HTTPS URLs;
    // only an explicitly local host is allowed to use plain HTTP.
    const protocol = safeHost.startsWith("localhost") || safeHost.startsWith("127.") || safeHost.startsWith("192.168.")
      ? "http"
      : "https";
    return new URL(`${protocol}://${safeHost}`);
  }

  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  return {
  title: "CounterPick — Dota 2 Draft Intelligence",
  description: "Контрпики и situational builds под ваш драфт Dota 2.",
  metadataBase: metadataBaseFromRequest(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")),
  openGraph: {
    title: "CounterPick — Dota 2 Draft Intelligence",
    description: "Пик, который ломает план.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "CounterPick draft intelligence" }],
  },
  twitter: { card: "summary_large_image", title: "CounterPick", description: "Пик, который ломает план.", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><head><link rel="preload" href="/assets/counterpick-mark-v3.png" as="image" type="image/png" fetchPriority="high" /><link rel="icon" href="/assets/counterpick-mark-v3.png" type="image/png" sizes="192x192" /><link rel="apple-touch-icon" href="/assets/counterpick-mark-v3.png" sizes="192x192" /></head><body><ThemeToggle /><DataFreshness /><SiteAnnouncement /><BackToTop />{children}</body></html>;
}
