import { storeFirst } from "../../../../lib/app-store";
import { configuredAdminEmails, createSession, isEmail, isPhone, normalizeEmail, normalizePhone, setSessionCookie, verifyPassword } from "../../../../lib/app-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { identifier?: unknown; password?: unknown };
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const normalizedEmail = normalizeEmail(identifier);
    const normalizedPhone = normalizePhone(identifier);
    const email = isEmail(normalizedEmail) ? normalizedEmail : null;
    const phone = isPhone(normalizedPhone) ? normalizedPhone : null;
    if (!email && !phone) return Response.json({ error: "Введите корректную почту или телефон" }, { status: 400 });
    const user = await storeFirst<{ id: string; email: string | null; phone: string | null; display_name: string; password_hash: string; role: string }>(email ? "SELECT id, email, phone, display_name, password_hash, role FROM users WHERE email = ? LIMIT 1" : "SELECT id, email, phone, display_name, password_hash, role FROM users WHERE phone = ? LIMIT 1", [email ?? phone!]);
    if (!user || !(await verifyPassword(password, user.password_hash))) return Response.json({ error: "Неверные данные для входа" }, { status: 401 });
    const role = user.email && configuredAdminEmails().includes(normalizeEmail(user.email)) ? "admin" : user.role;
    const response = Response.json({ user: { id: user.id, email: user.email, phone: user.phone, displayName: user.display_name, role } });
    setSessionCookie(response, request, await createSession(user.id));
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось войти" }, { status: 500 });
  }
}
