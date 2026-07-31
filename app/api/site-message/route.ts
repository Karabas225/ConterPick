import { getSiteMessage } from "../../../lib/site-settings";

export async function GET() {
  return Response.json({ message: await getSiteMessage() }, { headers: { "cache-control": "no-store" } });
}
