import { env } from "cloudflare:workers";
import { exportApplicationBackup, importApplicationBackup } from "../storage";

function db() { if (!env.DB) throw new Error("D1 binding unavailable"); return env.DB; }

export async function GET() {
  try { return Response.json(await exportApplicationBackup(db())); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const backup = await request.json();
    return Response.json({ applications: await importApplicationBackup(db(), backup) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Backup could not be imported" }, { status: 400 });
  }
}
