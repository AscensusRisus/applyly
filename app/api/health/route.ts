export async function GET() {
  return Response.json({ ok: true, name: "applyly", version: "0.1.0", capabilities: ["applications", "status-history", "analytics", "backup", "bulk-delete"] });
}