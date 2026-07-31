import { findHero } from "../../../lib/dota-data";
import { recordFeedback } from "../../../lib/telemetry";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { eventId?: unknown; heroId?: unknown; used?: unknown; outcome?: unknown; rating?: unknown; note?: unknown; context?: unknown };
    const heroId = Number(body.heroId);
    const used = body.used === true;
    const rating = body.rating == null ? null : Number(body.rating);
    if (!findHero(heroId) || typeof body.used !== "boolean") return Response.json({ error: "Укажите героя и факт использования пика" }, { status: 400 });
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return Response.json({ error: "Оценка должна быть от 1 до 5" }, { status: 400 });
    const context = body.context && typeof body.context === "object" ? body.context as Record<string, unknown> : {};
    const id = await recordFeedback(request, { eventId: typeof body.eventId === "string" ? body.eventId : null, heroId, used, outcome: typeof body.outcome === "string" ? body.outcome.slice(0, 40) : null, rating, note: typeof body.note === "string" ? body.note : null, context });
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить обратную связь" }, { status: 500 }); }
}
