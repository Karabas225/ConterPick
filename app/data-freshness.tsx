"use client";

import { useEffect, useState } from "react";

type UpdateState = { patch: string; checkedAt?: string | null; sourceUpdatedAt?: string | null; dataUpdatedAt?: string | null; buildsUpdatedAt?: string | null; status: string; buildsStatus?: string; lastError?: string | null };

function dateLabel(value?: string | null) {
  if (!value) return "нет данных";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "нет данных" : date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function DataFreshness() {
  const [update, setUpdate] = useState<UpdateState | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => { void fetch("/api/updates", { cache: "no-store" }).then((response) => response.json() as Promise<UpdateState>).then((data) => { if (active) setUpdate(data); }).catch(() => undefined); };
    load();
    const timer = window.setInterval(load, 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  if (!update) return <aside className="global-data-status pending"><b>Проверяем данные Dota…</b></aside>;
  return <aside className={`global-data-status ${update.status === "error" ? "error" : ""}`} aria-label="Актуальность данных"><div><b>PATCH {update.patch || "—"}</b><span>{update.status === "error" ? "нет связи с источником" : update.status === "stale" ? "используется последний снимок" : "источник подтверждён"}</span></div><small>Мета: {dateLabel(update.dataUpdatedAt)} · Сборки: {update.buildsUpdatedAt ? dateLabel(update.buildsUpdatedAt) : update.buildsStatus === "fresh" ? "сегодня" : "baseline"}</small><small>Проверка: {dateLabel(update.checkedAt)}</small></aside>;
}
