export async function GET() {
  return Response.json({ ok: true, name: "applyly", version: "0.2.0", capabilities: ["applications", "status-history", "analytics", "backup", "bulk-delete"] });
}
