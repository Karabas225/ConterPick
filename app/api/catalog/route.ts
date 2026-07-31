import { serializeCatalog } from "../../../lib/dota-data";
export async function GET() { return Response.json(serializeCatalog(), { headers: { "cache-control": "public, max-age=3600" } }); }
