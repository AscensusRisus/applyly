import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("D1 local development uses persistent state and the Drizzle migration directory", async () => {
  const vite = await read("vite.config.ts");
  assert.match(vite, /migrations_dir:\s*["']\.\/drizzle["']/);
  assert.match(vite, /persistState:\s*\{\s*path:\s*["']\.wrangler\/state["']/);
});

test("applications migration contains the complete persistence schema", async () => {
  const migration = await read("drizzle/0000_thankful_virginia_dare.sql");
  for (const column of ["company", "role", "location", "status", "applied_date", "salary", "url", "notes", "created_at"]) {
    assert.match(migration, new RegExp("`" + column + "`"));
  }
});

test("application API uses one storage layer for reads, writes, and status changes", async () => {
  const [storage, route, statusRoute] = await Promise.all([
    read("app/api/applications/storage.ts"),
    read("app/api/applications/route.ts"),
    read("app/api/applications/[id]/route.ts"),
  ]);
  assert.match(storage, /CREATE TABLE IF NOT EXISTS applications/);
  assert.match(storage, /INSERT INTO applications/);
  assert.match(storage, /UPDATE applications SET status/);
  assert.match(storage, /rollbackApplicationStatus/);
  assert.match(storage, /DELETE FROM applications/);
  assert.match(storage, /application_status_history/);
  assert.match(storage, /contact_email/);
  assert.match(storage, /getApplicationAnalytics/);
  assert.match(route, /listApplications/);
  assert.match(route, /createApplication/);
  assert.match(statusRoute, /updateApplicationStatus/);
  assert.match(statusRoute, /rollbackApplicationStatus/);
  assert.match(statusRoute, /undoHistoryId/);
  assert.match(statusRoute, /export async function DELETE/);
  assert.match(statusRoute, /getApplicationHistory/);
  const analyticsRoute = await read("app/api/applications/analytics/route.ts");
  assert.match(analyticsRoute, /getApplicationAnalytics/);
});

test("the UI supports navigation, insights, settings, and optimistic records with the persisted record and rolls back failures", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /setApps\(current => \[optimistic, \.\.\.current\]\)/);
  assert.match(page, /app\.id === optimistic\.id \? data\.application : app/);
  assert.match(page, /current => current\.filter\(app => app\.id !== optimistic\.id\)/);
  assert.match(page, /view === "insights"/);
  assert.match(page, /view === "settings"/);
  assert.match(page, /method:"DELETE"/);
  assert.match(page, /APPLICATION LINK/);
  assert.match(page, /openHistory/);
  assert.match(page, /modal-backdrop/);
  assert.match(page, /CONTACT EMAIL/);
  assert.match(page, /Conversion funnel/);
  assert.match(page, /Welcome back/);
  assert.match(page, /hydrated/);
  assert.match(page, /todayIso/);
  assert.match(page, /getFullYear/);
  assert.doesNotMatch(page, /setForm\(current => current\.appliedDate/);
  assert.match(page, />Today</);
  assert.match(page, /Interview to Offer/);
  assert.match(page, /stacked-bar/);
  assert.match(page, /Total applications/);
  assert.match(page, /legend-swatch/);
});



test("status history migration is present", async () => {
  const migration = await read("drizzle/0001_status_history.sql");
  assert.match(migration, /application_status_history/);
  assert.match(migration, /changed_at/);
});

