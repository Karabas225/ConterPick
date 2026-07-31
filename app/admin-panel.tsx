"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type Ticket = { id: string; subject: string; description: string; status: string; createdAt: string; updatedAt: string; userId: string | null };
type Feedback = { id: string; heroId: number; used: boolean; rating: number | null; note: string | null; createdAt: string | null };
type Draft = { id: string; targetRole: number; alliesJson: string; enemiesJson: string; createdAt: string | null };
type User = { id: string; email: string | null; phone: string | null; displayName: string; role: string; createdAt: string | null };
type Bar = { label: string; value: number };
type SiteMessage = { title: string; body: string; buttonLabel: string; kind: "auth" | "info"; enabled: boolean; updatedAt: string | null };
type AdminData = { tickets: Ticket[]; feedback: Feedback[]; drafts: Draft[]; users: User[]; message: SiteMessage; stats: { roles: Bar[]; feedback: Bar[]; tickets: Bar[]; picks: Bar[] } };

function AdminMessageEditor() {
  const [message, setMessage] = useState<SiteMessage | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [kind, setKind] = useState<SiteMessage["kind"]>("auth");
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/overview", { cache: "no-store" }).then((response) => response.json() as Promise<{ message?: SiteMessage }>).then((data) => {
      if (!data.message) return;
      setMessage(data.message); setTitle(data.message.title); setBody(data.message.body); setButtonLabel(data.message.buttonLabel); setKind(data.message.kind); setEnabled(data.message.enabled);
    }).catch(() => setStatus("Не удалось загрузить сообщение"));
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/message", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, body, buttonLabel, kind, enabled }) });
      const data = await response.json() as { message?: SiteMessage; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error ?? "Не удалось сохранить сообщение");
      setMessage(data.message); setStatus("Сообщение сохранено");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Не удалось сохранить сообщение"); }
    finally { setBusy(false); }
  };

  return <section className="admin-section admin-message-section" aria-label="Глобальное сообщение"><div className="section-intro"><div><span className="eyebrow accent">SITE MESSAGE / 06</span><h2>Сообщение для игроков</h2><p>Покажите просьбу войти в аккаунт или информационный баннер всем пользователям. Выключение применяется глобально.</p></div><span className={`message-state ${enabled ? "on" : "off"}`}>{enabled ? "ВИДИМО" : "СКРЫТО"}</span></div><form className="admin-message-form" onSubmit={save}><label>Заголовок<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={4} maxLength={120} required /></label><label>Текст<textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={10} maxLength={1000} required /></label><div className="admin-message-row"><label>Тип<select value={kind} onChange={(event) => setKind(event.target.value as SiteMessage["kind"])}><option value="auth">Просьба войти</option><option value="info">Информация</option></select></label><label>Текст кнопки<input value={buttonLabel} onChange={(event) => setButtonLabel(event.target.value)} maxLength={60} /></label><label className="switch-label"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Показывать всем</label></div><button type="submit" className="calculate-button" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить сообщение"}</button>{status && <small className={status.includes("сохранено") ? "success-text" : "error-text"} role="status">{status}</small>}{message?.updatedAt && <small className="muted-note">Последнее изменение: {new Date(message.updatedAt).toLocaleString("ru-RU")}</small>}</form></section>;
}

function BarChart({ title, rows, accent = "teal" }: { title: string; rows: Bar[]; accent?: "teal" | "orange" | "red" }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <div className="admin-card admin-chart"><div className="admin-card-heading"><span className="build-label">{title}</span><span className="table-count">{rows.reduce((sum, row) => sum + row.value, 0)}</span></div>{rows.length ? rows.map((row) => <div className="bar-row" key={row.label}><div className="bar-label"><span>{row.label}</span><b>{row.value}</b></div><div className="bar-track"><span className={`bar-fill ${accent}`} style={{ width: `${Math.max(5, Math.round((row.value / max) * 100))}%` }} /></div></div>) : <p className="muted-note">Пока нет данных для диаграммы.</p>}</div>;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function AdminPanelOverview({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const payload = await response.json() as AdminData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Нет доступа");
      setData(payload);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось загрузить админ-панель");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (response) => ({ response, payload: await response.json() as AdminData & { error?: string } }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok) throw new Error(payload.error ?? "Нет доступа");
        setData(payload);
        setError("");
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Не удалось загрузить админ-панель"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const openTickets = useMemo(() => data?.tickets.filter((ticket) => ticket.status !== "closed") ?? [], [data]);
  const closeTicket = async (id: string) => {
    await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "closed" }) });
    void load();
  };

  return <section className="admin-section" aria-label="Админ-панель"><div className="section-intro"><div><span className="eyebrow accent">CONTROL ROOM / 05</span><h2>Админ-панель</h2><p>Единый обзор пользователей, драфтов, обратной связи и поддержки.</p></div><button type="button" className="ghost-button" onClick={onClose}>Скрыть</button></div>{loading && <div className="admin-card admin-loading">Загружаем данные панели…</div>}{error && <div className="error-box">{error}</div>}{data && <><div className="admin-metrics"><div><b>{data.users.length}</b><span>пользователей в снимке</span></div><div><b>{data.drafts.length}</b><span>драфтов сохранено</span></div><div><b>{data.feedback.length}</b><span>ответов по пикам</span></div><div><b>{openTickets.length}</b><span>открытых тикетов</span></div></div><div className="admin-analytics"><BarChart title="ПОЗИЦИИ В ДРАФТАХ" rows={data.stats.roles} /><BarChart title="ОБРАТНАЯ СВЯЗЬ" rows={data.stats.feedback} accent="orange" /><BarChart title="ЧАЩЕ РЕКОМЕНДУЮТСЯ" rows={data.stats.picks} accent="red" /></div><div className="admin-grid"><div className="admin-card"><div className="admin-card-heading"><span className="build-label">OPEN TICKETS</span><span className="table-count">{openTickets.length}</span></div>{openTickets.slice(0, 20).map((ticket) => <div className="admin-ticket" key={ticket.id}><div><b>{ticket.subject}</b><small>{ticket.description}</small><small>{formatDate(ticket.createdAt)}</small></div><button type="button" className="text-button" onClick={() => closeTicket(ticket.id)}>Закрыть</button></div>)}{!openTickets.length && <p className="muted-note">Открытых тикетов нет.</p>}</div><div className="admin-card"><div className="admin-card-heading"><span className="build-label">PICK FEEDBACK</span><span className="table-count">{data.feedback.length}</span></div>{data.feedback.slice(0, 20).map((entry) => <div className="feedback-row" key={entry.id}><b>Hero #{entry.heroId}</b><span>{entry.used ? "использовали" : "пропустили"}{entry.rating ? ` · ${entry.rating}/5` : ""}</span><small>{entry.note ?? "Без комментария"}</small></div>)}{!data.feedback.length && <p className="muted-note">Обратная связь появится после первых расчётов.</p>}</div></div><div className="admin-table-grid"><div className="admin-card admin-table-card"><div className="admin-card-heading"><span className="build-label">ПОСЛЕДНИЕ ПОЛЬЗОВАТЕЛИ</span><span className="table-count">{data.users.length}</span></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>Игрок</th><th>Контакт</th><th>Роль</th><th>Дата</th></tr></thead><tbody>{data.users.slice(0, 25).map((user) => <tr key={user.id}><td>{user.displayName}</td><td>{user.email ?? user.phone ?? "—"}</td><td><span className={`role-badge ${user.role}`}>{user.role === "admin" ? "ADMIN" : "USER"}</span></td><td>{formatDate(user.createdAt)}</td></tr>)}</tbody></table>{!data.users.length && <p className="muted-note">Пользователей пока нет.</p>}</div></div><div className="admin-card admin-table-card"><div className="admin-card-heading"><span className="build-label">ПОСЛЕДНИЕ ДРАФТЫ</span><span className="table-count">{data.drafts.length}</span></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>Позиция</th><th>Союзники</th><th>Враги</th><th>Дата</th></tr></thead><tbody>{data.drafts.slice(0, 25).map((draft) => <tr key={draft.id}><td>P{draft.targetRole}</td><td>{draft.alliesJson ? "собраны" : "—"}</td><td>{draft.enemiesJson ? "собраны" : "—"}</td><td>{formatDate(draft.createdAt)}</td></tr>)}</tbody></table>{!data.drafts.length && <p className="muted-note">Сохранённых драфтов пока нет.</p>}</div></div></div></>}</section>;
}

export default function AdminPanelDashboard({ onClose }: { onClose: () => void }) {
  return <><AdminMessageEditor /><AdminPanelOverview onClose={onClose} /></>;
}
