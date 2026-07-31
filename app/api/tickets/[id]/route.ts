import { storeFirst, storeRun } from "../../../../lib/app-store";
import { getCurrentUser, isAdminRequest } from "../../../../lib/app-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser(request);
    const admin = await isAdminRequest(request);
    if (!user && !admin.isAdmin) return Response.json({ error: "Требуется вход" }, { status: 401 });
    const ticket = await storeFirst<{ id: string; user_id: string | null }>("SELECT id, user_id FROM tickets WHERE id = ? LIMIT 1", [id]);
    if (!ticket) return Response.json({ error: "Обращение не найдено" }, { status: 404 });
    if (!admin.isAdmin && ticket.user_id !== user?.id) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { status?: unknown };
    const status = body.status === "closed" ? "closed" : body.status === "in_progress" ? "in_progress" : "open";
    const now = Date.now();
    await storeRun("UPDATE tickets SET status = ?, closed_by = ?, closed_at = ?, updated_at = ? WHERE id = ?", [status, status === "closed" ? (user?.id ?? "admin") : null, status === "closed" ? now : null, now, id]);
    return Response.json({ ok: true, status });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось обновить обращение" }, { status: 500 }); }
}
