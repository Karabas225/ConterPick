import { ensureDotaUpdate, refreshDotaUpdate } from "../../../lib/dota-monitor";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const update = await (force ? refreshDotaUpdate(true) : ensureDotaUpdate());
  // The monitor snapshot includes the full hero catalogue and statistics for
  // server consumers. The public status badge needs only freshness metadata.
  return Response.json({
    patch: update.patch, checkedAt: update.checkedAt, sourceUpdatedAt: update.sourceUpdatedAt,
    dataUpdatedAt: update.dataUpdatedAt, buildsUpdatedAt: update.buildsUpdatedAt,
    status: update.status, buildsStatus: update.buildsStatus, source: update.source, lastError: update.lastError,
  }, { headers: { "cache-control": "no-store" } });
}
