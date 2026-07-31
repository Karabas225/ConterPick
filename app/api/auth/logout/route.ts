import { clearSessionCookie, deleteSession } from "../../../../lib/app-auth";

export async function POST(request: Request) {
  try { await deleteSession(request); } catch { /* already logged out */ }
  const response = Response.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
