import { desc } from "drizzle-orm";
import { getDb } from "../db";
import { draftEvents, pickFeedback, tickets } from "../db/schema";
import { getCurrentUser } from "./app-auth";

export type DraftSnapshot = { targetRole: number; allies: unknown[]; enemies: unknown[]; recommendations: unknown[] };

export async function recordDraft(request: Request, snapshot: DraftSnapshot) {
  try {
    const user = await getCurrentUser(request).catch(() => null);
    const id = crypto.randomUUID();
    const db = await getDb();
    await db.insert(draftEvents).values({ id, userId: user?.id ?? null, anonymousId: null, targetRole: snapshot.targetRole, alliesJson: JSON.stringify(snapshot.allies), enemiesJson: JSON.stringify(snapshot.enemies), recommendationsJson: JSON.stringify(snapshot.recommendations) });
    return id;
  } catch { return null; }
}

export async function recordFeedback(request: Request, input: { eventId?: string | null; heroId: number; used: boolean; outcome?: string | null; rating?: number | null; note?: string | null; context: Record<string, unknown> }) {
  const user = await getCurrentUser(request).catch(() => null);
  const id = crypto.randomUUID();
  const db = await getDb();
  await db.insert(pickFeedback).values({ id, eventId: input.eventId ?? null, userId: user?.id ?? null, heroId: input.heroId, used: input.used, outcome: input.outcome ?? null, rating: input.rating ?? null, note: input.note?.slice(0, 1000) ?? null, contextJson: JSON.stringify(input.context) });
  return id;
}

export async function recentAdminData() {
  const db = await getDb();
  const [ticketRows, feedbackRows, draftRows] = await Promise.all([
    db.select().from(tickets).orderBy(desc(tickets.updatedAt)).limit(100),
    db.select().from(pickFeedback).orderBy(desc(pickFeedback.createdAt)).limit(100),
    db.select().from(draftEvents).orderBy(desc(draftEvents.createdAt)).limit(100),
  ]);
  return { tickets: ticketRows, feedback: feedbackRows, drafts: draftRows };
}

export function isTicketOwner(ticketUserId: string | null, currentUserId: string | null) { return !!ticketUserId && !!currentUserId && ticketUserId === currentUserId; }
