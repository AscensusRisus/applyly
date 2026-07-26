import { env } from "cloudflare:workers";
import { getApplicationAnalytics } from "../storage";

export async function GET() {
  try { return Response.json(await getApplicationAnalytics(env.DB)); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}
