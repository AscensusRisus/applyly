import { env } from "cloudflare:workers";
import { createApplication, listApplications, validateApplicationFields, type ApplicationPayload } from "./storage";

function db() { if (!env.DB) throw new Error("D1 binding unavailable"); return env.DB; }

export async function GET() {
  try { return Response.json({ applications: await listApplications(db()) }); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

export async function POST(request: Request) {
  let payload: ApplicationPayload;
  try { payload = (await request.json()) as ApplicationPayload; } catch { return Response.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const validationError = validateApplicationFields(payload);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  try { return Response.json({ application: await createApplication(db(), payload) }, { status: 201 }); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}
