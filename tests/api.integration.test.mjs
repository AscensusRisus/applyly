import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const cwd = process.cwd();
const port = "4317";
const base = "http://localhost:" + port;
const testStatePath = await mkdtemp(join(tmpdir(), "applyly-api-test-"));

test.after(async () => {
  await rm(testStatePath, { recursive: true, force: true });
});

async function startServer() {
  const child = spawn("npm.cmd", ["run", "dev", "--", "--port", port, "--strictPort"], {
    cwd,
    stdio: "ignore",
    windowsHide: true,
    shell: true,
    env: { ...process.env, APPLYLY_PERSIST_STATE_PATH: testStatePath },
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error("Local server exited before becoming ready");
    try {
      const response = await fetch(base + "/api/health");
      if (response.ok) return child;
    } catch {
      // The isolated local server is still starting.
    }
    await delay(500);
  }
  await stopServer(child);
  throw new Error("Local server did not become ready");
}

async function stopServer(child) {
  if (process.platform === "win32" && child.pid) {
    await new Promise(resolve => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      killer.once("exit", resolve);
      killer.once("error", resolve);
    });
  } else {
    child.kill();
  }
  await delay(250);
}

test("isolated API persists across restart and enforces extension contracts", async () => {
  let server = await startServer();
  const unique = Date.now();
  const company = "Persistence Test " + unique + " Inc.";
  const domain = "persistence-" + unique + ".example.com";
  let createdId;
  let wellfoundId;

  try {
    const healthResponse = await fetch(base + "/api/health");
    const health = await healthResponse.json();
    assert.equal(health.apiVersion, 1);
    assert.equal(health.backupVersion, 1);
    assert.equal(health.extension.mutationsEnabled, false);
    assert.equal(health.extension.transport, "extension-host-permission");

    const malformedResponse = await fetch(base + "/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(malformedResponse.status, 400);

    const createdResponse = await fetch(base + "/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company,
        role: "Integration test",
        appliedDate: "2026-08-01",
        status: "Applied",
        url: "https://" + domain + "/jobs/1",
        contactEmail: "test@example.com",
        companyAliases: ["Persistence Test " + unique],
      }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    createdId = created.application.id;
    assert.equal(created.application.companyDomain, domain);
    assert.deepEqual(created.application.companyAliases, ["Persistence Test " + unique]);
    const duplicateResponse = await fetch(base + "/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: "Different display name",
        role: "Different role",
        appliedDate: "2026-08-02",
        status: "Applied",
        url: "https://" + domain + "/jobs/1/?utm_source=duplicate-test",
      }),
    });
    assert.equal(duplicateResponse.status, 409);
    const duplicate = await duplicateResponse.json();
    assert.equal(duplicate.code, "DUPLICATE_APPLICATION");
    assert.equal(duplicate.duplicate.id, createdId);

    const wellfoundResponse = await fetch(base + "/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: "Wellfound Fixture " + unique,
        role: "Feed-matched engineer",
        appliedDate: "2026-08-02",
        status: "Applied",
        url: "https://wellfound.com/jobs/4574524-growth-strategic-projects-clone?utm_source=applyly-test",
      }),
    });
    assert.equal(wellfoundResponse.status, 201);
    const wellfoundApplication = await wellfoundResponse.json();
    wellfoundId = wellfoundApplication.application.id;
    assert.equal(wellfoundApplication.application.companyDomain, null);

  } finally {
    await stopServer(server);
  }

  server = await startServer();
  try {
    const listedResponse = await fetch(base + "/api/applications");
    assert.equal(listedResponse.status, 200);
    const listed = await listedResponse.json();
    assert.equal(listed.applications.some(application => application.id === createdId && application.company === company), true);
    assert.equal(listed.applications.some(application => application.id === wellfoundId), true);

    const missingHistory = await fetch(base + "/api/applications/999999999");
    assert.equal(missingHistory.status, 404);

    const invalidResponse = await fetch(base + "/api/applications/" + createdId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Not a status" }),
    });
    assert.equal(invalidResponse.status, 400);

    const missingDetails = await fetch(base + "/api/applications/999999999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ details: { company: "Missing", role: "Missing", appliedDate: "2026-08-01" } }),
    });
    assert.equal(missingDetails.status, 404);

    const updatedResponse = await fetch(base + "/api/applications/" + createdId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Interview" }),
    });
    assert.equal(updatedResponse.status, 200);

    const historyResponse = await fetch(base + "/api/applications/" + createdId);
    assert.equal(historyResponse.status, 200);
    const history = await historyResponse.json();
    assert.equal(history.history.at(-1).status, "Interview");
    assert.equal(history.history.length, 2);

    const pairingResponse = await fetch(base + "/api/extension/pairing", {
      method: "POST",
      headers: { "X-Applyly-Pairing": "manage" },
    });
    assert.equal(pairingResponse.status, 201);
    const pairing = await pairingResponse.json();
    assert.equal(typeof pairing.token, "string");
    assert.equal(pairing.token.length, 64);

    const unauthorizedMatch = await fetch(base + "/api/extension/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: "Persistence Test " + unique }),
    });
    assert.equal(unauthorizedMatch.status, 401);

    const matchResponse = await fetch(base + "/api/extension/match", {
      method: "POST",
      headers: { "Authorization": "Bearer " + pairing.token, "Content-Type": "application/json", "Origin": "chrome-extension://febphjmgnkpofbinjebefmenfldbjbbb" },
      body: JSON.stringify({ company: "Persistence Test " + unique, domain }),
    });
    assert.equal(matchResponse.status, 200);
    const match = await matchResponse.json();
    assert.equal(match.matches.some(application => application.id === createdId), true);

    const pageMatchResponse = await fetch(base + "/api/extension/page-match", {
      method: "POST",
      headers: { "Authorization": "Bearer " + pairing.token, "Content-Type": "application/json", "Origin": "chrome-extension://febphjmgnkpofbinjebefmenfldbjbbb" },
      body: JSON.stringify({
        pageUrl: "https://wellfound.com/jobs/applications",
        candidates: [{ company: "Different display name", role: "Integration test", url: "https://" + domain + "/jobs/1/?utm_source=wellfound" }],
      }),
    });
    assert.equal(pageMatchResponse.status, 200);
    const pageMatch = await pageMatchResponse.json();
    assert.equal(pageMatch.scannedCandidates, 1);
    assert.equal(pageMatch.matches.some(application => application.id === createdId && application.reasons.includes("application-url")), true);

    const perCandidateResponse = await fetch(base + "/api/extension/page-match", {
      method: "POST",
      headers: { "Authorization": "Bearer " + pairing.token, "Content-Type": "application/json", "Origin": "chrome-extension://febphjmgnkpofbinjebefmenfldbjbbb" },
      body: JSON.stringify({
        pageUrl: "https://wellfound.com/jobs",
        candidates: [
          { company, role: "Senior Integration test", url: "https://wellfound.com/jobs/900001-related-role" },
          { company, role: "Product Designer", url: "https://wellfound.com/jobs/900002-different-role" },
        ],
      }),
    });
    assert.equal(perCandidateResponse.status, 200);
    const perCandidate = await perCandidateResponse.json();
    assert.equal(perCandidate.matchedCandidates, 2);
    assert.equal(perCandidate.matches.filter(application => application.id === createdId).length, 1);
    assert.equal(perCandidate.candidateMatches.length, 2);
    assert.equal(perCandidate.candidateMatches[0].matches.some(application => application.id === createdId
      && application.matchKind === "similar-role"), true);
    assert.equal(perCandidate.candidateMatches[1].matches.some(application => application.id === createdId
      && application.matchKind === "company-history"), true);

    const wellfoundMatchResponse = await fetch(base + "/api/extension/page-match", {
      method: "POST",
      headers: { "Authorization": "Bearer " + pairing.token, "Content-Type": "application/json", "Origin": "chrome-extension://febphjmgnkpofbinjebefmenfldbjbbb" },
      body: JSON.stringify({
        pageUrl: "https://wellfound.com/jobs",
        candidates: [{ company: "", role: "Feed-matched engineer", url: "https://www.wellfound.com/jobs/4574524-different-rendered-slug?ref=jobs-feed" }],
      }),
    });
    assert.equal(wellfoundMatchResponse.status, 200);
    const wellfoundMatch = await wellfoundMatchResponse.json();
    assert.equal(wellfoundMatch.matches.some(application => application.id === wellfoundId
      && application.candidateIndex === 0
      && application.reasons.includes("application-url")), true);

    const pairedHealth = await (await fetch(base + "/api/health")).json();
    assert.equal(pairedHealth.extension.paired, true);

    const deletedResponse = await fetch(base + "/api/applications/" + createdId, { method: "DELETE" });
    assert.equal(deletedResponse.status, 200);
    const deletedWellfound = await fetch(base + "/api/applications/" + wellfoundId, { method: "DELETE" });
    assert.equal(deletedWellfound.status, 200);
    const deletedHistory = await fetch(base + "/api/applications/" + createdId);
    assert.equal(deletedHistory.status, 404);
  } finally {
    await stopServer(server);
  }
});
