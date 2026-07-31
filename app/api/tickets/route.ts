import { asIso, storeAll, storeRun } from "../../../lib/app-store";
import { getCurrentUser } from "../../../lib/app-auth";

function toTicket(row: Record<string, unknown>) {
  return { id: String(row.id), userId: row.user_id == null ? null : String(row.user_id), subject: String(row.subject), description: String(row.description), status: String(row.status), closedBy: row.closed_by == null ? null : String(row.closed_by), closedAt: asIso(row.closed_at), createdAt: asIso(row.created_at), updatedAt: asIso(row.updated_at) };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Войдите, чтобы открыть обращения" }, { status: 401 });
    const rows = await storeAll<Record<string, unknown>>("SELECT id, user_id, subject, description, status, closed_by, closed_at, created_at, updated_at FROM tickets WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50", [user.id]);
    return Response.json({ tickets: rows.map(toTicket) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить обращения" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Войдите, чтобы создать обращение" }, { status: 401 });
    const body = await request.json() as { subject?: unknown; description?: unknown };
    const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 120) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 4000) : "";
    if (subject.length < 4 || description.length < 10) return Response.json({ error: "Тема и описание должны быть заполнены" }, { status: 400 });
    const ticket = { id: crypto.randomUUID(), userId: user.id, subject, description, status: "open", closedBy: null, closedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const now = Date.now();
    await storeRun("INSERT INTO tickets (id, user_id, subject, description, status, closed_by, closed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [ticket.id, ticket.userId, ticket.subject, ticket.description, ticket.status, null, null, now, now]);
    return Response.json({ ticket }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось создать обращение" }, { status: 500 }); }
}
