import type { Metadata } from "next";
import "./globals.css";
import DataFreshness from "./data-freshness";
import BackToTop from "./back-to-top";
import SiteAnnouncement from "./site-announcement";
import ThemeToggle from "./theme-toggle";

const criticalCss = `:root{--bg:#edf4f3;--surface:#fff;--surface2:#f5faf9;--line:#14374124;--text:#10232a;--muted:#5c737b;--teal:#087d70;--red:#c84d4c;color-scheme:light}@media(prefers-color-scheme:dark){:root:not([data-theme]){--bg:#080d13;--surface:#101923;--surface2:#151f2b;--line:#b4d2e41f;--text:#f3f8fa;--muted:#93a6b2;--teal:#8af1d4;--red:#ff756f;color-scheme:dark}}:root[data-theme=dark]{--bg:#080d13;--surface:#101923;--surface2:#151f2b;--line:#b4d2e41f;--text:#f3f8fa;--muted:#93a6b2;--teal:#8af1d4;--red:#ff756f;color-scheme:dark}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:Arial,Helvetica,sans-serif}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer}a{color:inherit;text-decoration:none}.site-shell{min-height:100vh;background:var(--bg)}.topbar,.hero-section,.draft-section,.results-section,.how-section,footer{width:min(1240px,calc(100% - 56px));margin:0 auto}.topbar{height:82px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;font-weight:900}.brand-mark{width:30px;height:30px;border-radius:8px;background:url('/counterpick-logo.png') center/cover no-repeat}.nav-links,.topbar-actions{display:flex;align-items:center;gap:20px}.hero-section{min-height:420px;padding:52px 0}.hero-copy h1{font-size:clamp(48px,6vw,78px);line-height:.94;margin:17px 0}.hero-copy p,.section-intro p{color:var(--muted);line-height:1.6}.draft-section,.results-section,.how-section{padding:40px 0 80px}.draft-board{display:grid;grid-template-columns:1fr 240px 1fr;gap:18px}.roster-panel,.recommendation-card,.battle-controls{border:1px solid var(--line);background:var(--surface);padding:18px}.draft-center{display:flex;flex-direction:column;justify-content:center;gap:14px}.calculate-button{width:100%;padding:14px;border:0;background:var(--teal);color:#061411;font-weight:900}.results-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.recommendation-card.top-pick{grid-column:span 2}.global-data-status,.site-announcement,.theme-toggle,.back-to-top{position:fixed;z-index:35;background:var(--surface);border:1px solid var(--line)}@media(max-width:900px){.nav-links{display:none}.draft-board,.results-grid{grid-template-columns:1fr}.recommendation-card.top-pick{grid-column:auto}.topbar,.hero-section,.draft-section,.results-section,.how-section,footer{width:min(100% - 32px,720px)}}`;

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
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><head><style data-counterpick-critical dangerouslySetInnerHTML={{ __html: criticalCss }} /><link rel="icon" href="/counterpick-logo.png" /><link rel="apple-touch-icon" href="/counterpick-logo.png" /></head><body><ThemeToggle /><DataFreshness /><SiteAnnouncement /><BackToTop />{children}</body></html>;
}
