import type { Metadata } from "next";
import "./globals.css";
import DataFreshness from "./data-freshness";
import BackToTop from "./back-to-top";
import SiteAnnouncement from "./site-announcement";
import ThemeToggle from "./theme-toggle";

export const metadata: Metadata = {
  title: "CounterPick — Dota 2 Draft Intelligence",
  description: "Контрпики и situational builds под ваш драфт Dota 2.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "CounterPick — Dota 2 Draft Intelligence",
    description: "Пик, который ломает план.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "CounterPick draft intelligence" }],
  },
  twitter: { card: "summary_large_image", title: "CounterPick", description: "Пик, который ломает план.", images: ["/og.png"] },
  icons: {
    icon: [{ url: "/assets/counterpick-logo-v2.png", type: "image/png", sizes: "192x192" }],
    shortcut: "/assets/counterpick-logo-v2.png",
    apple: [{ url: "/assets/counterpick-logo-v2.png", sizes: "192x192" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><head><link rel="preload" href="/assets/counterpick-logo-v2.webp" as="image" type="image/webp" fetchPriority="high" /></head><body><ThemeToggle /><DataFreshness /><SiteAnnouncement /><BackToTop />{children}</body></html>;
}
