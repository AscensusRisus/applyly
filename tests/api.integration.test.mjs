import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const cwd = process.cwd();
const port = "4317";
const base = `http://localhost:${port}`;

async function startServer() {
  const child = spawn("npm.cmd", ["run", "dev", "--", "--port", port], { cwd, stdio: "ignore", windowsHide: true, shell: true });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(`${base}/api/health`); if (response.ok) return child; } catch { /* server is still starting */ }
    await delay(500);
  }
  child.kill();
  throw new Error("Local server did not become ready");
}

async function stopServer(child) {
  child.kill();
  await delay(500);
}

test("API persists create, restart, read, update, and delete", async () => {
  let server = await startServer();
  const company = `Persistence Test ${Date.now()}`;
  let createdId;
  try {
    const createdResponse = await fetch(`${base}/api/applications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company, role: "Integration test", appliedDate: "2026-08-01", status: "Applied", url: "https://example.com/jobs/1", contactEmail: "test@example.com" }) });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    createdId = created.application.id;
    assert.equal(created.application.company, company);
  } finally { await stopServer(server); }

  server = await startServer();
  try {
    const listedResponse = await fetch(`${base}/api/applications`);
    assert.equal(listedResponse.status, 200);
    const listed = await listedResponse.json();
    assert.equal(listed.applications.some(application => application.id === createdId && application.company === company), true);

    const invalidResponse = await fetch(`${base}/api/applications/${createdId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Not a status" }) });
    assert.equal(invalidResponse.status, 400);

    const updatedResponse = await fetch(`${base}/api/applications/${createdId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Interview" }) });
    assert.equal(updatedResponse.status, 200);
    const historyResponse = await fetch(`${base}/api/applications/${createdId}`);
    const history = await historyResponse.json();
    assert.equal(history.history.at(-1).status, "Interview");

    const deletedResponse = await fetch(`${base}/api/applications/${createdId}`, { method: "DELETE" });
    assert.equal(deletedResponse.status, 200);
    const finalResponse = await fetch(`${base}/api/applications`);
    const final = await finalResponse.json();
    assert.equal(final.applications.some(application => application.id === createdId), false);
  } finally { await stopServer(server); }
});