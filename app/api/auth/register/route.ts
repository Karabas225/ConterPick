import { eq, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { createSession, hashPassword, isEmail, isPhone, normalizeEmail, normalizePhone, setSessionCookie, configuredAdminEmails } from "../../../../lib/app-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; phone?: unknown; password?: unknown; displayName?: unknown };
    const rawEmail = typeof body.email === "string" ? body.email : "";
    const rawPhone = typeof body.phone === "string" ? body.phone : "";
    const email = rawEmail ? normalizeEmail(rawEmail) : null;
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim().slice(0, 80) : (email ?? phone ?? "CounterPick player");
    if ((!email || !isEmail(email)) && (!phone || !isPhone(phone))) return Response.json({ error: "Укажите корректную почту или телефон" }, { status: 400 });
    if (password.length < 8) return Response.json({ error: "Пароль должен содержать минимум 8 символов" }, { status: 400 });
    const db = await getDb();
    const existing = await db.select({ id: users.id }).from(users).where(email && phone ? or(eq(users.email, email), eq(users.phone, phone)) : email ? eq(users.email, email) : eq(users.phone, phone!)).limit(1);
    if (existing.length) return Response.json({ error: "Аккаунт с такими данными уже существует" }, { status: 409 });
    const id = crypto.randomUUID();
    const role = email && configuredAdminEmails().includes(email) ? "admin" : "user";
    await db.insert(users).values({ id, email, phone, displayName, passwordHash: await hashPassword(password), role });
    const response = Response.json({ user: { id, email, phone, displayName, role } }, { status: 201 });
    setSessionCookie(response, request, await createSession(id));
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось создать аккаунт" }, { status: 500 });
  }
}
