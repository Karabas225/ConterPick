import type { Metadata } from "next";
import "./globals.css";

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
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
