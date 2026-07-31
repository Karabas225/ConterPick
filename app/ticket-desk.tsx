"use client";

import { useEffect, useState, type FormEvent } from "react";

type AppUser = { id: string; email: string | null; phone: string | null; displayName: string; role: string };
type Ticket = { id: string; subject: string; description: string; status: string; createdAt: string; updatedAt: string };

export default function TicketDeskDashboard({ user, onOpenAuth }: { user: AppUser | null; onOpenAuth?: () => void }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const response = await fetch("/api/tickets", { cache: "no-store" });
      const data = await response.json() as { tickets?: Ticket[] };
      if (response.ok) setTickets(data.tickets ?? []);
      else setMessage("Не удалось загрузить обращения");
    } catch {
      setMessage("Сервис обращений временно недоступен");
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetch("/api/tickets", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { tickets?: Ticket[] };
      if (active && response.ok) setTickets(data.tickets ?? []);
      if (active && !response.ok) setMessage("Не удалось загрузить обращения");
    }).catch(() => { if (active) setMessage("Сервис обращений временно недоступен"); });
    return () => { active = false; };
  }, [user]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, description }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Не удалось отправить репорт");
        return;
      }
      setSubject("");
      setDescription("");
      setMessage("Тикет создан — команда поддержки увидит его в админ-панели");
      await load();
    } catch {
      setMessage("Не удалось отправить репорт. Проверьте соединение и повторите попытку");
    } finally {
      setBusy(false);
    }
  };

  const closeTicket = async (id: string) => {
    try {
      const response = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      if (!response.ok) setMessage("Не удалось закрыть тикет");
      await load();
    } catch {
      setMessage("Не удалось закрыть тикет");
    }
  };

  return <section className="ticket-desk">
    <div className="panel-heading">
      <div><span className="eyebrow">SUPPORT FLOW</span><h3>Репорты и тикеты</h3></div>
      {user && <button type="button" className="ghost-button" onClick={() => { setOpen((value) => !value); setMessage(""); }}>{open ? "Скрыть" : "Создать тикет"}</button>}
    </div>
    {!user && <div className="muted-note">Войдите по почте или телефону, чтобы отправить обращение и закрыть его самостоятельно. {onOpenAuth && <button type="button" className="text-button" onClick={onOpenAuth}>Войти / зарегистрироваться</button>}</div>}
    {user && open && <form className="ticket-form" onSubmit={create}>
      <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Тема проблемы" aria-label="Тема проблемы" minLength={4} maxLength={120} required />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Опишите, что произошло и какой драфт был выбран" aria-label="Описание проблемы" minLength={10} maxLength={4000} required />
      <button type="submit" className="calculate-button" disabled={busy}>{busy ? "Отправляем…" : "Отправить репорт ↗"}</button>
      {message && <small role="status" aria-live="polite">{message}</small>}
    </form>}
    {user && <div className="ticket-list">
      {tickets.map((ticket) => <div className="ticket-row" key={ticket.id}><div><b>{ticket.subject}</b><p>{ticket.description}</p></div><div><span className={`ticket-status ${ticket.status}`}>{ticket.status === "closed" ? "закрыт" : "открыт"}</span>{ticket.status !== "closed" && <button type="button" className="text-button" onClick={() => void closeTicket(ticket.id)}>Закрыть</button>}</div></div>)}
      {!tickets.length && <p className="muted-note">Пока нет обращений.</p>}
    </div>}
  </section>;
}
