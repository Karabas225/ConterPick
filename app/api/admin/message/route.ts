import { isAdminRequest } from "../../../../lib/app-auth";
import { saveSiteMessage, type SiteMessage } from "../../../../lib/site-settings";

export async function PUT(request: Request) {
  const access = await isAdminRequest(request);
  if (!access.isAdmin) return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
  try {
    const body = await request.json() as Partial<SiteMessage>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const messageBody = typeof body.body === "string" ? body.body.trim() : "";
    const buttonLabel = typeof body.buttonLabel === "string" ? body.buttonLabel.trim() : "";
    if (title.length < 4 || messageBody.length < 10) return Response.json({ error: "Заголовок и текст сообщения должны быть заполнены" }, { status: 400 });
    if (title.length > 120 || messageBody.length > 1000 || buttonLabel.length > 60) return Response.json({ error: "Сообщение слишком длинное" }, { status: 400 });
    const message = await saveSiteMessage({ title, body: messageBody, buttonLabel: buttonLabel || "Подробнее", kind: body.kind === "info" ? "info" : "auth", enabled: body.enabled !== false });
    return Response.json({ message });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить сообщение" }, { status: 500 });
  }
}
