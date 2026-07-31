import { env } from "cloudflare:workers";
import { deleteAllApplications } from "../storage";

export async function DELETE() {
  try { return Response.json({ ok: true, ...(await deleteAllApplications(env.DB)) }); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}