import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const extensionIdFromKey = key => [...createHash("sha256").update(Buffer.from(key, "base64")).digest("hex").slice(0, 32)]
  .map(character => String.fromCharCode(97 + Number.parseInt(character, 16)))
  .join("");

test("extension manifest keeps local API access required and job-site access optional", async () => {
  const manifest = JSON.parse(await read("extension/manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "0.5.0");
  assert.deepEqual(new Set(manifest.permissions), new Set(["activeTab", "scripting", "storage"]));
  assert.deepEqual(manifest.host_permissions, ["http://localhost/*", "http://127.0.0.1/*"]);
  assert.deepEqual(manifest.optional_host_permissions, ["https://*/*", "http://*/*"]);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.background.service_worker, "background.js");
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.ok(!JSON.stringify(manifest).includes("<all_urls>"));
  assert.equal(extensionIdFromKey(manifest.key), "febphjmgnkpofbinjebefmenfldbjbbb");
});

test("vinext allows only the stable Applyly extension development origin", async () => {
  const nextConfig = await read("next.config.ts");
  assert.match(nextConfig, /allowedDevOrigins:\s*\["febphjmgnkpofbinjebefmenfldbjbbb"\]/);
  assert.doesNotMatch(nextConfig, /allowedDevOrigins:\s*\["\*"\]/);
});

test("persistent guidance is opt-in per site and survives refresh without static access", async () => {
  const [html, popup, worker, guide, reader] = await Promise.all([
    read("extension/popup.html"),
    read("extension/popup.js"),
    read("extension/background.js"),
    read("extension/guide-content.js"),
    read("extension/page-reader-core.js"),
  ]);

  assert.match(html, /Guide this site/);
  assert.match(html, /Access is granted only for this site/);
  assert.match(popup, /patternForPage/);
  assert.match(popup, /chrome\.permissions\.request\(\{\s*origins:\s*\[guidePattern\]/);
  assert.match(popup, /chrome\.permissions\.remove\(\{\s*origins:\s*\[guidePattern\]/);
  assert.match(popup, /applyly-guide-enable/);
  assert.match(popup, /applyly-guide-disable/);

  assert.match(worker, /chrome\.scripting\.registerContentScripts/);
  assert.match(worker, /chrome\.scripting\.updateContentScripts/);
  assert.match(worker, /chrome\.scripting\.unregisterContentScripts/);
  assert.match(worker, /persistAcrossSessions:\s*true/);
  assert.match(worker, /chrome\.permissions\.contains/);
  assert.match(worker, /chrome\.permissions\.onRemoved/);
  assert.match(worker, /permissions\.origins\.map\(unregisterPattern\)/);
  assert.match(worker, /chrome\.tabs\.query\(\{ url: \[pattern\] \}\)/);
  assert.match(worker, /applyly-guide-remove/);
  assert.match(worker, /applylyGuidedOrigins/);
  assert.match(worker, /chrome\.runtime\.onStartup/);
  assert.match(worker, /chrome\.runtime\.onInstalled/);
  assert.match(worker, /Guidance is not enabled for this site/);
  assert.match(worker, /scanControllers/);
  assert.match(worker, /AbortController/);
  assert.match(worker, /candidateMatches/);
  assert.match(worker, /applyly-capture/);
  assert.match(worker, /applicationId/);

  assert.match(guide, /MutationObserver/);
  assert.match(guide, /location\.href/);
  assert.match(guide, /data-applyly-candidate-index/);
  assert.match(guide, /data-applyly-match-kind/);
  assert.match(guide, /exact-job/);
  assert.match(guide, /similar-role/);
  assert.match(guide, /company-history/);
  assert.match(guide, /candidateMatches/);
  assert.match(guide, /Review this job/);
  assert.match(guide, /Open application/);
  assert.match(guide, /decoratedTargets/);
  assert.match(guide, /position:absolute/);
  assert.doesNotMatch(guide, /insertBefore/);
  assert.doesNotMatch(guide, /\bfetch\s*\(/);
  assert.match(reader, /normalizeJobUrl/);
  assert.match(reader, /lever/);
  assert.match(reader, /ashbyhq/);
  assert.match(reader, /greenhouse/);
});

test("extension matching stays local, paired, review-first, and read-only", async () => {
  const [html, popup, worker, pageContext, documentation, appPage, pageMatch] = await Promise.all([
    read("extension/popup.html"),
    read("extension/popup.js"),
    read("extension/background.js"),
    read("extension/page-context.js"),
    read("extension/README.md"),
    read("app/page.tsx"),
    read("app/api/extension/page-match/route.ts"),
  ]);

  assert.match(html, /Scan page/);
  assert.match(html, /Connection settings/);
  assert.match(html, /Review captured job in Applyly/);
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/);
  assert.match(popup, /chrome\.scripting\.executeScript/);
  assert.match(popup, /chrome\.storage\.local/);
  assert.match(popup, /\/api\/health/);
  assert.match(popup, /\/api\/extension\/page-match/);
  assert.match(popup, /Authorization/);
  assert.match(popup, /Bearer/);
  assert.match(popup, /reviewCapturedJob/);
  assert.match(popup, /capture: "extension"/);
  assert.match(popup, /URLSearchParams/);
  assert.match(popup, /chrome\.tabs\.create/);
  assert.doesNotMatch(popup, /temporary marker/i);

  assert.match(worker, /\/api\/extension\/page-match/);
  assert.match(worker, /Authorization/);
  assert.doesNotMatch(worker, /\/api\/applications/);

  assert.match(pageContext, /JobPosting/);
  assert.match(pageContext, /hiringOrganization/);
  assert.match(pageContext, /collectionHint/);
  assert.match(pageContext, /wellfound/);
  assert.match(pageContext, /findJobCard/);
  assert.match(pageContext, /companyFromCard/);
  assert.match(pageContext, /roleFromCard/);
  assert.match(pageContext, /data-applyly-candidate-index/);
  assert.match(pageContext, /ApplylyPageReader/);
  assert.match(pageContext, /jobLinkCount/);
  assert.doesNotMatch(pageContext, /og:site_name/);
  assert.match(pageMatch, /candidateMatches/);
  assert.match(pageMatch, /matchedCandidates/);
  assert.match(appPage, /focusedApplicationId/);
  assert.match(appPage, /setDetailsFor\(focused\)/);

  const source = popup + worker + pageContext;
  assert.match(source, /localhost/);
  assert.doesNotMatch(source, /eval\s*\(/);
  assert.doesNotMatch(source, /new Function/);
  assert.doesNotMatch(source, /analytics|telemetry/i);
  assert.match(documentation, /No remote backend/);
  assert.match(documentation, /read-only/i);
  assert.match(documentation, /Application records stay/);
});
