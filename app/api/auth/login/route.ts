import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { createSession, isEmail, isPhone, normalizeEmail, normalizePhone, setSessionCookie, verifyPassword } from "../../../../lib/app-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { identifier?: unknown; password?: unknown };
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const email = isEmail(normalizeEmail(identifier)) ? normalizeEmail(identifier) : null;
    const phone = isPhone(normalizePhone(identifier)) ? normalizePhone(identifier) : null;
    if (!email && !phone) return Response.json({ error: "Введите корректную почту или телефон" }, { status: 400 });
    const db = await getDb();
    const rows = await db.select().from(users).where(email ? eq(users.email, email) : eq(users.phone, phone!)).limit(1);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.passwordHash))) return Response.json({ error: "Неверные данные для входа" }, { status: 401 });
    const response = Response.json({ user: { id: user.id, email: user.email, phone: user.phone, displayName: user.displayName, role: user.role } });
    setSessionCookie(response, request, await createSession(user.id));
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось войти" }, { status: 500 });
  }
}
