import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { tickets } from "../../../db/schema";
import { getCurrentUser } from "../../../lib/app-auth";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Войдите, чтобы открыть обращения" }, { status: 401 });
    const db = await getDb();
    const rows = await db.select().from(tickets).where(eq(tickets.userId, user.id)).orderBy(desc(tickets.updatedAt)).limit(50);
    return Response.json({ tickets: rows });
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
    const ticket = { id: crypto.randomUUID(), userId: user.id, subject, description, status: "open", updatedAt: new Date(), createdAt: new Date() };
    const db = await getDb();
    await db.insert(tickets).values(ticket);
    return Response.json({ ticket }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось создать обращение" }, { status: 500 }); }
}
