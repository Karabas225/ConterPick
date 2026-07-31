"use client";

import { useEffect, useState } from "react";

type SiteMessage = { title: string; body: string; buttonLabel: string; kind: "auth" | "info"; enabled: boolean; updatedAt: string | null };
const DISMISSED_KEY = "counterpick-message-dismissed";

export default function SiteAnnouncement() {
  const [message, setMessage] = useState<SiteMessage | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => {
      void fetch("/api/site-message", { cache: "no-store" }).then((response) => response.json() as Promise<{ message?: SiteMessage }>).then((data) => {
        if (!active || !data.message) return;
        const next = data.message;
        setMessage(next);
        if (!next.enabled) { setVisible(false); return; }
        const dismissed = window.localStorage.getItem(DISMISSED_KEY);
        setVisible(dismissed !== (next.updatedAt ?? "default"));
      }).catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  if (!message || !visible) return null;
  const dismiss = () => { window.localStorage.setItem(DISMISSED_KEY, message.updatedAt ?? "default"); setVisible(false); };
  const openAuth = () => { window.dispatchEvent(new CustomEvent("counterpick:open-auth")); };
  return <aside className={`site-announcement ${message.kind}`} role="status"><button type="button" className="announcement-close" onClick={dismiss} aria-label="Скрыть сообщение">×</button><span className="eyebrow accent">COUNTERPICK NOTE</span><h2>{message.title}</h2><p>{message.body}</p><div className="announcement-actions">{message.kind === "auth" && <button type="button" className="calculate-button" onClick={openAuth}>{message.buttonLabel}</button>}<button type="button" className="ghost-button" onClick={dismiss}>Понятно</button></div></aside>;
}
