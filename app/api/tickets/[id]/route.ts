import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { tickets } from "../../../../db/schema";
import { getCurrentUser, isAdminRequest } from "../../../../lib/app-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser(request);
    const admin = await isAdminRequest(request);
    if (!user && !admin.isAdmin) return Response.json({ error: "Требуется вход" }, { status: 401 });
    const db = await getDb();
    const rows = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    const ticket = rows[0];
    if (!ticket) return Response.json({ error: "Обращение не найдено" }, { status: 404 });
    if (!admin.isAdmin && ticket.userId !== user?.id) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { status?: unknown };
    const status = body.status === "closed" ? "closed" : body.status === "in_progress" ? "in_progress" : "open";
    await db.update(tickets).set({ status, closedBy: status === "closed" ? (user?.id ?? "admin") : null, closedAt: status === "closed" ? new Date() : null, updatedAt: new Date() }).where(eq(tickets.id, id));
    return Response.json({ ok: true, status });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось обновить обращение" }, { status: 500 }); }
}
