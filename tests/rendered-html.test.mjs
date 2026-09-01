import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("D1 local development uses persistent state and the Drizzle migration directory", async () => {
  const vite = await read("vite.config.ts");
  assert.match(vite, /migrations_dir:\s*["']\.\/drizzle["']/);
  assert.match(vite, /APPLYLY_PERSIST_STATE_PATH/);
  assert.match(vite, /APPLYLY_PERSIST_STATE_PATH \?\? ["']\.wrangler\/state["']/);
  assert.match(vite, /persistState:\s*\{\s*path:\s*persistStatePath/);
});

test("extension API is versioned, paired, read-only, and company-aware", async () => {
  const [health, pairing, match, pageMatch, matching, security, identity, migration, page] = await Promise.all([
    read("app/api/health/route.ts"),
    read("app/api/extension/pairing/route.ts"),
    read("app/api/extension/match/route.ts"),
    read("app/api/extension/page-match/route.ts"),
    read("app/api/extension/matching.ts"),
    read("app/api/extension/security.ts"),
    read("app/lib/company-identity.ts"),
    read("drizzle/0003_striped_rachel_grey.sql"),
    read("app/page.tsx"),
  ]);
  assert.match(health, /apiVersion: 1/);
  assert.match(health, /backupVersion: 1/);
  assert.match(health, /mutationsEnabled: false/);
  assert.match(pairing, /isLocalPairingManagementRequest/);
  assert.match(security, /X-Applyly-Pairing/);
  assert.match(match, /authorizeExtensionRequest/);
  assert.match(match, /findExtensionMatches/);
  assert.match(pageMatch, /authorizeExtensionRequest/);
  assert.match(pageMatch, /maximumCandidates = 100/);
  assert.match(matching, /companyNameSimilarity/);
  assert.match(matching, /normalizeApplicationUrl/);
  assert.match(matching, /application-url/);
  assert.match(health, /page-match/);
  assert.match(security, /SHA-256/);
  assert.match(identity, /normalizeCompanyName/);
  assert.match(migration, /extension_pairings/);
  assert.match(migration, /company_domain/);
  assert.match(page, /Create pairing token/);
  assert.match(page, /Revoke pairing/);
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
  assert.match(storage, /isValidAppliedDate/);
  assert.doesNotMatch(storage, /toISOString\(\)\.slice/);
  assert.match(storage, /rollbackApplicationStatus/);
  assert.match(storage, /updateApplicationDetails/);
  assert.match(storage, /DELETE FROM applications/);
  assert.match(storage, /application_status_history/);
  assert.match(storage, /contact_email/);
  assert.match(storage, /getApplicationAnalytics/);
  assert.match(storage, /reachedContact/);
  assert.match(storage, /responseRate/);
  assert.match(storage, /substr\(applied_date, 1, 4\)/);
  assert.match(route, /listApplications/);
  assert.match(route, /createApplication/);
  assert.match(route, /validateApplicationFields/);
  assert.match(statusRoute, /updateApplicationStatus/);
  assert.match(statusRoute, /rollbackApplicationStatus/);
  assert.match(statusRoute, /undoHistoryId/);
  assert.match(statusRoute, /details\?: ApplicationPayload/);
  assert.match(statusRoute, /export async function DELETE/);
  assert.match(statusRoute, /getApplicationHistory/);
  const analyticsRoute = await read("app/api/applications/analytics/route.ts");
  assert.match(analyticsRoute, /getApplicationAnalytics/);
  assert.match(analyticsRoute, /searchParams\.get\("year"\)/);
});

test("the UI supports navigation, insights, settings, and optimistic records with the persisted record and rolls back failures", async () => {
  const [page, insights] = await Promise.all([read("app/page.tsx"), read("app/components/insights-panel.tsx")]);
  assert.match(page, /setApps\(current => \[optimistic, \.\.\.current\]\)/);
  assert.match(page, /app\.id === optimistic\.id \? data\.application : app/);
  assert.match(page, /current => current\.filter\(app => app\.id !== optimistic\.id\)/);
  assert.match(page, /view === "insights"/);
  assert.match(page, /view === "settings"/);
  assert.match(page, /method:"DELETE"/);
  assert.match(page, /APPLICATION LINK/);
  assert.match(page, /openHistory/);
  assert.match(page, /ApplicationDetailsModal/);
  assert.match(page, /openDetails/);
  assert.match(page, /modal-backdrop/);
  assert.match(page, /CONTACT EMAIL/);
  assert.match(page, /htmlFor="salary"/);
  assert.match(page, /form\.salary/);
  assert.match(insights, /Conversion funnel/);
  assert.match(insights, /All time/);
  assert.match(insights, /Status trend/);
  assert.match(insights, /usesYearBuckets = selectedYear === "all" && years.length > 1/);
  assert.match(insights, /trendSeries/);
  assert.match(insights, /polyline/);
  assert.match(insights, /aria-pressed/);
  assert.match(page, /insightYear/);
  assert.match(page, /Welcome back/);
  assert.match(page, /hydrated/);
  assert.match(page, /todayIso/);
  assert.match(page, /getFullYear/);
  assert.match(page, /defaultSource/);
  assert.match(page, /defaultDateMode/);
  assert.match(page, /applyly-dark/);
  assert.match(page, /dusk-stone/);
  assert.match(page, /warm-taupe/);
  assert.match(page, /indigo-paper/);
  assert.match(page, /harbor-blue/);
  assert.match(page, /berry-noir/);
  assert.match(page, /greenwood/);
  assert.match(page, /earth-sage/);
  assert.match(page, /None \(leave blank\)/);
  assert.match(page, /Today \(device-local\)/);
  assert.match(page, /dateLocale/);
  assert.match(page, /navigator\.language/);
  assert.doesNotMatch(page, /DATE DISPLAY/);
  assert.match(page, /type="date"/);
  assert.match(page, /formatStoredDate/);
  assert.match(page, /resetApplicationForm/);
  assert.match(page, /Reset form to saved defaults/);
  assert.match(page, /applyly\.defaultSource/);
  assert.match(page, /applyly\.defaultDateMode/);
  assert.match(insights, /dateLocale/);
  assert.doesNotMatch(page, /setForm\(current => current\.appliedDate/);
  assert.match(page, />Today</);
  assert.match(insights, /Interview to Offer/);
  assert.match(insights, /stacked-bar/);
  assert.match(insights, /status-donut/);
  assert.match(insights, /healthPercent/);
  assert.match(insights, /pipeline health/);
  assert.match(insights, /Total applications/);
  assert.match(insights, /legend-swatch/);
});



test("status history migration is present", async () => {
  const migration = await read("drizzle/0001_status_history.sql");
  assert.match(migration, /application_status_history/);
  assert.match(migration, /changed_at/);
});


test("Drizzle metadata records every committed migration", async () => {
  const [journal, statusSnapshot, detailsSnapshot] = await Promise.all([
    read("drizzle/meta/_journal.json"),
    read("drizzle/meta/0001_snapshot.json"),
    read("drizzle/meta/0002_snapshot.json"),
  ]);
  assert.match(journal, /0001_status_history/);
  assert.match(journal, /0002_application_details/);
  assert.match(statusSnapshot, /application_status_history/);
  assert.match(detailsSnapshot, /contact_email/);
});
test("data transfers include structured backups, independent formats, and explicit restore confirmation", async () => {
  const [storage, backupRoute, transfer, xlsx, docx, options, packageJson, page] = await Promise.all([
    read("app/api/applications/storage.ts"),
    read("app/api/applications/backup/route.ts"),
    read("app/components/data-transfer-panel.tsx"),
    read("app/lib/xlsx-transfer.ts"),
    read("app/lib/docx-transfer.ts"),
    read("app/lib/application-options.ts"),
    read("package.json"),
    read("app/page.tsx"),
  ]);
  assert.match(storage, /exportApplicationBackup/);
  assert.match(storage, /importApplicationBackup/);
  assert.match(storage, /application_status_history/);
  assert.match(storage, /DELETE FROM application_status_history/);
  assert.match(storage, /version: 1/);
  assert.match(backupRoute, /exportApplicationBackup/);
  assert.match(backupRoute, /importApplicationBackup/);
  assert.match(transfer, /application\/json/);
  assert.match(transfer, /Export \$\{exportFormat\.toUpperCase\(\)\}/);
  assert.match(transfer, /Import format/);
  assert.match(transfer, /Export format/);
  assert.match(transfer, /setExportFormat/);
  assert.match(transfer, /setImportFormat/);
  assert.match(transfer, /text\/csv/);
  assert.match(transfer, /createXlsx/);
  assert.match(transfer, /readXlsx/);
  assert.match(transfer, /createDocx/);
  assert.match(transfer, /wordprocessingml\.document/);
  assert.doesNotMatch(transfer, /await import\([^)]*xlsx-transfer/);
  assert.match(transfer, /Open PDF report/);
  assert.match(transfer, /Save as PDF/);
  assert.match(transfer, /10\*1024\*1024/);
  assert.match(transfer, /window\.confirm/);
  assert.match(transfer, /Delete all applications/);
  assert.match(xlsx, /zipSync/);
  assert.match(xlsx, /unzipSync/);
  assert.match(xlsx, /Applications/);
  assert.match(xlsx, /Status History/);
  assert.match(docx, /word\/document\.xml/);
  assert.match(docx, /zipSync/);
  assert.match(docx, /Applyly application report/);
  assert.match(options, /HiringCafe/);
  assert.match(options, /Y Combinator Jobs/);
  assert.match(packageJson, /fflate/);
  assert.doesNotMatch(packageJson, /"xlsx"/);
  assert.doesNotMatch(packageJson, /exceljs/);
  assert.match(page, /Delete every application and its status history/);
  assert.match(page, /view === "data"/);
  assert.match(page, /DataTransferPanel/);
  assert.match(page, /sourceFilter/);
  assert.match(page, /salaryFilter/);
  assert.match(page, /pagedApplications/);
  assert.match(page, /customRowsMode/);
  assert.match(page, /Custom/);
  assert.match(page, /Search company, role, location, date, source or salary/);
});
test("Contact, Withdrawn, and Expired are shared API-supported statuses", async () => {
  const [options, storage, insights, contract] = await Promise.all([
    read("app/lib/application-options.ts"),
    read("app/api/applications/storage.ts"),
    read("app/components/insights-panel.tsx"),
    read("API_CONTRACT.md"),
  ]);
  for (const status of ["Contact", "Withdrawn", "Expired"]) {
    assert.match(options, new RegExp(status));
    assert.match(storage, /new Set\(applicationStatuses\)/);
    assert.match(insights, new RegExp(status));
    assert.match(contract, new RegExp(status));
  }
});

test("capture review, duplicate protection, and follow-up attention are explicit product contracts", async () => {
  const [page, route, storage, urlNormalizer] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/applications/route.ts"),
    read("app/api/applications/storage.ts"),
    read("app/lib/application-url.ts"),
  ]);
  assert.match(page, /captureFromExtension/);
  assert.match(page, /Review the fields and choose the applied date/);
  assert.match(page, /allowDuplicate:true/);
  assert.match(page, /Needs attention/);
  assert.match(page, /needsAttention/);
  assert.match(route, /DUPLICATE_APPLICATION/);
  assert.match(route, /status: 409/);
  assert.match(storage, /findDuplicateApplication/);
  assert.match(storage, /db\.batch/);
  assert.match(urlNormalizer, /utm_source/);
  assert.match(urlNormalizer, /linkedin\.com/);
});
