import { isAdminRequest } from "../../../../lib/app-auth";
import { recentAdminData } from "../../../../lib/telemetry";

export async function GET(request: Request) {
  const access = await isAdminRequest(request);
  if (!access.isAdmin) return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
  try { return Response.json(await recentAdminData()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить данные админ-панели" }, { status: 500 }); }
}
