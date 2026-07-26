import { env } from "cloudflare:workers";
import { deleteApplication, getApplicationHistory, rollbackApplicationStatus, updateApplicationStatus } from "../storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { return Response.json({ history: await getApplicationHistory(env.DB, id) }); }
  catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = (await request.json()) as { status?: string; undoHistoryId?: number };
  if (payload.undoHistoryId) {
    try {
      const result = await rollbackApplicationStatus(env.DB, id, payload.undoHistoryId);
      if (!result.meta.changes) return Response.json({ error: result.reason ?? "History entry not found" }, { status: 400 });
      return Response.json({ ok: true, status: result.status });
    } catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
  }
  if (!payload.status?.trim()) return Response.json({ error: "Status is required" }, { status: 400 });
  try {
    const result = await updateApplicationStatus(env.DB, id, payload.status.trim());
    if (!result.meta.changes) return Response.json({ error: "Application not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await deleteApplication(env.DB, id);
    if (!result.meta.changes) return Response.json({ error: "Application not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
}
