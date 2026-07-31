import { serializeCatalog } from "../../../lib/dota-data";
import { getDotaUpdateSnapshot } from "../../../lib/dota-monitor";
export async function GET() { const update = await getDotaUpdateSnapshot(); return Response.json({ ...serializeCatalog(), patch: update.patch, updateStatus: update.status, sourceUpdatedAt: update.sourceUpdatedAt }, { headers: { "cache-control": "public, max-age=3600" } }); }
